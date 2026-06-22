import { prisma } from "@/lib/prisma";
import { processNormalizedInboundMessage } from "@/lib/channels/normalized";
import { logger } from "@/lib/logger";

interface SmsConfig {
  twilioSid: string;
  twilioToken: string;
  twilioPhone: string;
}

async function getSmsConfig(): Promise<SmsConfig | null> {
  const settings = await prisma.settings.findFirst();
  if (!settings?.twilioSid || !settings?.twilioToken || !settings?.twilioPhone) return null;

  return {
    twilioSid: settings.twilioSid,
    twilioToken: settings.twilioToken,
    twilioPhone: settings.twilioPhone,
  };
}

/**
 * Handle incoming SMS message from Twilio webhook.
 */
export async function handleIncomingSms(
  from: string,
  body: string,
  context?: {
    to?: string;
    messageSid?: string;
  }
): Promise<string> {
  try {
    if (!body || !body.trim()) {
      return "Please send a message and we'll be happy to help!";
    }

    const result = await processNormalizedInboundMessage({
      channel: "sms",
      externalCustomerId: from,
      customerContact: from,
      externalConversationId: context?.messageSid || from,
      platformMessageId: context?.messageSid,
      customerName: from || "SMS User",
      text: body,
      metadata: {
        provider: "twilio",
        ...(context?.to ? { to: context.to } : {}),
      },
    });

    return result.response;
  } catch (error) {
    logger.error("[SMS] Failed to process incoming message:", error);
    return "Sorry, we're experiencing issues. Please try again later.";
  }
}

/**
 * Send an outbound SMS via Twilio.
 */
export async function sendSms(
  to: string,
  message: string
): Promise<boolean> {
  const config = await getSmsConfig();
  if (!config) {
    logger.warn("[SMS] Not configured");
    return false;
  }

  try {
    const { default: twilio } = await import("twilio");
    const client = twilio(config.twilioSid, config.twilioToken);

    await client.messages.create({
      body: message,
      from: config.twilioPhone,
      to,
    });

    return true;
  } catch (error) {
    logger.error("[SMS] Failed to send message:", error);
    return false;
  }
}
