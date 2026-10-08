"use client";
import { apiFetch } from "@/lib/apiFetch";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./AccountForms.module.css";
export default function AccountEmailChange() {
  const [open, setOpen] = useState(false), [email, setEmail] = useState(""), [password, setPassword] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLFormElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);
  busyRef.current = busy;
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLInputElement>("input")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) { setOpen(false); setPassword(""); }
      if (event.key === "Tab") {
        const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>("input:not(:disabled), button:not(:disabled)") || []);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", keydown); trigger.current?.focus(); };
  }, [open]);
  return <>
    <button type="button" ref={trigger} className="btn-secondary" onClick={() => { setOpen(true); setMessage(""); }}>Change login email</button>
    {open && createPortal(<div className={styles.overlay} onMouseDown={event => { if (event.target === event.currentTarget && !busy) { setOpen(false); setPassword(""); } }}>
      <form ref={dialog} className={`${styles.dialog} glass-panel`} role="dialog" aria-modal="true" aria-labelledby="email-change-title" aria-busy={busy} onSubmit={async event => {
        event.preventDefault(); if (busy) return; setBusy(true); setMessage("");
        try {
          const res = await apiFetch("/api/auth/change-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
          const data = await res.json(); setMessage(data.message || data.error || "Could not request verification.");
          if (res.ok && data.success) setPassword("");
        } catch { setMessage("Could not reach the server."); } finally { setBusy(false); }
      }}>
        <h2 id="email-change-title" className={styles.heading}>Change login email</h2>
        <label className={styles.field} htmlFor="email-change-address">New email<input id="email-change-address" className="form-input" type="email" autoComplete="email" maxLength={254} required disabled={busy} value={email} onChange={event => setEmail(event.target.value)} /></label>
        <label className={styles.field} htmlFor="email-change-password">Current password<input id="email-change-password" className="form-input" type="password" autoComplete="current-password" maxLength={128} required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} /></label>
        {message && <p className={styles.status} role="status">{message}</p>}
        <div className={styles.actions}><button className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send verification"}</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => { setOpen(false); setPassword(""); }}>Close</button></div>
      </form>
    </div>, document.body)}
  </>;
}
