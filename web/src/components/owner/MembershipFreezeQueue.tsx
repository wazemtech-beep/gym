"use client";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import { useEffect, useState } from "react";

type Request = { id: string; requestedDays: number; reason: string; gymMember: { fullName: string; memberId: string }; membership: { planName: string } };

export default function MembershipFreezeQueue() {
  const readCacheVersion = useReadCacheVersion();
  const [rows, setRows] = useState<Request[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const load = async () => {
    try {
      const response = await apiFetch("/api/v1/membership/freeze-requests?status=PENDING");
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not load freeze requests.");
      setRows(data.data || []);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load freeze requests."); }
  };
  useEffect(() => { void load(); }, [readCacheVersion]);
  const review = async (row: Request, action: "APPROVE" | "REJECT") => {
    if (action === "REJECT" && !notes[row.id]?.trim()) { setError("Enter a reason for declining this request."); return; }
    setBusy(row.id);
    setError("");
    try {
      const response = await apiFetch(`/api/v1/membership/freeze-requests/${row.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewNotes: notes[row.id], freezeStartDate: dates[row.id] || undefined }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not review this request.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not review this request."); }
    finally { setBusy(null); }
  };
  if (!rows.length && !error) return null;
  return <section className="glass-panel" style={{ padding: 24, marginBottom: 24 }}>
    <h3>Membership freeze requests</h3>
    {error && <p role="alert">{error}</p>}
    {rows.map(row => <div key={row.id} style={{ padding: "16px 0", borderTop: "1px solid var(--border-color)" }}>
      <strong>{row.gymMember.fullName} · {row.gymMember.memberId}</strong>
      <p>{row.membership.planName} · {row.requestedDays} days — {row.reason}</p>
      <label className="field-label">Start date (leave blank to start now)
        <input className="input-field" type="date" value={dates[row.id] || ""} onChange={event => setDates({ ...dates, [row.id]: event.target.value })} />
      </label>
      <label className="field-label">Review note
        <input className="input-field" value={notes[row.id] || ""} onChange={event => setNotes({ ...notes, [row.id]: event.target.value })} />
      </label>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" disabled={busy !== null} onClick={() => void review(row, "APPROVE")}>{busy === row.id ? "Saving…" : "Approve"}</button>
        <button className="btn btn-secondary" disabled={busy !== null} onClick={() => void review(row, "REJECT")}>Decline</button>
      </div>
    </div>)}
  </section>;
}
