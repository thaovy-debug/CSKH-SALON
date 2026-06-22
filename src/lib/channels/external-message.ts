import { processNormalizedInboundMessage } from "@/lib/channels/normalized";

type ExternalChannel = "facebook" | "instagram" | "zalo";

export async function handleExternalChannelMessage(input: {
  channel: ExternalChannel;
  customerContact: string;
  customerName?: string;
  channelAccountId?: string | null;
  sourceAccountId?: string;
  text: string;
}): Promise<{
  conversationId: string;
  response: string;
}> {
  const customerContact = input.customerContact.trim();
  if (!customerContact) {
    throw new Error("Customer contact is required");
  }

  const result = await processNormalizedInboundMessage({
    channel: input.channel,
    externalCustomerId: customerContact,
    externalAccountId: input.sourceAccountId,
    channelAccountId: input.channelAccountId,
    customerName: input.customerName,
    customerContact,
    text: input.text,
    metadata: input.sourceAccountId
      ? { sourceAccountId: input.sourceAccountId }
      : undefined,
  });

  return {
    conversationId: result.conversationId,
    response: result.response,
  };
}
