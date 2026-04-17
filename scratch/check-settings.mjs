import pkg from '../../src/generated/prisma/index.js';
const { PrismaClient } = pkg;

const p = new PrismaClient();

const settings = await p.settings.findFirst();
console.log('Current settings:', JSON.stringify(settings, null, 2));

await p.$disconnect();
