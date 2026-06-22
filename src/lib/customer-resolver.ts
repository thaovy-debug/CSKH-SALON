import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { Prisma } from "@/generated/prisma/client";

type MetadataRecord = Prisma.InputJsonObject;

/**
 * Normalize a phone number for consistent matching.
 * Strips WhatsApp suffixes (@c.us, @s.whatsapp.net) and non-digit chars (except leading +).
 */
export function normalizePhone(input: string): string {
  const cleaned = input.replace(/@(c\.us|s\.whatsapp\.net)$/, "");
  return cleaned.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
}

const resolvingPromises = new Map<string, Promise<string>>();

function isRecord(value: unknown): value is MetadataRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExternalContactChannel(channel: string): channel is "facebook" | "instagram" | "zalo" {
  return channel === "facebook" || channel === "instagram" || channel === "zalo";
}

function isScopedExternalContact(channel: string, contact: string): boolean {
  if (channel === "facebook" || channel === "instagram") return true;
  return channel === "zalo" && contact.startsWith("zalo:");
}

function getExternalContact(metadata: unknown, channel: string): string | null {
  if (!isRecord(metadata)) return null;
  const externalContacts = metadata.externalContacts;
  if (!isRecord(externalContacts)) return null;
  const contact = externalContacts[channel];
  return typeof contact === "string" ? contact : null;
}

function mergeExternalContactMetadata(
  metadata: unknown,
  channel: string,
  contact: string
): MetadataRecord {
  const base = isRecord(metadata) ? { ...metadata } : {};
  const currentExternalContacts = isRecord(base.externalContacts)
    ? base.externalContacts
    : {};

  return {
    ...base,
    externalContacts: {
      ...currentExternalContacts,
      [channel]: contact,
    },
  };
}

/**
 * Resolve a customer identity across channels.
 * Finds or creates a Customer record based on contact info.
 * Returns the customerId for linking to conversations.
 */
export async function resolveCustomer(
  channel: string,
  customerContact: string,
  customerName: string
): Promise<string> {
  const lockKey = `${channel}:${customerContact}`;
  
  if (resolvingPromises.has(lockKey)) {
    return resolvingPromises.get(lockKey)!;
  }

  const resolvePromise = (async () => {
    if (!customerContact) {
      return createCustomer(customerName, channel, customerContact);
    }

  // Step 1: Direct field match by channel
  const directMatch = await findByChannelField(channel, customerContact);
  if (directMatch) {
    await updateExistingCustomer(directMatch.id, channel, customerContact, customerName);
    return directMatch.id;
  }

  // Step 2: Normalized phone match (for phone/whatsapp/zalo channels)
  if (channel === "phone" || channel === "whatsapp" || channel === "zalo") {
    const normalized = normalizePhone(customerContact);
    if (normalized.length >= 7) {
      const phoneMatch = await prisma.customer.findFirst({
        where: {
          OR: [
            { phone: { contains: normalized } },
            { whatsapp: { contains: normalized } },
          ],
        },
      });
      if (phoneMatch) {
        await updateExistingCustomer(phoneMatch.id, channel, customerContact, customerName);
        return phoneMatch.id;
      }
    }
  }

  // Step 3: Cross-field fallback (search all contact fields)
  const crossMatch = await prisma.customer.findFirst({
    where: {
      OR: [
        { email: { equals: customerContact, mode: "insensitive" } },
        { phone: customerContact },
        { whatsapp: customerContact },
      ],
    },
  });
  if (crossMatch) {
    await updateExistingCustomer(crossMatch.id, channel, customerContact, customerName);
    return crossMatch.id;
  }

  // Step 4: Auto-create new customer
    return createCustomer(customerName, channel, customerContact);
  })();

  resolvingPromises.set(lockKey, resolvePromise);
  
  try {
    return await resolvePromise;
  } finally {
    // Only remove if it's the exact same promise (to handle extremely rare edge cases gracefully)
    if (resolvingPromises.get(lockKey) === resolvePromise) {
      resolvingPromises.delete(lockKey);
    }
  }
}

async function findByChannelField(channel: string, contact: string) {
  switch (channel) {
    case "email":
      return prisma.customer.findFirst({
        where: { email: { equals: contact, mode: "insensitive" } },
      });
    case "whatsapp":
      return prisma.customer.findFirst({
        where: { whatsapp: contact },
      });
    case "phone":
      return prisma.customer.findFirst({
        where: { phone: contact },
      });
    case "zalo":
      if (!isScopedExternalContact(channel, contact)) {
        return prisma.customer.findFirst({
          where: { phone: contact },
        });
      }
    // fall through for scoped Zalo contacts
    case "facebook":
    case "instagram": {
      const candidates = await prisma.customer.findMany({
        select: { id: true, metadata: true },
        take: 1000,
      });
      return (
        candidates.find(
          (customer: { metadata: unknown }) =>
            getExternalContact(customer.metadata, channel) === contact
        ) || null
      );
    }
    default:
      return null;
  }
}

async function createCustomer(
  name: string,
  channel: string,
  contact: string
): Promise<string> {
  const customer = await prisma.customer.create({
    data: {
      name: name || "Unknown",
      firstContact: new Date(),
      lastContact: new Date(),
      ...(channel === "email" ? { email: contact } : {}),
      ...(channel === "whatsapp" ? { whatsapp: contact } : {}),
      ...(channel === "phone" ? { phone: contact } : {}),
      ...(channel === "zalo" && !isScopedExternalContact(channel, contact)
        ? { phone: contact }
        : {}),
      ...(isScopedExternalContact(channel, contact)
        ? { metadata: mergeExternalContactMetadata({}, channel, contact) }
        : {}),
    },
  });

  logger.info("Auto-created customer from channel contact", {
    customerId: customer.id,
    channel,
  });

  return customer.id;
}

async function updateExistingCustomer(
  customerId: string,
  channel: string,
  contact: string,
  name: string
): Promise<void> {
  const update: Record<string, unknown> = {
    lastContact: new Date(),
  };

  // Backfill empty channel fields
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { name: true, email: true, phone: true, whatsapp: true, metadata: true },
  });

  if (!customer) return;

  if (channel === "email" && !customer.email) update.email = contact;
  if (channel === "whatsapp" && !customer.whatsapp) update.whatsapp = contact;
  if (channel === "phone" && !customer.phone) update.phone = contact;
  if (channel === "zalo" && !customer.phone && !isScopedExternalContact(channel, contact)) {
    update.phone = contact;
  }
  if (isScopedExternalContact(channel, contact)) {
    update.metadata = mergeExternalContactMetadata(customer.metadata, channel, contact);
  }

  // Update name if current is "Unknown" and we have a better one
  if (customer.name === "Unknown" && name && name !== "Unknown") {
    update.name = name;
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: update,
  });
}
