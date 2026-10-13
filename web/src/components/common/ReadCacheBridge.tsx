"use client";
import { useLayoutEffect, useEffect } from "react";
import { useRouter } from "next/navigation";
import { disconnectReadCache, forceFreshReads, setReadCacheScope, updateReadRevision, requestReadCacheRevision } from "@/lib/apiFetch";
export default function ReadCacheBridge({ scope, children }: { scope: string; children: React.ReactNode }) {
  const router = useRouter();
  useLayoutEffect(() => { setReadCacheScope(scope); },[scope]);
  useEffect(() => {
    if (!scope) return;
    let poll: AbortController | null = null;
    let pendingLock: AbortController | null = null;
    let release: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 5000;
    let disposed = false;
    const open = () => {
      if (disposed || document.visibilityState !== "visible" || !navigator.onLine) return;
      poll?.abort();
      const controller = new AbortController(); poll = controller;
      const timeout = setTimeout(() => controller.abort(), 15000);
      void fetch("/api/v1/cache-sync", { cache: "no-store", signal: controller.signal })
        .then(async response => {
          if (!response.ok) throw new Error("Revision unavailable");
          const data = await response.json();
          if (controller.signal.aborted || disposed) return;
          updateReadRevision(typeof data.revision === "string" ? data.revision : null);
          retryDelay = 10000;
        })
        .catch(() => { if (poll === controller && !disposed) { disconnectReadCache(); retryDelay = Math.min(60000, retryDelay * 2); } })
        .finally(() => {
          clearTimeout(timeout);
          if (poll !== controller || disposed) return;
          poll = null;
          if (document.visibilityState === "visible" && navigator.onLine) retryTimer = setTimeout(() => { retryTimer = null; open(); }, retryDelay);
        });
    };
    const connect = () => {
      if (retryTimer) clearTimeout(retryTimer); retryTimer = null;
      pendingLock?.abort(); release?.(); release = null; poll?.abort(); poll = null;
      if (document.visibilityState !== "visible" || !navigator.onLine) { disconnectReadCache(); return; }
      requestReadCacheRevision();
      // One live connection per browser session; other tabs receive revisions
      // over BroadcastChannel rather than consuming additional HTTP connections.
      if (navigator.locks && typeof BroadcastChannel !== "undefined") {
        const controller = new AbortController(); pendingLock = controller;
        void navigator.locks.request("gym-cache-events:"+scope,{signal:controller.signal},async () => {
          if (controller.signal.aborted) return;
          open();
          await new Promise<void>(resolve => { release = resolve; });
        }).catch(() => {});
      } else open();
    };
    const refresh = () => router.refresh();
    const click = (event: MouseEvent) => {
      const button = (event.target as Element)?.closest?.("button");
      if (button && /^(refresh|reload|retry)(\s|$)/i.test(button.getAttribute("aria-label") || button.title || button.textContent?.trim() || "")) forceFreshReads();
    };
    connect();
    document.addEventListener("visibilitychange",connect); window.addEventListener("online",connect); window.addEventListener("offline",connect);
    window.addEventListener("gym:read-cache-changed",refresh); document.addEventListener("click",click,true);
    return () => { disposed = true; if (retryTimer) clearTimeout(retryTimer); pendingLock?.abort(); release?.(); poll?.abort(); disconnectReadCache(); document.removeEventListener("visibilitychange",connect); window.removeEventListener("online",connect); window.removeEventListener("offline",connect); window.removeEventListener("gym:read-cache-changed",refresh); document.removeEventListener("click",click,true); };
  },[scope,router]);
  return children;
}
