import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Only initialize Prisma if DATABASE_URL is available
let prisma: PrismaClient | null = null;

if (process.env.DATABASE_URL) {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  prisma = new PrismaClient({ adapter });
}

export { prisma };
