"use client";
import { apiFetch } from "@/lib/apiFetch";
import { useState } from "react";

export default function OpenCashSession({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("0");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <div>
    <button className="btn-secondary" onClick={() => setOpen(!open)}>Open cash drawer</button>
    {open && <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError("");
      try {
        const res = await apiFetch("/api/v1/cash-session/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ openingCash: Number(amount) }) });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Could not open drawer.");
        setOpen(false); onSuccess();
      } catch (err) { setError(err instanceof Error ? err.message : "Could not open drawer."); }
      finally { setBusy(false); }
    }}>
      <label>Opening cash (PKR)<input className="input-field" type="number" min="0" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? "Opening…" : "Start shift"}</button>
    </form>}
  </div>;
}
