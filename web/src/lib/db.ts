import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  databasePool: Pool | undefined;
};

function databaseUrl() {
  const configured = process.env.DATABASE_URL;
  if (!configured) return undefined;
  const url = new URL(configured);
  if (["postgres:", "postgresql:"].includes(url.protocol)) {
    // Aiven hobby/free PostgreSQL allows max 20 connections across the entire DB.
    // Local Rust-engine pool; Vercel uses the managed pg pool below.
    const cap = process.env.VERCEL ? 1 : 3;
    const currentLimit = Number(url.searchParams.get("connection_limit") || cap);
    url.searchParams.set("connection_limit", String(Number.isFinite(currentLimit) && currentLimit >= 1 ? Math.min(currentLimit, cap) : cap));
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
    if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "10");
  }
  return url.toString();
}

function createClient() {
  const log = process.env.NODE_ENV === "development" ? ["error", "warn"] as const : ["error"] as const;
  const options = { log: [...log], transactionOptions: { maxWait: 10000, timeout: 20000 } };
  if (!process.env.VERCEL) return new PrismaClient({ ...options, datasourceUrl: databaseUrl() });

  const configured = process.env.DATABASE_URL;
  if (!configured) throw new Error("DATABASE_URL is required.");
  const url = new URL(configured);
  // Preserve the existing sslmode=require (encrypted libpq) semantics for Aiven.
  // pg otherwise treats require as verify-full and rejects its private CA.
  if (url.searchParams.get("sslmode") === "require" && !url.searchParams.has("uselibpqcompat")) url.searchParams.set("uselibpqcompat", "true");
  for (const key of ["connection_limit", "pool_timeout", "connect_timeout", "pgbouncer"]) url.searchParams.delete(key);
  const pool = globalForPrisma.databasePool ?? new Pool({
    connectionString: url.toString(),
    max: 1,
    min: 0,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
    maxLifetimeSeconds: 60,
    allowExitOnIdle: true,
    application_name: "oxgen-vercel",
  });
  if (!globalForPrisma.databasePool) {
    pool.on("error", error => console.error("DATABASE_POOL_ERROR", "code" in error ? error.code : error.name));
    // Release idle connections before Fluid instances suspend, rather than
    // leaving one native-engine connection behind per suspended API instance.
    attachDatabasePool(pool);
    globalForPrisma.databasePool = pool;
  }
  return new PrismaClient({ ...options, adapter: new PrismaPg(pool, { disposeExternalPool: true }) });
}

export const prisma = globalForPrisma.prisma ?? createClient();

// Never replace a live client during hot reload; schema/client updates need a restart.
globalForPrisma.prisma = prisma;
