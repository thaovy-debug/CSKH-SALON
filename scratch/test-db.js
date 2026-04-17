const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const conv = await prisma.conversation.findFirst({
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
        customer: true,
        tags: {
          include: { tag: true },
        },
        tickets: {
          include: {
            department: true,
            assignedTo: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });
    console.log(conv ? "OK: Found" : "OK: None");
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
