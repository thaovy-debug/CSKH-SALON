-- Add multi-account support while preserving the existing single Channel config model.
CREATE TABLE IF NOT EXISTS "ChannelAccount" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "displayName" TEXT NOT NULL DEFAULT '',
  "externalAccountId" TEXT NOT NULL DEFAULT '',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'disconnected',
  "lastConnectedAt" TIMESTAMP(3),
  "lastError" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChannelAccount_type_externalAccountId_key"
  ON "ChannelAccount"("type", "externalAccountId");
CREATE INDEX IF NOT EXISTS "ChannelAccount_type_idx" ON "ChannelAccount"("type");
CREATE INDEX IF NOT EXISTS "ChannelAccount_status_idx" ON "ChannelAccount"("status");
CREATE INDEX IF NOT EXISTS "ChannelAccount_isActive_idx" ON "ChannelAccount"("isActive");

ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "channelAccountId" TEXT;

CREATE INDEX IF NOT EXISTS "Conversation_channelAccountId_idx"
  ON "Conversation"("channelAccountId");
CREATE INDEX IF NOT EXISTS "Conversation_channel_channelAccountId_idx"
  ON "Conversation"("channel", "channelAccountId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Conversation_channelAccountId_fkey'
      AND table_name = 'Conversation'
  ) THEN
    ALTER TABLE "Conversation"
      ADD CONSTRAINT "Conversation_channelAccountId_fkey"
      FOREIGN KEY ("channelAccountId") REFERENCES "ChannelAccount"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "ChannelAccount" (
  "id",
  "type",
  "displayName",
  "externalAccountId",
  "isActive",
  "isDefault",
  "config",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  c."type",
  CASE
    WHEN c."type" = 'facebook' THEN COALESCE(NULLIF(c."config"->>'pageId', ''), 'Facebook Page')
    WHEN c."type" = 'instagram' THEN COALESCE(NULLIF(c."config"->>'businessAccountId', ''), 'Instagram Business')
    WHEN c."type" = 'zalo' THEN COALESCE(NULLIF(c."config"->>'accountId', ''), 'Zalo Account')
    ELSE c."type"
  END,
  CASE
    WHEN c."type" = 'facebook' THEN COALESCE(NULLIF(c."config"->>'pageId', ''), 'default')
    WHEN c."type" = 'instagram' THEN COALESCE(NULLIF(c."config"->>'businessAccountId', ''), 'default')
    WHEN c."type" = 'zalo' THEN COALESCE(NULLIF(c."config"->>'accountId', ''), 'default')
    ELSE 'default'
  END,
  c."isActive",
  true,
  c."config",
  c."status",
  c."createdAt",
  c."updatedAt"
FROM "Channel" c
WHERE c."type" IN ('facebook', 'instagram', 'zalo')
ON CONFLICT ("type", "externalAccountId") DO NOTHING;
