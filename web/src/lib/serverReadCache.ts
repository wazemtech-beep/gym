import { createHash } from "node:crypto";
import { getCurrentSession } from "./session";
import { sessionContext } from "./sessionContext";
import { readCacheRevision, invalidateServerReads } from "./readCacheRevision";
import { readCacheTtl } from "./readCachePolicy";

type Entry = { text: string; status: number; headers: [string,string][]; expires: number };
const state = globalThis as typeof globalThis & { gymReadResponses?: Map<string,Entry> };
const entries = state.gymReadResponses ||= new Map<string,Entry>();
const objects = new Map<string,{value:unknown;expires:number}>();
function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function readCacheScope(current: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>) {
  return digest(JSON.stringify([current.session.id, current.session.expiresAt, current.user.id, current.user.role, current.user.mustChangePassword, current.user.permissionGrants]));
}

export async function cachedServerRead<T>(name: string, read: () => Promise<T>, scope: string, args: unknown): Promise<T> {
  const revision = await readCacheRevision();
  if (!revision) return read();
  // Group changing "now" values into short windows for dashboard snapshots.
  const parameters = JSON.stringify(args)?.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, value => String(Math.floor(new Date(value).getTime()/10000)));
  const key = digest(JSON.stringify([name,scope,revision,parameters]));
  const saved = objects.get(key);
  if (saved && saved.expires > Date.now()) return saved.value as T;
  const value = await read();
  if (await readCacheRevision() === revision) {
    for (const [oldKey,old] of objects) if (old.expires <= Date.now()) objects.delete(oldKey);
    if (objects.size >= 300) objects.delete(objects.keys().next().value!);
    objects.set(key,{value,expires:Date.now()+15000});
  }
  return value;
}

// Authentication is checked before every server cache hit. A handler reuses that
// request's verified session; it never reuses another request's auth decision.
export function withReadCache<T extends Request, A extends unknown[]>(handler: (request: T, ...args: A) => Promise<Response>) {
  return async (request: T, ...args: A): Promise<Response> => {
    try {
    const url = new URL(request.url), method = request.method.toUpperCase();
    if (method !== "GET") {
      const response = await handler(request, ...args);
      if (response.ok) {
        let saved = true;
        if (response.headers.get("content-type")?.includes("application/json")) {
          const body = await response.clone().json().catch(() => null);
          saved = body?.success !== false;
        }
        if (saved) {
          entries.clear();
          objects.clear();
          const revision = await invalidateServerReads();
          response.headers.set("X-Gym-Revision", revision || "unavailable");
        }
      }
      return response;
    }
    const ttl = readCacheTtl(url.pathname);
    if (!ttl) return handler(request,...args);
    const current = await getCurrentSession();
    if (!current || current.user.mustChangePassword) return handler(request,...args);
    const revision = await readCacheRevision();
    const key = digest([readCacheScope(current),revision,url.pathname,url.search].join("|"));
    const entry = revision && request.headers.get("X-Gym-Fresh") !== "1" ? entries.get(key) : undefined;
    if (entry && entry.expires > Date.now()) return new Response(entry.text, { status: entry.status, headers: [...entry.headers, ["X-Gym-Read-Cache","hit"]] });
    const response = await sessionContext.run({ current }, () => handler(request,...args));
    response.headers.set("Cache-Control", "private, no-store");
    if (revision) response.headers.set("X-Gym-Revision",revision);
    if (response.ok && response.headers.get("content-type")?.includes("application/json") && !response.headers.has("set-cookie") && revision) {
      const text = await response.clone().text();
      const body = JSON.parse(text);
      if (text.length <= 512000 && body?.success !== false && await readCacheRevision() === revision) {
        for (const [oldKey, oldEntry] of entries) if (oldEntry.expires <= Date.now()) entries.delete(oldKey);
        if (entries.size >= 300) entries.delete(entries.keys().next().value!);
        entries.set(key,{ text,status:response.status,headers:Array.from(response.headers.entries()),expires:Date.now()+ttl });
      }
    }
    return response;
    } catch (cause) {
      const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
      const message = cause instanceof Error ? cause.message : "";
      const busy = ["P1001", "P1002", "P1017", "P2024", "P2037"].includes(code) || /too many.*connections|remaining connection slots|connection pool/i.test(message);
      console.error("API_REQUEST_FAILED", new URL(request.url).pathname, code || (cause instanceof Error ? cause.name : "Unknown error"));
      return Response.json({ success: false, error: busy ? "Database busy hai. Thori dair baad dobara try karein." : "Request process nahi ho saki. Dobara try karein." }, { status: busy ? 503 : 500, headers: { "Cache-Control": "no-store", ...(busy ? { "Retry-After": "10" } : {}) } });
    }
  };
}
