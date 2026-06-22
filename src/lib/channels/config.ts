type UnknownRecord = Record<string, unknown>;

const CHANNEL_SECRET_FIELDS: Record<string, string[]> = {
  facebook: ["pageAccessToken", "appSecret"],
  instagram: ["accessToken", "appSecret"],
  zalo: ["cookiesInput", "relaySecret"],
  whatsapp: ["apiKey", "whatsappApiKey"],
  email: ["smtpPass", "imapPass"],
  phone: ["twilioToken", "elevenLabsKey"],
  sms: ["twilioToken"],
  telegram: ["botToken", "telegramBotToken"],
  shopee: ["accessToken", "refreshToken", "partnerKey"],
  tiktok_shop: ["accessToken", "refreshToken", "clientSecret", "appSecret", "webhookSecret"],
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(config: UnknownRecord, key: string): string {
  const value = config[key];
  return typeof value === "string" ? value : "";
}

export function isBlankOrMaskedSecret(value: unknown): boolean {
  if (typeof value !== "string") return true;

  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^[*•]+$/.test(trimmed);
}

export function sanitizeChannelConfig(type: string, config: unknown): unknown {
  if (!isRecord(config)) return {};

  if (type === "facebook") {
    return {
      verifyToken: getString(config, "verifyToken"),
      pageId: getString(config, "pageId"),
      graphVersion: getString(config, "graphVersion"),
      hasPageAccessToken: !isBlankOrMaskedSecret(config.pageAccessToken),
      hasAppSecret: !isBlankOrMaskedSecret(config.appSecret),
    };
  }

  if (type === "instagram") {
    return {
      verifyToken: getString(config, "verifyToken"),
      businessAccountId: getString(config, "businessAccountId"),
      graphVersion: getString(config, "graphVersion"),
      hasAccessToken: !isBlankOrMaskedSecret(config.accessToken),
      hasAppSecret: !isBlankOrMaskedSecret(config.appSecret),
    };
  }

  if (type === "zalo") {
    return {
      accountId: getString(config, "accountId"),
      oaId: getString(config, "oaId"),
      displayName: getString(config, "displayName"),
      pythonCommand: getString(config, "pythonCommand"),
      scriptPath: getString(config, "scriptPath"),
      hasCookiesInput: !isBlankOrMaskedSecret(config.cookiesInput),
      hasRelaySecret: !isBlankOrMaskedSecret(config.relaySecret),
    };
  }

  if (type === "whatsapp") {
    return {
      mode: getString(config, "mode"),
      phoneNumber: getString(config, "phoneNumber"),
      hasApiKey:
        !isBlankOrMaskedSecret(config.apiKey) ||
        !isBlankOrMaskedSecret(config.whatsappApiKey),
    };
  }

  if (type === "email") {
    return {
      smtpHost: getString(config, "smtpHost"),
      smtpPort: getString(config, "smtpPort"),
      smtpUser: getString(config, "smtpUser"),
      smtpFrom: getString(config, "smtpFrom"),
      imapHost: getString(config, "imapHost"),
      imapPort: getString(config, "imapPort"),
      imapUser: getString(config, "imapUser"),
      hasSmtpPass: !isBlankOrMaskedSecret(config.smtpPass),
      hasImapPass: !isBlankOrMaskedSecret(config.imapPass),
    };
  }

  if (type === "phone" || type === "sms") {
    return {
      twilioSid: getString(config, "twilioSid"),
      twilioPhone: getString(config, "twilioPhone"),
      elevenLabsVoice: getString(config, "elevenLabsVoice"),
      hasTwilioToken: !isBlankOrMaskedSecret(config.twilioToken),
      hasElevenLabsKey: !isBlankOrMaskedSecret(config.elevenLabsKey),
    };
  }

  if (type === "telegram") {
    return {
      hasBotToken:
        !isBlankOrMaskedSecret(config.botToken) ||
        !isBlankOrMaskedSecret(config.telegramBotToken),
    };
  }

  return config;
}

export function sanitizeChannelForClient<T extends { type: string; config: unknown }>(
  channel: T
): T {
  return {
    ...channel,
    config: sanitizeChannelConfig(channel.type, channel.config),
  };
}

export function mergeChannelConfigPreservingSecrets(
  type: string,
  incomingConfig: unknown,
  existingConfig: unknown
): unknown {
  const incoming = isRecord(incomingConfig) ? incomingConfig : {};
  const existing = isRecord(existingConfig) ? existingConfig : {};
  const merged: UnknownRecord = { ...existing, ...incoming };

  const preserveSecret = (key: string) => {
    if (isBlankOrMaskedSecret(incoming[key])) {
      if (existing[key] !== undefined) {
        merged[key] = existing[key];
      } else if (incoming[key] !== undefined) {
        merged[key] = incoming[key];
      }
    }
  };

  for (const key of CHANNEL_SECRET_FIELDS[type] || []) {
    preserveSecret(key);
  }

  return merged;
}
