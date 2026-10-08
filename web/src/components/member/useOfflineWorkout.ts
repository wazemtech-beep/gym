"use client";
import { apiFetch } from "@/lib/apiFetch";
import { useCallback, useEffect, useState } from "react";

type PendingWorkout = { sessionId: string; [key: string]: unknown };

export default function useOfflineWorkout(memberId?: string) {
  const key = memberId ? `oxgen-workouts:${memberId}` : null;
  const [pending, setPending] = useState(0);
  const read = useCallback((): PendingWorkout[] => {
    if (!key) return [];
    try { const items = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(items) ? items : []; } catch { return []; }
  }, [key]);
  const write = useCallback((items: PendingWorkout[]) => {
    if (!key) throw new Error("Member profile is required.");
    if (items.length) localStorage.setItem(key, JSON.stringify(items)); else localStorage.removeItem(key);
    setPending(items.length);
  }, [key]);
  useEffect(() => {
    if (!key) return;
    let stopped = false, busy = false;
    const replay = async () => {
      if (busy || !navigator.onLine || stopped) return;
      busy = true;
      try {
        for (const item of read()) {
          if (stopped) break;
          const response = await apiFetch("/api/v1/member/workout/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...item, expectedMemberId: memberId }) });
          if (!response.ok) break;
          const result = await response.json();
          if (!result.success) break;
          if (!stopped) write(read().filter(saved => saved.sessionId !== item.sessionId || JSON.stringify(saved) !== JSON.stringify(item)));
        }
      } catch { /* Keep records until the next online attempt. */ }
      finally { busy = false; }
    };
    setPending(read().length);
    void replay();
    const online = () => { void replay(); };
    window.addEventListener("online", online);
    const timer = window.setInterval(online, 15000);
    return () => { stopped = true; window.clearInterval(timer); window.removeEventListener("online", online); };
  }, [key, memberId, read, write]);
  const save = async (payload: PendingWorkout) => {
    let response: Response;
    try {
      response = await apiFetch("/api/v1/member/workout/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, expectedMemberId: memberId }) });
    } catch {
      const items = read().filter(item => item.sessionId !== payload.sessionId);
      if (items.length >= 50) throw new Error("Reconnect before recording more workouts; 50 sessions are waiting.");
      write([...items, payload]);
      return { queued: true, success: true };
    }
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || "Could not save workout.");
    write(read().filter(item => item.sessionId !== payload.sessionId));
    return { ...result, queued: false };
  };
  return { save, pending };
}
