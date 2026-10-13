import { randomUUID } from "node:crypto";
import { prisma } from "./db";

export async function acquireJobLease(key: string, seconds = 330) {
  const owner = randomUUID();
  const duration = Math.max(1, Math.min(3600, Math.floor(seconds)));
  const rows = await prisma.$queryRaw<Array<{ value: string }>>`
    INSERT INTO "RuntimeState" ("key", "value", "expiresAt", "updatedAt")
    VALUES (${key}, ${owner}, NOW() + ${duration} * INTERVAL '1 second', NOW())
    ON CONFLICT ("key") DO UPDATE
      SET "value" = EXCLUDED."value", "expiresAt" = EXCLUDED."expiresAt", "updatedAt" = NOW()
      WHERE "RuntimeState"."expiresAt" IS NULL OR "RuntimeState"."expiresAt" <= NOW()
    RETURNING "value"`;
  return rows[0]?.value === owner ? owner : null;
}

export async function releaseJobLease(key: string, owner: string) {
  // An expired invocation cannot remove its replacement's lease.
  await prisma.runtimeState.deleteMany({ where: { key, value: owner } });
}
