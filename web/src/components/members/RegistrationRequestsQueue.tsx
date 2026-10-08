"use client";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./RegistrationRequests.module.css";
type RequestRow = { id: string; fullName: string; email: string; phone: string; photoUrl: string | null; joiningDate: string | null; dateOfBirth: string | null; address: string | null; emergencyContactName: string | null; emergencyContactPhone: string | null; fitnessGoal: string | null; limitations: string | null; createdAt: string; status: string; rejectionReason: string | null; memberRecordId: string | null };
export default function RegistrationRequestsQueue() {
  const readCacheVersion = useReadCacheVersion();
  const [rows, setRows] = useState<RequestRow[]>([]), [status, setStatus] = useState("PENDING"), [page, setPage] = useState(1), [pages, setPages] = useState(1), [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState(""), [reasons, setReasons] = useState<Record<string,string>>({});
  const active = useRef(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      // Keep transport independent of component cleanup; the signal only guards stale UI updates.
      const response = await apiFetch(`/api/v1/member-registrations?status=${status}&page=${page}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not load requests.");
      if (signal?.aborted) return;
      setRows(data.requests); setCount(data.count); setPages(Math.max(1,data.totalPages));
      if (page > Math.max(1,data.totalPages)) setPage(Math.max(1,data.totalPages));
    } catch (cause) {
      if (!signal?.aborted) throw cause;
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [status,page]);
  useEffect(() => { const controller = new AbortController(); setError(""); void load(controller.signal).catch(cause => { if (!controller.signal.aborted) setError(cause.message); }); return () => controller.abort(); }, [load, readCacheVersion]);
  async function review(id: string, action: "APPROVE" | "REJECT") {
    if (active.current) return;
    if (action === "REJECT" && !reasons[id]?.trim()) { setError("Enter a reason for declining this request."); return; }
    active.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const response = await apiFetch(`/api/v1/member-registrations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason: reasons[id] || "" }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Review failed.");
      setMessage(data.message); window.dispatchEvent(new Event("gym:members-changed")); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review failed."); }
    finally { active.current = false; setBusy(false); }
  }
  return <section className={`${styles.panel} glass-panel`} aria-busy={busy || loading}>
    <div className={styles.toolbar}><h2>Registration requests <span>({count})</span></h2><div className={styles.filters}>
      <select className="form-input" aria-label="Registration status" style={{ width: "auto" }} value={status} disabled={busy} onChange={event => { setStatus(event.target.value); setPage(1); setMessage(""); }}><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Declined</option></select>
      <button type="button" className="btn-secondary" disabled={busy || loading} onClick={() => { setError(""); void load().catch(cause => setError(cause.message)); }}>Refresh</button>
    </div></div>
    {error && <p role="alert" className={styles.message}>{error}</p>}{message && <p role="status" className={styles.message}>{message}</p>}
    {loading ? <p role="status">Loading requests…</p> : !rows.length ? <p className={styles.meta}>No {status.toLowerCase()} requests.</p> : rows.map(row => <article key={row.id} className={styles.request}>
      <h3>{row.fullName}</h3><p className={styles.meta}>{row.email} · {row.phone} · {new Date(row.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}</p>
      <details><summary>View applicant details</summary><dl className={styles.details}>
        {row.photoUrl && <div><dt>Photo</dt><dd><img src={row.photoUrl} alt={`${row.fullName} profile`} width={56} height={56} style={{ objectFit: "cover", borderRadius: 10 }} /></dd></div>}
        <div><dt>Joining date</dt><dd>{row.joiningDate ? new Date(row.joiningDate).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" }) : "—"}</dd></div>
        <div><dt>Date of birth</dt><dd>{row.dateOfBirth?.slice(0,10) || "—"}</dd></div><div><dt>Address</dt><dd>{row.address || "—"}</dd></div>
        <div><dt>Emergency contact</dt><dd>{[row.emergencyContactName,row.emergencyContactPhone].filter(Boolean).join(" · ") || "—"}</dd></div>
        <div><dt>Fitness goal</dt><dd>{row.fitnessGoal || "—"}</dd></div><div><dt>Injuries or limitations</dt><dd>{row.limitations || "—"}</dd></div>
      </dl></details>
      {row.status === "PENDING" && <div className={styles.decision}><label htmlFor={`registration-reason-${row.id}`}>Decline reason<input id={`registration-reason-${row.id}`} className="form-input" maxLength={500} disabled={busy} value={reasons[row.id] || ""} onChange={event => setReasons(previous => ({ ...previous, [row.id]: event.target.value }))} /></label><div className={styles.actions}><button type="button" className="btn-primary" disabled={busy} onClick={() => void review(row.id,"APPROVE")}>Approve account</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => void review(row.id,"REJECT")}>Decline</button></div></div>}
      {row.rejectionReason && <p className={styles.meta}>Reason: {row.rejectionReason}</p>}
      {row.memberRecordId && <Link href={`/admin/members/${row.memberRecordId}`}>Open member</Link>}
    </article>)}
    {pages > 1 && <div className={styles.actions}><button type="button" className="btn-secondary" disabled={busy || loading || page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>{page} / {pages}</span><button type="button" className="btn-secondary" disabled={busy || loading || page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>}
  </section>;
}
