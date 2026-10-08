"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch } from "@/lib/apiFetch";
import { useState } from "react";

export default function InvoiceCreditNote({ invoiceId, onSuccess }: { invoiceId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false), [amount, setAmount] = useState(""), [reason, setReason] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [key, setKey] = useState("");
  return <><button className="btn-secondary" onClick={() => { setOpen(true); setError(""); setKey(crypto.randomUUID()); }}>Credit note</button>{open && <ModalOverlay className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Invoice credit note"><form className="glass-panel" style={{ padding: 24, maxWidth: 480 }} onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError("");
    try { const res = await apiFetch(`/api/v1/invoices/${invoiceId}/credit-note`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(amount), reason, requestKey: key }) }); const data = await res.json(); if (!res.ok || !data.success) throw new Error(data.error || "Could not issue credit note."); setOpen(false); onSuccess(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not issue credit note."); } finally { setBusy(false); }
  }}><h2>Issue credit note</h2><label className="form-label">Credit (PKR)<input className="input-field" type="number" min="0.01" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} /></label><label className="form-label">Reason<textarea className="input-field" required value={reason} onChange={e => setReason(e.target.value)} /></label>{error && <p role="alert">{error}</p>}<p>Paid amounts require a refund or reallocation review.</p><a href="/admin/payments">Review payments and refunds</a><div className="section-toolbar"><button className="btn-primary" disabled={busy}>Issue credit note</button><button className="btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button></div></form></ModalOverlay>}</>;
}
