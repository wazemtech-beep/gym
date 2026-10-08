"use client";
import { readCacheTtl } from "./readCachePolicy";
import { useSyncExternalStore } from "react";
type Entry = { text: string; bytes?: ArrayBuffer; status: number; headers: [string,string][]; expires: number; revision: string };
const cache = new Map<string,Entry>(), pending = new Map<string,Promise<Entry>>();
let scope = "", revision: string | null = null, lastRevision: string | null = null, generation = 0, channel: BroadcastChannel | null = null, freshUntil = 0;
const peers = new Map<string,(entry: Entry | null) => void>();
const observers = new Set<() => void>();
let visibleVersion = 0;
function notifyReaders() { visibleVersion++; for (const observer of observers) observer(); }
export function useReadCacheVersion() {
  return useSyncExternalStore(callback => { observers.add(callback); return () => observers.delete(callback); }, () => visibleVersion, () => 0);
}
function response(entry: Entry) { return new Response([204,205,304].includes(entry.status) ? null : entry.bytes || entry.text,{status:entry.status,headers:entry.headers}); }
export function clearReadCache(announce = true) {
  generation++; cache.clear(); pending.clear();
  if (announce) channel?.postMessage({type:"invalidate",scope,revision});
}
export function setReadCacheScope(value: string) {
  if (value === scope) return;
  clearReadCache(false); scope = value; revision = null; lastRevision = null;
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel("gym-read-cache");
    channel.onmessage = event => {
      const data = event.data;
      if (!data || data.scope !== scope) return;
      if (data.type === "hello" && revision) channel?.postMessage({type:"revision",scope,revision});
      if (data.type === "revision") updateReadRevision(typeof data.revision === "string" ? data.revision : null,true,false);
      if (data.type === "invalidate") { if (typeof data.revision === "string") updateReadRevision(data.revision,false); clearReadCache(false); notifyReaders(); window.dispatchEvent(new Event("gym:read-cache-changed")); }
      if (data.type === "get" && data.revision === revision) {
        const entry = cache.get(data.key);
        if (entry && entry.expires > Date.now()) channel?.postMessage({type:"entry",scope,id:data.id,entry});
      }
      if (data.type === "entry") peers.get(data.id)?.(data.entry);
    };
  }
  channel?.postMessage({type:"hello",scope});
}
export function updateReadRevision(next: string | null, announce = true, relay = true) {
  const previous = revision;
  const changed = lastRevision !== null && lastRevision !== next;
  if (revision !== next) clearReadCache(false);
  revision = next;
  if (next) lastRevision = next;
  if (relay && previous !== next) channel?.postMessage({type:"revision",scope,revision:next});
  if (changed && announce) { notifyReaders(); window.dispatchEvent(new Event("gym:read-cache-changed")); }
}
export function requestReadCacheRevision() { channel?.postMessage({type:"hello",scope}); }
export function disconnectReadCache() { revision = null; clearReadCache(false); }
export function forceFreshReads() { freshUntil = Date.now()+3000; clearReadCache(false); }
async function apiResponse(result: Response): Promise<Response> {
  if (result.ok) return result;
  // Framework/proxy failures can be HTML or empty; callers still need a JSON error.
  const text = await result.clone().text();
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return result;
  } catch { /* Replace only invalid error bodies, never successful/binary responses. */ }
  const headers = new Headers(result.headers); headers.delete("content-length"); headers.delete("content-encoding"); headers.set("content-type", "application/json");
  return new Response(JSON.stringify({ success: false, error: result.status === 401 ? "Session expired. Sign in again." : result.status === 403 ? "You do not have permission for this action." : "Server request fail ho gayi. Thori dair baad dobara try karein." }), { status: result.status, headers });
}
async function fromPeer(key: string): Promise<Entry | null> {
  if (!channel || !scope || !revision) return null;
  const id = crypto.randomUUID();
  return new Promise(resolve => {
    const finish = (entry: Entry | null) => { clearTimeout(timer); peers.delete(id); resolve(entry); };
    const timer = setTimeout(() => finish(null),50);
    peers.set(id,finish); channel!.postMessage({type:"get",scope,key,id,revision});
  });
}
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof window === "undefined") return globalThis.fetch(input,init);
  const request = new Request(new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url,window.location.href), input instanceof Request ? input : undefined);
  const method = (init?.method || request.method).toUpperCase(), url = new URL(request.url);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return globalThis.fetch(input,init);
  if (method !== "GET") {
    const result = await apiResponse(await globalThis.fetch(input,init));
    if (result.ok) {
      const body = result.headers.get("content-type")?.includes("application/json") ? await result.clone().json().catch(() => null) : null;
      if (body?.success !== false) {
        const next = result.headers.get("X-Gym-Revision");
        if (next && next !== "unavailable") updateReadRevision(next,false);
        clearReadCache();
        if (/\/auth\/(logout|login|change-password|change-email|activate|reset)/.test(url.pathname)) disconnectReadCache();
        notifyReaders(); window.dispatchEvent(new Event("gym:read-cache-changed"));
      }
    }
    return result;
  }
  const ttl = readCacheTtl(url.pathname), headers = new Headers(init?.headers || request.headers);
  const fresh = init?.cache === "reload" || Date.now() < freshUntil;
  if (fresh) headers.set("X-Gym-Fresh","1");
  if (!ttl || !scope || !revision || headers.has("authorization") || init?.credentials === "omit") return apiResponse(await globalThis.fetch(input,{...init,headers}));
  const key = scope + "|" + revision + "|" + url.pathname + url.search;
  const saved = !fresh && cache.get(key);
  if (saved && saved.expires > Date.now()) return response(saved);
  const existing = !fresh && pending.get(key);
  if (existing) return response(await existing);
  const capturedGeneration = generation;
  const capturedScope = scope;
  const work = (async (): Promise<Entry> => {
    const peer = !fresh ? await fromPeer(key) : null;
    if (peer && peer.expires > Date.now() && peer.revision === revision && capturedGeneration === generation) { cache.set(key,peer); return peer; }
    // Shared reads must not be cancelled when only one of their consumers unmounts.
    let result: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = generation;
      if (capturedScope !== scope) throw new DOMException("Account changed", "AbortError");
      result = await apiResponse(await globalThis.fetch(input,{...init,signal:null,headers}));
      if (capturedScope !== scope) throw new DOMException("Account changed", "AbortError");
      const incoming = result.headers.get("X-Gym-Revision");
      if (incoming && incoming !== revision) updateReadRevision(incoming);
      if (before === generation) break;
      result = undefined;
    }
    if (!result) throw new Error("Data changed while loading. Please retry.");
    if (result.status === 401 || result.status === 403) clearReadCache();
    const jsonResponse = result.headers.get("content-type")?.includes("application/json");
    const entry: Entry = {text:jsonResponse ? await result.text() : "",bytes:jsonResponse ? undefined : await result.arrayBuffer(),status:result.status,headers:Array.from(result.headers.entries()),expires:Date.now()+ttl,revision:revision || ""};
    const serverRevision = result.headers.get("X-Gym-Revision");
    let success = Boolean(jsonResponse);
    if (result.headers.get("content-type")?.includes("application/json")) { try { success = JSON.parse(entry.text)?.success !== false; } catch { success = false; } }
    if (result.ok && success && entry.text.length <= 512000 && capturedGeneration === generation && (!serverRevision || serverRevision === revision)) {
      for (const [oldKey,old] of cache) if (old.expires <= Date.now()) cache.delete(oldKey);
      if (cache.size >= 150) cache.delete(cache.keys().next().value!);
      cache.set(key,entry);
    }
    return entry;
  })();
  if (!fresh) pending.set(key,work);
  try { return response(await work); }
  finally { if (pending.get(key) === work) pending.delete(key); }
}
