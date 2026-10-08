"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch } from "@/lib/apiFetch";

import { useState } from "react";
import { karachiDateInput } from "@/lib/businessDates";
import { PlusCircle, X, CreditCard, DollarSign, AlertCircle, CheckCircle } from "lucide-react";

interface MemberOption {
  id: string;
  memberId: string;
  fullName: string;
}

interface AccountOption {
  id: string;
  displayName: string;
  type: string;
}

interface RecordPaymentModalProps {
  members: MemberOption[];
  accounts: AccountOption[];
  onSuccess: () => void;
}

export default function RecordPaymentModal({ members, accounts, onSuccess }: RecordPaymentModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [gymMemberId, setGymMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [receivingAccountId, setReceivingAccountId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState(karachiDateInput);
  const [backdateReason, setBackdateReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => `pay_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gymMemberId || !amount) {
      setError("Member aur payment amount lazmi select karein.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/v1/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymMemberId,
          amount: parseFloat(amount),
          method,
          receivingAccountId: receivingAccountId || undefined,
          referenceNumber: referenceNumber || undefined,
          notes: notes || undefined,
          idempotencyKey,
          paymentDate: `${paymentDate}T00:00:00+05:00`,
          backdateReason,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Payment record karne mein masla aaya.");
        setLoading(false);
        return;
      }

      setSuccessMsg(data.message);
      setIdempotencyKey(`pay_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      setLoading(false);
      setTimeout(() => {
        setIsOpen(false);
        setSuccessMsg(null);
        setGymMemberId("");
        setAmount("");
        setReferenceNumber("");
        setNotes("");
        onSuccess();
      }, 1500);
    } catch {
      setError("Server se rabta nahi ho saka.");
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-primary"
        style={{ fontSize: "0.88rem", padding: "10px 18px" }}
      >
        <PlusCircle size={16} />
        <span>Record payment</span>
      </button>

      {isOpen && (
        <ModalOverlay className="modal-backdrop" role="dialog" aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--overlay)",
            backdropFilter: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: "100%",
              maxWidth: "520px",
              padding: "32px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-accent)",
              position: "relative",
            }}
          >
            <button
              onClick={() => setIsOpen(false)}
              style={{
                position: "absolute",
                top: "18px",
                right: "18px",
                background: "transparent",
                border: "none",
                color: "var(--text-dim)",
                cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <DollarSign size={20} color="var(--accent-primary)" />
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Record payment</h3>
            </div>
            

            {error && (
              <div className="alert-error">
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="alert-success">
                <CheckCircle size={16} style={{ flexShrink: 0 }} />
                <span>{successMsg}</span>
              </div>
            )}

            {!successMsg && (
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Member Muntakhab Karein</label>
                  <select
                    className="form-input"
                    value={gymMemberId}
                    onChange={(e) => setGymMemberId(e.target.value)}
                    required
                  >
                    <option value="">-- Member Select Karein --</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.memberId})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px" }}>
                  <div className="form-group">
                    <label className="form-label">Amount (PKR)</label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      className="form-input"
                      placeholder="e.g. 2000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-input"
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                    >
                      <option value="CASH">Cash</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="EASYPAISA">Easypaisa</option>
                      <option value="JAZZCASH">JazzCash</option>
                    </select>
                  </div>
                </div>

                {method !== "CASH" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px" }}>
                    <div className="form-group">
                      <label className="form-label">Receiving Account</label>
                      <select
                        className="form-input"
                        value={receivingAccountId}
                        onChange={(e) => setReceivingAccountId(e.target.value)}
                      >
                        <option value="">-- Account Select Karein --</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.displayName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Transaction Reference #</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="TRX-12345"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Payment date<input className="input-field" type="date" required max={karachiDateInput()} value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></label>
                  {paymentDate < karachiDateInput() && <label className="form-label">Backdate reason<input className="input-field" required value={backdateReason} onChange={e => setBackdateReason(e.target.value)} /></label>}
                  <label className="form-label">Zaroori Note (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. October partial payment"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="btn-secondary"
                    style={{ flex: 1, padding: "12px" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ flex: 1, padding: "12px" }}
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Confirm & Issue Receipt"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
