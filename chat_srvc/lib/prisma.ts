import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Only initialize Prisma if DATABASE_URL_CHAT is available
let prisma: PrismaClient | null = null;

if (process.env.DATABASE_URL_CHAT) {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL_CHAT,
  });
  prisma = new PrismaClient({ adapter });
}

export { prisma };
