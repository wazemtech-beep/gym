"use client";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MemberDataSkeleton from "./MemberDataSkeleton";
import styles from "./MemberPages.module.css";

const money = (n: number) => `Rs. ${Number(n || 0).toLocaleString("en-PK")}`;
const date = (s: string) => new Date(s).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" });
const label = (s: string) => s.toLowerCase().replaceAll("_", " ");
function demoUrl(value: string) { try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : undefined; } catch { return undefined; } }

export default function MemberHistory({ section }: { section: "membership" | "payments" | "workout" | "attendance" }) {
  const readCacheVersion = useReadCacheVersion();
  const router = useRouter();
  const [data, setData] = useState<any>(null), [error, setError] = useState(""), [page, setPage] = useState(1), [busy, setBusy] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setBusy(true); setError("");
    try {
      const response = await apiFetch(`/api/v1/member/history?section=${section}&page=${page}`, { cache: "no-store", signal });
      if (response.status === 401 || response.status === 403) { setData(null); router.replace(response.status === 401 ? "/login?reason=session" : "/"); return; }
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "History unavailable.");
      if (!signal?.aborted) setData(json.data);
    } catch (cause) { if (!signal?.aborted) { setData(null); setError(cause instanceof Error ? cause.message : "History unavailable."); } }
    finally { if (!signal?.aborted) setBusy(false); }
  }, [section, page, router]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load, readCacheVersion]);
  const withdraw = async (id: string) => {
    setBusy(true);
    try { const response = await apiFetch(`/api/v1/member/renewal-request/${id}`, { method: "DELETE" }); const json = await response.json(); if (!response.ok || !json.success) throw new Error(json.error); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not withdraw request."); }
    finally { setBusy(false); }
  };
  const headings = { membership: "Membership history", payments: "Invoices & payment history", workout: "Your plan & previous sessions", attendance: "Attendance history" };
  return <section className={`glass-panel ${section === "workout" ? styles.workoutHistory : ""}`} style={{ padding: 24, margin: "24px 0" }} aria-busy={busy || (!data && !error)}>
    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}><h2>{headings[section]}</h2><button className="btn btn-secondary" disabled={busy} onClick={() => void load()}>Refresh</button></div>
    {error && <p role="alert">{error}</p>}{!data && !error && <><span className={styles.srOnly} role="status">Loading {headings[section].toLowerCase()}…</span><MemberDataSkeleton /></>}
    {data?.enabled === false && <p>Attendance history is currently disabled by your gym.</p>}
    {data && <>
      {section === "workout" && data.plan && <div style={{ margin: "20px 0" }}><h3>{data.plan.title}</h3><p>{data.plan.goal}</p>{data.plan.workoutDays.map((day: any) => <details key={day.id} style={{ marginTop: 14 }}><summary>{day.title} · {day.dayOfWeek ? label(day.dayOfWeek) : "Assigned day"}</summary>{day.exercises.map((exercise: any) => <div key={exercise.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--border-subtle)" }}><strong>{exercise.name}</strong><p>{[exercise.sets ? `${exercise.sets} sets` : "", exercise.reps ? `${exercise.reps} reps` : "", exercise.targetLoad, exercise.durationMinutes ? `${exercise.durationMinutes} minutes` : "", exercise.distanceMeters ? `${exercise.distanceMeters} m` : "", exercise.restSeconds != null ? `${exercise.restSeconds}s rest` : ""].filter(Boolean).join(" · ")}</p>{exercise.instructions && <p>{exercise.instructions}</p>}{exercise.alternativeExercise && <p>Alternative: {exercise.alternativeExercise}</p>}{exercise.demoVideoUrl && demoUrl(exercise.demoVideoUrl) && <a href={demoUrl(exercise.demoVideoUrl)} target="_blank" rel="noopener noreferrer">Watch demo</a>}</div>)}</details>)}</div>}
      {!data.rows.length && data.enabled !== false && <p style={{ marginTop: 20 }}>No records yet.</p>}
      {data.rows.map((row: any) => <details key={row.id} style={{ padding: "16px 0", borderBottom: "1px solid var(--border-subtle)" }}>
        <summary>{section === "membership" ? `${row.planName} · ${label(row.status)}` : section === "payments" ? `${row.invoiceNumber} · ${money(row.balanceAmount)} pending · ${label(row.status)}` : section === "workout" ? `${date(row.sessionDate)} · ${row.workoutDay?.title || row.plan?.title || "Workout"} · ${label(row.status)}` : `${date(row.checkIn)} · ${new Date(row.checkIn).toLocaleTimeString("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" })}`}</summary>
        {section === "membership" && <><p>{date(row.startDate)} — {date(row.endDate)}</p><p>Package fee: {money(row.feeAmount)} · Admission: {money(row.admissionFeeCharged)} · Discount: {money(row.discountApplied)}</p>{row.servicesSnapshot && <p>Includes: {row.servicesSnapshot}</p>}{row.freezeResumeDate && <p>Planned resume: {date(row.freezeResumeDate)}</p>}</>}
        {section === "payments" && <><p>{row.title} · Due {date(row.dueDate)}</p><p>Total: {money(row.totalAmount)} · Paid: {money(row.paidAmount)} · Pending: {money(row.balanceAmount)}</p>{row.lineItems.map((item: any) => <p key={item.id}>{item.description}: {money(item.amount)}</p>)}{row.installments.map((item: any) => <p key={item.id}>Installment {item.installmentNumber} · {date(item.dueDate)} · {money(Math.max(0, item.amount - item.paidAmount))} pending · {label(item.status)}</p>)}</>}
        {section === "workout" && <><p>{row.durationMinutes || 0} minutes</p>{row.exerciseLogs.map((log: any) => <p key={log.id}>{log.exerciseName} · {log.isSkipped ? "Skipped" : [log.actualReps != null ? `${log.actualReps} reps` : "", log.actualWeight != null ? `${log.actualWeight} kg` : "", log.actualDuration != null ? `${log.actualDuration} seconds` : ""].filter(Boolean).join(" · ")}</p>)}{row.trainerFeedback && <p>Coach: {row.trainerFeedback}</p>}</>}
        {section === "attendance" && <p>{row.membership?.planName || "Gym visit"} · {label(row.method)}</p>}
      </details>)}
      {section === "membership" && <><h3 style={{ marginTop: 24 }}>Renewal requests</h3>{!data.renewals.length && <p>No renewal requests.</p>}{data.renewals.map((row: any) => <div key={row.id} style={{ margin: "12px 0" }}><p>{row.feePlan.name} · {label(row.status)} · Starts {date(row.preferredStartDate)}</p>{row.rejectionReason && <p>{row.rejectionReason}</p>}{row.status === "PENDING" && <button className="btn btn-secondary" disabled={busy} onClick={() => void withdraw(row.id)}>Withdraw request</button>}</div>)}<h3 style={{ marginTop: 24 }}>Freeze requests</h3>{!data.freezes.length && <p>No freeze requests.</p>}{data.freezes.map((row: any) => <p key={row.id}>{row.requestedDays} days · {label(row.status)}{row.plannedResumeDate ? ` · Resume ${date(row.plannedResumeDate)}` : ""}{row.reviewNotes ? ` · ${row.reviewNotes}` : ""}</p>)}</>}
      {section === "payments" && <><h3 style={{ marginTop: 24 }}>Receipts</h3>{!data.receipts.length && <p>No receipts yet.</p>}{data.receipts.map((row: any) => <p key={row.id}>{date(row.paymentDate)} · {money(row.amount)} · {label(row.status)} · <a href={`/api/v1/receipts/${encodeURIComponent(row.id)}/download`}>{row.receiptNumber}</a></p>)}<h3 style={{ marginTop: 24 }}>Transfer submissions</h3>{!data.transfers.length && <p>No transfers submitted.</p>}{data.transfers.map((row: any) => <p key={row.id}>{date(row.submittedAt)} · {money(row.amount)} · {label(row.status)}{row.rejectionReason ? ` · ${row.rejectionReason}` : ""}</p>)}</>}
      {data.total > 20 && <div style={{ display: "flex", gap: 12, marginTop: 24 }}><button className="btn btn-secondary" disabled={busy || page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {Math.ceil(data.total / 20)}</span><button className="btn btn-secondary" disabled={busy || page * 20 >= data.total} onClick={() => setPage(page + 1)}>Next</button></div>}
    </>}
  </section>;
}
