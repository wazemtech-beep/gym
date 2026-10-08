"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import {
  X,
  RotateCcw,
  AlertCircle,
  CreditCard,
  Wallet,
  Building2,
  CheckCircle2,
} from "lucide-react";

interface RecordVendorRefundModalProps {
  expense: any | null;
  isOpen: boolean;
  onClose: () => void;
  onRefundRecorded: () => void;
}

export default function RecordVendorRefundModal({
  expense,
  isOpen,
  onClose,
  onRefundRecorded,
}: RecordVendorRefundModalProps) {
  const readCacheVersion = useReadCacheVersion();
  const [amount, setAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [receivingAccountId, setReceivingAccountId] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && expense) {
      setAmount(expense.paidAmount ? expense.paidAmount.toString() : "");
      setRefundMethod("CASH");
      setReason("");
      setReference("");
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
      setError("Valid refund amount darj karein.");
      return;
    }

    if (parsedAmount > expense.paidAmount) {
      setError(`Refund amount paid amount (Rs. ${expense.paidAmount.toLocaleString()}) se zyada nahi ho sakti.`);
      return;
    }

    if (!reason.trim()) {
      setError("Vendor refund ki waja (reason) likhna zaroori hai.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/v1/expenses/${expense.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          refundMethod,
          receivingAccountId: refundMethod !== "CASH" ? receivingAccountId : null,
          reason: reason.trim(),
          reference: reference.trim() || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onRefundRecorded();
        onClose();
      } else {
        setError(data.error || "Refund record karne mein masla pesh aaya.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !expense) return null;

  return (
    <ModalOverlay
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "var(--bg-surface)",
          borderRadius: "14px",
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 22px",
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
                borderRadius: "8px",
                background: "rgba(245, 158, 11, 0.15)",
                color: "#f59e0b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <RotateCcw size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
                Vendor Expense Refund
              </h3>
              <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", margin: 0 }}>
                {expense.expenseNumber} • {expense.vendorName || "Vendor"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-dim)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 22px" }}>
          {error && (
            <div
              style={{
                background: "var(--danger-soft)",
                border: "1px solid var(--danger-border)",
                color: "var(--danger)",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "0.82rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Expense Summary Banner */}
          <div className="responsive-grid"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "10px",
              padding: "12px 14px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <div>
              <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", display: "block" }}>
                Total Paid Amount
              </span>
              <span style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                Rs. {expense.paidAmount?.toLocaleString() || 0}
              </span>
            </div>
            <div>
              <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", display: "block" }}>
                Current Status
              </span>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#10b981" }}>
                {expense.status}
              </span>
            </div>
          </div>

          {/* Refund Amount */}
          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "6px" }}>
              Refund Amount (Rs.) *
            </label>
            <input
              type="number"
              min="1"
              max={expense.paidAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              style={{
                width: "100%",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                padding: "10px 12px",
                color: "var(--text-main)",
                fontSize: "0.95rem",
                fontWeight: 700,
                outline: "none",
              }}
            />
          </div>

          {/* Refund Receiving Method */}
          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "6px" }}>
              Refund Destination (Kahan wapis aaye?) *
            </label>
            <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setRefundMethod("CASH")}
                style={{
                  background: refundMethod === "CASH" ? "var(--accent-soft)" : "var(--bg-secondary)",
                  border: refundMethod === "CASH" ? "1px solid var(--border-accent)" : "1px solid var(--border-subtle)",
                  color: refundMethod === "CASH" ? "var(--accent-primary)" : "var(--text-muted)",
                  padding: "10px",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
              >
                <Wallet size={16} />
                <span>Cash Drawer</span>
              </button>
              <button
                type="button"
                onClick={() => setRefundMethod("BANK_TRANSFER")}
                style={{
                  background: refundMethod === "BANK_TRANSFER" ? "var(--accent-soft)" : "var(--bg-secondary)",
                  border: refundMethod === "BANK_TRANSFER" ? "1px solid var(--border-accent)" : "1px solid var(--border-subtle)",
                  color: refundMethod === "BANK_TRANSFER" ? "var(--accent-primary)" : "var(--text-muted)",
                  padding: "10px",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
              >
                <CreditCard size={16} />
                <span>Bank Account</span>
              </button>
            </div>
          </div>

          {/* Bank Account Selection if BANK_TRANSFER */}
          {refundMethod === "BANK_TRANSFER" && accounts.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "6px" }}>
                Select Bank Account
              </label>
              <select
                value={receivingAccountId}
                onChange={(e) => setReceivingAccountId(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  color: "var(--text-main)",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bankName} - {acc.accountTitle} ({acc.accountNumber})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reason */}
          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "6px" }}>
              Refund Reason (Waja)*
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Overcharged, goods returned, service cancelled"
              required
              style={{
                width: "100%",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                padding: "9px 12px",
                color: "var(--text-main)",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
          </div>

          {/* Reference */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "6px" }}>
              Reference / Trx ID (Optional)
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Cheque # / Slip # / Trx ID"
              style={{
                width: "100%",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                padding: "9px 12px",
                color: "var(--text-main)",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn btn-secondary"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-main)",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: "#f59e0b",
                color: "#000",
                border: "none",
                borderRadius: "8px",
                padding: "8px 20px",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              {submitting ? "Processing..." : "Confirm Vendor Refund"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
