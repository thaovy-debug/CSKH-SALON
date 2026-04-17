import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/salondesk?schema=public';
const adapter = new PrismaPg({ connectionString });
const p = new PrismaClient({ adapter } as any);

const settings = await p.settings.findFirst();
console.log('Current settings:', JSON.stringify(settings, null, 2));

await p.$disconnect();
