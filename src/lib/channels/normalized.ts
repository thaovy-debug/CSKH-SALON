import { prisma } from "@/lib/prisma";
import { chat, createNewConversation } from "@/lib/ai/engine";
import { resolveCustomer } from "@/lib/customer-resolver";

export type NormalizedInboundChannel =
  | "facebook"
  | "instagram"
  | "zalo"
  | "whatsapp"
  | "email"
  | "phone"
  | "sms"
  | "telegram"
  | "shopee"
  | "tiktok_shop"
  | "widget"
  | "api";

export type NormalizedInboundMessage = {
  channel: NormalizedInboundChannel;
  externalConversationId?: string;
  externalCustomerId: string;
  externalAccountId?: string;
  channelAccountId?: string | null;
  customerName?: string;
  customerContact?: string;
  text: string;
  attachments?: unknown[];
  rawPayload?: unknown;
  platformMessageId?: string;
  receivedAt?: Date | string;
  metadata?: Record<string, unknown>;
};

const SUPPORTED_CHANNELS = new Set<NormalizedInboundChannel>([
  "facebook",
  "instagram",
  "zalo",
  "whatsapp",
  "email",
  "phone",
  "sms",
  "telegram",
  "shopee",
  "tiktok_shop",
  "widget",
  "api",
]);

function isSupportedChannel(channel: string): channel is NormalizedInboundChannel {
  return SUPPORTED_CHANNELS.has(channel as NormalizedInboundChannel);
}

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeReceivedAt(value: Date | string | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  const trimmed = value.trim();
  return trimmed || undefined;
}

function buildConversationMetadata(input: NormalizedInboundMessage): Record<string, unknown> {
  const metadata: Record<string, unknown> = { ...(input.metadata || {}) };
  const externalConversationId = trimString(input.externalConversationId);
  const externalAccountId = trimString(input.externalAccountId);
  const platformMessageId = trimString(input.platformMessageId);
  const receivedAt = normalizeReceivedAt(input.receivedAt);

  if (externalConversationId) metadata.externalConversationId = externalConversationId;
  if (externalAccountId) metadata.externalAccountId = externalAccountId;
  if (platformMessageId) metadata.platformMessageId = platformMessageId;
  if (receivedAt) metadata.receivedAt = receivedAt;
  if (input.attachments?.length) metadata.attachmentCount = input.attachments.length;

  return metadata;
}

export async function processNormalizedInboundMessage(
  input: NormalizedInboundMessage
): Promise<{
  conversationId: string;
  response: string;
  customerId?: string;
}> {
  if (!isSupportedChannel(input.channel)) {
    throw new Error(`Unsupported channel: ${String(input.channel)}`);
  }

  const text = trimString(input.text);
  if (!text) {
    throw new Error("Message text is required");
  }

  const externalCustomerId = trimString(input.externalCustomerId);
  const customerContact = trimString(input.customerContact) || externalCustomerId;
  if (!externalCustomerId && !customerContact) {
    throw new Error("Customer contact or external customer ID is required");
  }

  const customerName = trimString(input.customerName) || "Unknown";
  const accountFilter = input.channelAccountId
    ? { channelAccountId: input.channelAccountId }
    : {};

  let conversation = await prisma.conversation.findFirst({
    where: {
      channel: input.channel,
      ...accountFilter,
      customerContact,
      status: { in: ["active", "escalated"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  const customerId = await resolveCustomer(input.channel, customerContact, customerName);

  if (!conversation) {
    conversation = await prisma.conversation.findFirst({
      where: {
        channel: input.channel,
        ...accountFilter,
        status: { in: ["active", "escalated"] },
        OR: [{ customerId }, { customerContact }],
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  if (!conversation) {
    const metadata = buildConversationMetadata(input);
    const options =
      input.channelAccountId || Object.keys(metadata).length > 0
        ? {
            channelAccountId: input.channelAccountId,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          }
        : undefined;

    conversation = options
      ? await createNewConversation(
          input.channel,
          customerName,
          customerContact,
          customerId,
          options
        )
      : await createNewConversation(input.channel, customerName, customerContact, customerId);
  }

  const response = await chat(conversation.id, text);

  return {
    conversationId: conversation.id,
    response,
    customerId,
  };
}
