import { prisma } from './src/lib/prisma';

async function main() {
  const msgs = await prisma.message.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { conversation: { select: { id: true, status: true } } }
  });
  console.log(JSON.stringify(msgs.map(m => ({
    conversationId: m.conversationId.substring(0, 8),
    convStatus: m.conversation.status,
    role: m.role,
    content: m.content.substring(0, 50)
  })), null, 2));
}

main().finally(() => prisma.$disconnect());
