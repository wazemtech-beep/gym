import { readFile, mkdir, rename, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// A non-sensitive revision marker shared by web/worker processes on this host.
// Multiple hosts must point GYM_CACHE_REVISION_DIR at the same shared volume.
const directory = process.env.GYM_CACHE_REVISION_DIR || path.join(process.cwd(), ".gym-cache");
const marker = path.join(directory, "revision");
const health = globalThis as typeof globalThis & { gymReadCacheUnavailable?: boolean };
export async function readCacheRevision(): Promise<string | null> {
  if (health.gymReadCacheUnavailable) return null;
  try { return (await readFile(marker, "utf8")).trim() || null; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ENOENT" ? "initial" : null; }
}
export async function invalidateServerReads() {
  const revision = randomUUID();
  const temporary = path.join(directory, revision + ".tmp");
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(temporary, revision, { mode: 0o600 });
    await rename(temporary, marker);
    health.gymReadCacheUnavailable = false;
    return revision;
  } catch { health.gymReadCacheUnavailable = true; await unlink(temporary).catch(() => {}); console.error("Read cache disabled: inspect GYM_CACHE_REVISION_DIR permissions."); return null; }
}
