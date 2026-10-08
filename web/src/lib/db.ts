import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function databaseUrl() {
  const configured = process.env.DATABASE_URL;
  if (!configured) return undefined;
  const url = new URL(configured);
  if (["postgres:", "postgresql:"].includes(url.protocol)) {
    // Aiven hobby/free PostgreSQL allows max 20 connections across the entire DB.
    // Cap connection_limit to 3 per process to prevent connection pool exhaustion.
    const currentLimit = Number(url.searchParams.get("connection_limit") || 3);
    url.searchParams.set("connection_limit", String(Math.min(currentLimit, 3)));
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
  }
  return url.toString();
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrl(),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Never replace a live client during hot reload; schema/client updates need a restart.
globalForPrisma.prisma = prisma;
