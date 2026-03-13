import { PrismaClient } from '@prisma/client'

// Singleton pattern to avoid multiple connections in Next.js
const globalForPrisma = global as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
