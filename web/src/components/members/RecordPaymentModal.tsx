"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch } from "@/lib/apiFetch";

import React, { useState } from "react";
import { X, DollarSign, Receipt, AlertTriangle, CheckCircle2, Building, CreditCard, Printer } from "lucide-react";
import ReceiptModal from "@/components/receipts/ReceiptModal";
import { karachiDateInput } from "@/lib/businessDates";

interface RecordPaymentModalProps {
  isOpen: boolean;
  member: any;
  invoices: any[];
  onClose: () => void;
  onSuccess: (receipt: any) => void;
}

export default function RecordPaymentModal({
  isOpen,
  member,
  invoices,
  onClose,
  onSuccess,
}: RecordPaymentModalProps) {
  const unpaidInvoices = invoices.filter((inv) => inv.balanceAmount > 0);
  const defaultInvoice = unpaidInvoices[0] || null;

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(defaultInvoice ? defaultInvoice.id : "");
  const [amount, setAmount] = useState<string>(defaultInvoice ? defaultInvoice.balanceAmount.toString() : "5000");
  const [method, setMethod] = useState<string>("CASH");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptResult, setReceiptResult] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  const [paymentDate, setPaymentDate] = useState(karachiDateInput);
  const [backdateReason, setBackdateReason] = useState("");
  const [splitAmounts, setSplitAmounts] = useState<Record<string, string>>({});
  const [manualSplit, setManualSplit] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch("/api/v1/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymMemberId: member.id,
          invoiceId: selectedInvoiceId || undefined,
          amount: parseFloat(amount),
          method,
          referenceNumber: referenceNumber || undefined,
          notes: notes || undefined,
          idempotencyKey,
          paymentDate: `${paymentDate}T00:00:00+05:00`,
          backdateReason,
          customAllocations: manualSplit ? unpaidInvoices.filter(inv => Number(splitAmounts[inv.id]) > 0).map(inv => ({ invoiceId: inv.id, amount: Number(splitAmounts[inv.id]) })) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Payment record karne mein khata aayi.");
      }

      setReceiptResult(data);
      onSuccess(data);
    } catch (err: any) {
      setError(err.message || "Failed to record payment.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (receiptResult) setIdempotencyKey(`pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
    setReceiptResult(null);
    setShowReceiptModal(false);
    setError(null);
    onClose();
  };

  return (
    <ModalOverlay className="modal-backdrop" role="dialog" aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "var(--overlay)",
        backdropFilter: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "20px",
      }}
    >
      <div
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: "520px",
          borderRadius: "16px",
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-surface)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "var(--accent-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-primary)",
              }}
            >
              <DollarSign size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                {receiptResult ? "Payment Confirmed!" : "Record Member Payment"}
              </h2>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "2px 0 0" }}>
                Member: {member.fullName} ({member.memberId})
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "6px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {receiptResult ? (
          <div style={{ padding: "28px 24px", textAlign: "center" }}>
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                background: "var(--accent-soft)",
                color: "var(--accent-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                border: "1px solid var(--border-accent)",
              }}
            >
              <CheckCircle2 size={30} />
            </div>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px" }}>
              Rs. {receiptResult.payment?.amount?.toLocaleString()} Wasool Ho Gaye!
            </h3>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "var(--accent-primary)",
                padding: "6px 14px",
                borderRadius: "8px",
                background: "var(--accent-soft)",
                display: "inline-block",
                marginBottom: "12px",
              }}
            >
              Receipt #: {receiptResult.receiptNumber}
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0 0 24px" }}>
              
              Payment confirmed. Dues updated.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setShowReceiptModal(true)}
                className="btn-primary"
                style={{ padding: "10px 20px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Printer size={16} />
                Print / View Receipt
              </button>
              <button onClick={handleClose} className="btn-secondary" style={{ padding: "10px 20px" }}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
            <label className="form-label">Payment date<input className="input-field" type="date" required max={karachiDateInput()} value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></label>
            {paymentDate < karachiDateInput() && <label className="form-label">Backdate reason<input className="input-field" required value={backdateReason} onChange={e => setBackdateReason(e.target.value)} /></label>}
            <label><input type="checkbox" checked={manualSplit} onChange={e => setManualSplit(e.target.checked)} /> Choose invoice allocations</label>
            {manualSplit && unpaidInvoices.map(inv => <label className="form-label" key={inv.id}>{inv.invoiceNumber} · Due Rs. {inv.balanceAmount.toLocaleString()}<input className="input-field" type="number" min="0" max={inv.balanceAmount} step="0.01" value={splitAmounts[inv.id] || ""} onChange={e => setSplitAmounts({ ...splitAmounts, [inv.id]: e.target.value })} /></label>)}
            {error && (
              <div
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  background: "var(--danger-soft)",
                  border: "1px solid var(--danger-border)",
                  color: "var(--danger)",
                  fontSize: "0.85rem",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <AlertTriangle size={16} />
                {error}
              </div>
            )}

            {unpaidInvoices.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Against Invoice
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => {
                    setSelectedInvoiceId(e.target.value);
                    const inv = unpaidInvoices.find((i) => i.id === e.target.value);
                    if (inv) setAmount(inv.balanceAmount.toString());
                  }}
                  className="input-field"
                  style={{ width: "100%" }}
                >
                  <option value="">General payment</option>
                  {unpaidInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} - {inv.title} (Balance: Rs. {inv.balanceAmount.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Amount Received (PKR) <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input-field"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Payment Method <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="input-field"
                  style={{ width: "100%" }}
                >
                  <option value="CASH">Cash in Hand (Desk Drawer)</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="EASYPAISA">Easypaisa</option>
                  <option value="JAZZCASH">JazzCash</option>
                  {member?.advanceBalance > 0 && (
                    <option value="ADVANCE_CREDIT">
                      Advance Credit (Rs. {member.advanceBalance.toLocaleString()} Available)
                    </option>
                  )}
                </select>
              </div>
            </div>

            {method === "ADVANCE_CREDIT" && (
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  color: "#10b981",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  marginBottom: "16px",
                }}
              >
                Yeh payment member ke pehle se jamashuda Advance Credit (Rs. {member.advanceBalance.toLocaleString()}) se deduct hogi. Drawer mein cash record nahi hoga.
              </div>
            )}

            {method !== "CASH" && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  
                  Transaction reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. MEZN-8923412 or Easypaisa TID"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="input-field"
                  style={{ width: "100%" }}
                />
              </div>
            )}

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                
                Note (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Paid at reception desk"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-field"
                style={{ width: "100%" }}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "12px",
              }}
            >
              <button type="button" onClick={handleClose} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn-primary" style={{ padding: "8px 20px" }}>
                {loading ? "Recording..." : "Record Payment & Issue Receipt"}
              </button>
            </div>
          </form>
        )}
      </div>

      {receiptResult && (
        <ReceiptModal
          receiptId={receiptResult.payment?.id || receiptResult.receiptNumber}
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
        />
      )}
    </ModalOverlay>
  );
}
