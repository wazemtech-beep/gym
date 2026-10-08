"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import {
  X,
  DollarSign,
  AlertCircle,
  CreditCard,
  Wallet,
  Calendar,
  Building2,
  CheckCircle2,
  Tag
} from "lucide-react";

interface RecordExpensePaymentModalProps {
  expense: any | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentRecorded: () => void;
}

export default function RecordExpensePaymentModal({
  expense,
  isOpen,
  onClose,
  onPaymentRecorded,
}: RecordExpensePaymentModalProps) {
  const readCacheVersion = useReadCacheVersion();
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [receivingAccountId, setReceivingAccountId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && expense) {
      setAmount(expense.balanceAmount ? expense.balanceAmount.toString() : "");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setPaymentMethod("CASH");
      setReferenceNumber("");
      setNotes("");
      setError(null);
      fetchAccounts();
    }
  }, [isOpen, expense, readCacheVersion]);

  const fetchAccounts = async () => {
    try {
      const res = await apiFetch("/api/v1/dashboard/metrics?period=this_month");
      const data = await res.json();
      if (data.success && data.configuredAccounts) {
        setAccounts(data.configuredAccounts);
        if (data.configuredAccounts.length > 0 && !receivingAccountId) {
          setReceivingAccountId(data.configuredAccounts[0].id);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expense) return;
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Valid payment amount darj karein.");
      return;
    }

    if (parsedAmount > expense.balanceAmount) {
      setError(`Amount baqi balance (Rs. ${expense.balanceAmount.toLocaleString()}) se zyada nahi ho sakti.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/v1/expenses/${expense.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          paymentDate,
          paymentMethod,
          receivingAccountId: paymentMethod !== "CASH" ? receivingAccountId : null,
          referenceNumber: referenceNumber.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onPaymentRecorded();
        onClose();
      } else {
        setError(data.error || "Payment record karne mein khata aayi.");
      }
    } catch {
      setError("Network error while recording expense payment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !expense) return null;

  const parsedAmount = parseFloat(amount) || 0;
  const remainingAfterPayment = Math.max(0, expense.balanceAmount - parsedAmount);

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
        zIndex: 9999,
        padding: "16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "540px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-secondary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "var(--accent-soft)",
                color: "var(--accent-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <DollarSign size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
                Record Expense Payment
              </h3>
              <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", margin: 0 }}>
                {expense.expenseNumber} • {expense.title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "8px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && (
            <div
              style={{
                background: "var(--danger-soft)",
                border: "1px solid var(--danger-border)",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "var(--danger)",
                fontSize: "0.82rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Balance Context Card */}
          <div
            style={{
              background: "var(--bg-secondary)",
              borderRadius: "10px",
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.82rem",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>TOTAL EXPENSE</div>
              <div style={{ fontWeight: 700, color: "var(--text-main)" }}>Rs. {expense.totalAmount?.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>ALREADY PAID</div>
              <div style={{ fontWeight: 700, color: "var(--accent-primary)" }}>Rs. {expense.paidAmount?.toLocaleString()}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>REMAINING DUE</div>
              <div style={{ fontWeight: 700, color: "#f43f5e", fontSize: "0.95rem" }}>
                Rs. {expense.balanceAmount?.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Amount & Date */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px" }}>
                Payment Amount (PKR) *
              </label>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-main)",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px" }}>
                Outflow Date *
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-main)",
                  fontSize: "0.86rem",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px" }}>
              Payment Outflow Source *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-main)",
                fontSize: "0.86rem",
                outline: "none",
              }}
            >
              <option value="CASH">Cash drawer</option>
              <option value="BANK_TRANSFER">Bank account</option>
              <option value="EASYPAISA">Easypaisa</option>
              <option value="JAZZCASH">JazzCash</option>
            </select>
          </div>

          {paymentMethod !== "CASH" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "4px" }}>
                  Source Bank Account
                </label>
                <select
                  value={receivingAccountId}
                  onChange={(e) => setReceivingAccountId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-main)",
                    fontSize: "0.82rem",
                    outline: "none",
                  }}
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "4px" }}>
                  Cheque / TRX Ref #
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="TRX-123456"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-main)",
                    fontSize: "0.82rem",
                    outline: "none",
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={{ fontSize: "0.74rem", color: "var(--accent-primary)" }}>
              
              Deducted from the current cash drawer.
            </div>
          )}

          {/* Remaining Balance After Payment */}
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: remainingAfterPayment === 0 ? "var(--accent-soft)" : "var(--amber-soft)",
              color: remainingAfterPayment === 0 ? "var(--accent-primary)" : "var(--amber-primary)",
              fontSize: "0.82rem",
              fontWeight: 700,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Status after this payment:</span>
            <span>
              {remainingAfterPayment === 0
                ? "PAID (Rs. 0 Remaining)"
                : `PARTIALLY PAID (Rs. ${remainingAfterPayment.toLocaleString()} Due)`}
            </span>
          </div>

          {/* Submit */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ padding: "8px 24px", fontWeight: 700 }}
            >
              {submitting ? "Recording..." : "Confirm Payment"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
