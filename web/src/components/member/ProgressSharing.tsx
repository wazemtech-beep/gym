"use client";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";
import { useEffect, useState } from "react";
import MemberDataSkeleton from "./MemberDataSkeleton";
type Assignment = { id: string; consentMeasurements: boolean; trainer: { name: string } };
export default function ProgressSharing() {
  const readCacheVersion = useReadCacheVersion();
  const [loaded, setLoaded] = useState(false);
  const [assignment, setAssignment] = useState<Assignment | null>(null), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { const controller = new AbortController(); apiFetch("/api/v1/member/progress/sharing", { cache: "no-store", signal: controller.signal }).then(async response => { const json = await response.json(); if (!response.ok) throw new Error(json.error); if (!controller.signal.aborted) setAssignment(json.data); }).catch(cause => { if (!controller.signal.aborted) setMessage(cause.message); }).finally(() => { if (!controller.signal.aborted) setLoaded(true); }); return () => controller.abort(); }, [readCacheVersion]);
  const change = async (enabled: boolean) => {
    if (!assignment || busy) return;
    setBusy(true); setMessage("");
    try { const response = await apiFetch("/api/v1/member/progress/sharing", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, assignmentId: assignment.id }) }); const json = await response.json(); if (!response.ok) throw new Error(json.error); setAssignment(json.data); setMessage(enabled ? "Progress sharing enabled." : "Progress sharing revoked."); }
    catch(cause) { setMessage(cause instanceof Error ? cause.message : "Sharing update failed."); } finally { setBusy(false); }
  };
  return <section className="glass-panel" style={{ padding: 24, marginBottom: 24 }}><h3>Trainer access</h3>{!loaded ? <MemberDataSkeleton rows={1} /> : assignment ? <><label style={{ display: "flex", gap: 12, marginTop: 12 }}><input type="checkbox" checked={assignment.consentMeasurements} disabled={busy} onChange={e => void change(e.target.checked)} />Share body measurements with {assignment.trainer.name}</label><p style={{ marginTop: 12, color: "var(--text-muted)" }}>Photos also need their individual sharing switch turned on.</p></> : <p>No active trainer assignment.</p>}{message && <p role="status">{message}</p>}</section>;
}
