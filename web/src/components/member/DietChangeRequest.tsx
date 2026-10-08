"use client";
import { apiFetch } from "@/lib/apiFetch";
import { useRef, useState } from "react";
import styles from "./MemberPages.module.css";

export default function DietChangeRequest() {
  const [open, setOpen] = useState(false), [reason, setReason] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  return <section className={`glass-panel ${styles.requestCard}`}>
    <div className={styles.requestHeading}><h3>Diet change request</h3><button type="button" className="btn-secondary" disabled={busy} aria-expanded={open} aria-controls="diet-change-form" onClick={() => { setOpen(!open); setMessage(""); }}>{open ? "Cancel request" : "Request diet change"}</button></div>
    {open && <form id="diet-change-form" className={styles.requestForm} onSubmit={async event => {
      event.preventDefault(); if (submitting.current) return;
      if (!reason.trim()) { setMessage("Please describe the change you need."); return; }
      submitting.current = true; setBusy(true); setMessage("");
      try {
        const response = await apiFetch("/api/v1/member/diet/change-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason.trim() }) });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Could not submit your request.");
        setMessage(data.message || "Your request has been sent to your trainer."); setReason(""); setOpen(false);
      } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not reach the server."); }
      finally { submitting.current = false; setBusy(false); }
    }}><label htmlFor="diet-change-reason">What would you like changed?<textarea id="diet-change-reason" className="input-field" required maxLength={2000} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} /></label><button type="submit" className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send request"}</button></form>}
    {message && <p role="status" style={{ marginTop: 14 }}>{message}</p>}
  </section>;
}
