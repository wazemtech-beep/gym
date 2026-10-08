import { Prisma } from "@prisma/client";

/** Locks survive until transaction completion; all financial writers share the member lock. */
export async function lockMember(tx: Prisma.TransactionClient, memberId: string) {
  await tx.$queryRaw`SELECT id FROM "GymMember" WHERE id = ${memberId} FOR UPDATE`;
}

export async function lockReceiptSequence(tx: Prisma.TransactionClient, prefix: string) {
  // PostgreSQL advisory locks return void; execute without deserializing rows.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`receipt:${prefix}`}))`;
}
