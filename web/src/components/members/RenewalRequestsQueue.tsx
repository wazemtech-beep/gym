"use client";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";
import { useEffect, useState } from "react";
export default function RenewalRequestsQueue() {
  const readCacheVersion = useReadCacheVersion();
  const [rows, setRows] = useState<any[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false), [notes, setNotes] = useState<Record<string, string>>({}), [dates, setDates] = useState<Record<string, string>>({});
  const load = async () => { const response = await apiFetch("/api/v1/members/renewals?status=PENDING", { cache: "no-store" }); const json = await response.json(); if (!response.ok) throw new Error(json.error); setRows(json.data || json.requests || []); };
  useEffect(() => { void load().catch(cause => setError(cause.message)); }, [readCacheVersion]);
  const review = async (id: string, action: "APPROVE" | "REJECT") => {
    if (action === "REJECT" && !notes[id]?.trim()) { setError("Enter a reason for declining the renewal."); return; }
    setBusy(true); setError("");
    try { const response = await apiFetch(`/api/v1/members/renewals/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, rejectionReason: notes[id], startDateOverride: dates[id] ? dates[id] + "T00:00:00+05:00" : undefined }) }); const json = await response.json(); if (!response.ok) throw new Error(json.error); await load(); }
    catch(cause) { setError(cause instanceof Error ? cause.message : "Review failed."); } finally { setBusy(false); }
  };
  if (!rows.length && !error) return null;
  return <section className="glass-panel" style={{ padding: 24, marginBottom: 24 }}><h2>Renewal requests</h2>{error && <p role="alert">{error}</p>}{rows.map(row => <div key={row.id} style={{ padding: "16px 0", borderTop: "1px solid var(--border-subtle)" }}><strong>{row.gymMember.fullName} · {row.gymMember.memberId}</strong><p>{row.feePlan.name} · Requested start: {new Date(row.preferredStartDate).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}</p><label>Override start date (optional)<input type="date" className="input-field" value={dates[row.id] || ""} onChange={e => setDates({ ...dates, [row.id]: e.target.value })} /></label><label>Decline reason<input className="input-field" value={notes[row.id] || ""} onChange={e => setNotes({ ...notes, [row.id]: e.target.value })} /></label><div style={{ display: "flex", gap: 8, marginTop: 12 }}><button className="btn btn-primary" disabled={busy} onClick={() => void review(row.id, "APPROVE")}>Approve</button><button className="btn btn-secondary" disabled={busy} onClick={() => void review(row.id, "REJECT")}>Decline</button></div></div>)}</section>;
}
