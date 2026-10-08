"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch } from "@/lib/apiFetch";

import React, { useState } from "react";
import { X, RotateCcw, AlertCircle, CheckCircle2, DollarSign } from "lucide-react";
import { PaymentMethod } from "@prisma/client";

interface RecordRefundModalProps {
  isOpen: boolean;
  payment: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RecordRefundModal({
  isOpen,
  payment,
  onClose,
  onSuccess,
}: RecordRefundModalProps) {
  if (!isOpen || !payment) return null;

  const previousRefunds = payment.refunds || [];
  const alreadyRefunded = previousRefunds.reduce((sum: number, r: any) => sum + r.amount, 0);
  const maxRefundable = Math.max(0, payment.amount - alreadyRefunded);

  const [refundAmount, setRefundAmount] = useState<number>(maxRefundable);
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [feeObligationTreatment, setFeeObligationTreatment] = useState<"KEEP_FEE_DUE" | "CANCEL_OBLIGATION">("KEEP_FEE_DUE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refundId, setRefundId] = useState<string | null>(null);
  const [successVoucher, setSuccessVoucher] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!refundAmount || refundAmount <= 0) {
      setError("Durust refund raqam darj karein.");
      return;
    }

    if (refundAmount > maxRefundable) {
      setError(`Raqam zyada se zyada Rs. ${maxRefundable.toLocaleString()} ho sakti hai.`);
      return;
    }

    if (!reason.trim()) {
      setError("Refund ki wajah (reason) likhna lazmi hai.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/v1/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id,
          amount: refundAmount,
          reason: reason.trim(),
          refundMethod,
          feeObligationTreatment,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Refund record karne mein masla aaya.");
        setLoading(false);
        return;
      }

      setSuccessVoucher(data.refundVoucherNumber);
      setRefundId(data.refund.id);
      setLoading(false);
      onSuccess();
    } catch {
      setError("Server se rabta nahi ho saka. Dobara koshish karein.");
      setLoading(false);
    }
  };

  return (
    <ModalOverlay
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--overlay)",
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
          padding: "28px",
          background: "var(--bg-surface)",
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <X size={18} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "var(--danger-soft)",
              color: "var(--danger)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <RotateCcw size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Record Member Refund</h3>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Issue formal monetary refund against confirmed payment
            </span>
          </div>
        </div>

        {/* Payment Summary Box */}
        <div
          style={{
            background: "var(--bg-secondary)",
            borderRadius: "10px",
            padding: "14px 16px",
            marginTop: "16px",
            marginBottom: "20px",
            border: "1px solid var(--border-subtle)",
            fontSize: "0.82rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: "var(--text-muted)" }}>Receipt #:</span>
            <strong style={{ fontFamily: "var(--font-mono)" }}>{payment.receiptNumber}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: "var(--text-muted)" }}>Member:</span>
            <strong>{payment.gymMember?.fullName || "Member"}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: "var(--text-muted)" }}>Original Amount:</span>
            <span>Rs. {payment.amount?.toLocaleString()}</span>
          </div>
          {alreadyRefunded > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", color: "var(--danger)" }}>
              <span>Already Refunded:</span>
              <span>- Rs. {alreadyRefunded.toLocaleString()}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--border-subtle)", paddingTop: "6px", marginTop: "6px" }}>
            <span style={{ fontWeight: 600 }}>Max Refundable Available:</span>
            <strong style={{ color: "var(--accent-primary)" }}>Rs. {maxRefundable.toLocaleString()}</strong>
          </div>
        </div>

        {refundId && <a className="btn-secondary" href={`/api/v1/refunds/${refundId}/download`} target="_blank" rel="noreferrer">Print refund acknowledgement</a>}
        {error && (
          <div className="alert-error" role="alert" style={{ marginBottom: "16px" }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successVoucher && (
          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              background: "var(--accent-soft)",
              border: "1px solid var(--border-accent)",
              color: "var(--accent-primary)",
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            <CheckCircle2 size={32} style={{ margin: "0 auto 8px" }} />
            <h4 style={{ margin: "0 0 4px" }}>Refund Processed!</h4>
            <p style={{ fontSize: "0.82rem", margin: 0 }}>
              Voucher Number: <strong>{successVoucher}</strong>
            </p>
          </div>
        )}

        {!successVoucher && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="refund-amount">
                Refund Amount (PKR) *
              </label>
              <input
                id="refund-amount"
                type="number"
                min={1}
                max={maxRefundable}
                step="any"
                className="form-input"
                value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value))}
                disabled={loading || Boolean(successVoucher)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="refund-method">
                Disbursement Method
              </label>
              <select
                id="refund-method"
                className="form-input"
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value as PaymentMethod)}
                disabled={loading}
              >
                <option value={PaymentMethod.CASH}>Cash (Reduces Cash Drawer)</option>
                <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
                <option value={PaymentMethod.EASYPAISA}>Easypaisa</option>
                <option value={PaymentMethod.JAZZCASH}>JazzCash</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Fee Obligation Treatment (Requirement Point 233)
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid",
                    borderColor: feeObligationTreatment === "KEEP_FEE_DUE" ? "var(--border-accent)" : "var(--border-subtle)",
                    background: feeObligationTreatment === "KEEP_FEE_DUE" ? "var(--accent-soft)" : "transparent",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                  }}
                >
                  <input
                    type="radio"
                    name="obligation"
                    checked={feeObligationTreatment === "KEEP_FEE_DUE"}
                    onChange={() => setFeeObligationTreatment("KEEP_FEE_DUE")}
                    style={{ marginTop: "2px" }}
                  />
                  <div>
                    <strong>Keep Fee Due (Re-open Invoice Balance)</strong>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.76rem" }}>
                      Member took their money back; fee remains unpaid and will show in outstanding dues.
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid",
                    borderColor: feeObligationTreatment === "CANCEL_OBLIGATION" ? "var(--border-accent)" : "var(--border-subtle)",
                    background: feeObligationTreatment === "CANCEL_OBLIGATION" ? "var(--accent-soft)" : "transparent",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                  }}
                >
                  <input
                    type="radio"
                    name="obligation"
                    checked={feeObligationTreatment === "CANCEL_OBLIGATION"}
                    onChange={() => setFeeObligationTreatment("CANCEL_OBLIGATION")}
                    style={{ marginTop: "2px" }}
                  />
                  <div>
                    <strong>Cancel Obligation (Waive / Forgive Due)</strong>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.76rem" }}>
                      Plan or membership was cancelled; member will NOT owe this fee in outstanding dues.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="refund-reason">
                Reason for Refund *
              </label>
              <textarea
                id="refund-reason"
                className="form-input"
                rows={2}
                placeholder="e.g. Member relocated to another city / double charged"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                style={{ flex: 1 }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                style={{ flex: 1, background: "var(--danger)", borderColor: "var(--danger)" }}
                disabled={loading || maxRefundable <= 0}
              >
                {loading ? "Processing..." : `Confirm Refund (Rs. ${refundAmount.toLocaleString()})`}
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalOverlay>
  );
}
