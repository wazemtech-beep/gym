import { randomUUID } from "node:crypto";
import { prisma } from "./db";

const key = "read-cache-revision";
// All instances share this indexed row. Storage failures disable caching.
export async function readCacheRevision(): Promise<string | null> {
  try {
    const row = await prisma.runtimeState.findUnique({ where: { key }, select: { value: true } });
    return row?.value || null;
  } catch { return null; }
}
export async function invalidateServerReads() {
  try {
    const row = await prisma.runtimeState.upsert({ where: { key }, create: { key, value: randomUUID() }, update: { value: randomUUID() } });
    return row.value;
  } catch { console.error("Read cache disabled: shared revision storage unavailable."); return null; }
}
