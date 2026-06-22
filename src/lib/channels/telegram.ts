import { prisma } from "@/lib/prisma";
import { processNormalizedInboundMessage } from "@/lib/channels/normalized";
import { logger } from "@/lib/logger";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
}

async function getTelegramToken(): Promise<string> {
  const settings = await prisma.settings.findFirst({
    select: { telegramBotToken: true },
  });
  return settings?.telegramBotToken || "";
}

/**
 * Handle incoming Telegram webhook update.
 */
export async function handleTelegramUpdate(update: TelegramUpdate): Promise<string | null> {
  const message = update.message;
  if (!message?.text) return null;

  try {
    const chatId = String(message.chat.id);
    const userName =
      [message.from.first_name, message.from.last_name].filter(Boolean).join(" ") ||
      (message.from.username ? `@${message.from.username}` : `Telegram User ${message.from.id}`);

    const result = await processNormalizedInboundMessage({
      channel: "telegram",
      externalCustomerId: String(message.chat.id || message.from.id),
      customerContact: `telegram:${chatId}`,
      externalConversationId: chatId,
      platformMessageId: String(message.message_id || update.update_id),
      customerName: userName,
      text: message.text,
      metadata: {
        updateId: update.update_id,
        chatType: message.chat.type,
        ...(message.from.username ? { username: message.from.username } : {}),
      },
    });

    // Send reply via Telegram API
    const token = await getTelegramToken();
    if (token) {
      await sendTelegramMessage(token, message.chat.id, result.response);
    }

    return result.response;
  } catch (error) {
    logger.error("[Telegram] Failed to process update:", error);
    return null;
  }
}

/**
 * Send a message via Telegram Bot API.
 */
async function sendTelegramMessage(
  token: string,
  chatId: number,
  text: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
        }),
      }
    );

    return response.ok;
  } catch (error) {
    logger.error("[Telegram] Failed to send message:", error);
    return false;
  }
}

/**
 * Set up Telegram webhook URL.
 */
export async function setupTelegramWebhook(
  botToken: string,
  webhookUrl: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      }
    );

    const data = await response.json();
    return data.ok === true;
  } catch (error) {
    logger.error("[Telegram] Failed to set webhook:", error);
    return false;
  }
}
