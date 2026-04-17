const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const msgs = await prisma.message.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  console.log(JSON.stringify(msgs.map(m => ({
    role: m.role,
    content: m.content.substring(0, 50)
  })), null, 2));
}

main().finally(() => prisma.$disconnect());
