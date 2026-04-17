import { prisma } from './src/lib/prisma';
import { mergeConversations } from './src/lib/conversation-engine';

async function main() {
  // Get all WhatsApp conversations
  const conversations = await prisma.conversation.findMany({
    where: { 
      channel: 'whatsapp',
      status: 'active'
    },
    orderBy: { createdAt: 'asc' }
  });

  // Group by customerContact
  const map = new Map<string, string[]>();
  for (const c of conversations) {
    if (!map.has(c.customerContact)) {
      map.set(c.customerContact, []);
    }
    map.get(c.customerContact)!.push(c.id);
  }

  // Merge duplicates
  for (const [contact, ids] of map.entries()) {
    if (ids.length > 1) {
      console.log(`Merging ${ids.length} conversations for ${contact}...`);
      const primaryId = ids[0];
      for (let i = 1; i < ids.length; i++) {
        await mergeConversations(primaryId, ids[i]);
      }
      console.log(`Merged into ${primaryId}`);
    }
  }
}

main()
  .then(() => console.log('Merge complete'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
