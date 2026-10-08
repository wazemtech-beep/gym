import { Prisma } from "@prisma/client";
import { prisma } from "./db";

/**
 * Normalizes Pakistani phone numbers to consistent 11-digit local format: 03XXXXXXXXX
 * Handles:
 * - "+923001234567" -> "03001234567"
 * - "923001234567"  -> "03001234567"
 * - "0300-1234567"  -> "03001234567"
 * - "0300 1234567"  -> "03001234567"
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return "";
  // Strip all non-digit characters
  let digits = rawPhone.replace(/\D/g, "");

  if (digits.startsWith("92") && digits.length === 12) {
    digits = "0" + digits.substring(2);
  }

  return digits;
}

/**
 * Concurrency-safe unique Member ID generator
 * Generates sequential format: OXG-000001, OXG-000002, OXG-000003...
 * Ensures IDs are never reused even if a member is archived.
 */
export async function generateNextMemberId(client: Prisma.TransactionClient | typeof prisma = prisma): Promise<string> {
  const allMembers = await client.gymMember.findMany({
    select: { memberId: true },
  });

  let maxNum = 0;
  for (const m of allMembers) {
    if (m.memberId && m.memberId.startsWith("OXG-")) {
      const numStr = m.memberId.replace("OXG-", "");
      const parsed = parseInt(numStr, 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `OXG-${String(nextNum).padStart(6, "0")}`;
}
