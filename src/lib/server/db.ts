import { PrismaClient } from "@prisma/client";

/**
 * Lazy Prisma singleton. Never instantiated at import time — the app must
 * boot and run fully (guest mode) with zero database configuration.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function dbAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): PrismaClient {
  if (!dbAvailable()) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}
