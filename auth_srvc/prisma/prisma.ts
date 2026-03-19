// lib/prisma/prisma.ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
// dotenv/config removed: Next.js already loads .env files before the app starts

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

if (!globalForPrisma.pool) {
  globalForPrisma.pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  })
}

const pool = globalForPrisma.pool
const adapter = new PrismaPg(pool)

// Always cache on globalThis so only one PrismaClient exists per process.
// Without this, production deployments create a new client on every module
// evaluation, eventually exhausting the pg connection pool.
globalForPrisma.prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter,
  // Restrict verbose query logging to development — query logs include
  // parameter values (emails, usernames) which must not appear in prod logs.
  log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
})

export const prisma = globalForPrisma.prisma
