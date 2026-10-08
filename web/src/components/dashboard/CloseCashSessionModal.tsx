"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch } from "@/lib/apiFetch";

import { useState } from "react";
import { DollarSign, X, AlertTriangle, CheckCircle, ShieldCheck } from "lucide-react";

interface CloseCashSessionModalProps {
  session: {
    id: string;
    sessionNumber: string;
    expectedCash: number;
  } | null;
  onSuccess: () => void;
}

export default function CloseCashSessionModal({ session, onSuccess }: CloseCashSessionModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [countedCash, setCountedCash] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const expected = session?.expectedCash || 0;
  const countedNum = parseFloat(countedCash) || 0;
  const difference = countedNum - expected;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    if (difference !== 0 && !reason) {
      setError("Difference hone ki soorat mein waja likhna lazmi hai.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/v1/cash-session/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          countedCash: countedNum,
          differenceReason: reason || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Session close karne mein masla aaya.");
        setLoading(false);
        return;
      }

      setSuccessMsg(data.message);
      setLoading(false);
      setTimeout(() => {
        setIsOpen(false);
        setSuccessMsg(null);
        setCountedCash("");
        setReason("");
        onSuccess();
      }, 2000);
    } catch {
      setError("Server se rabta nahi ho saka.");
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-secondary"
        style={{ fontSize: "0.85rem", padding: "8px 14px" }}
      >
        <DollarSign size={15} color="var(--accent-primary)" />
        <span>Close cash session</span>
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
              maxWidth: "480px",
              padding: "32px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
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
              <ShieldCheck size={20} color="var(--accent-primary)" />
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Close cash session</h3>
            </div>
            

            {error && (
              <div className="alert-error">
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="alert-success">
                <CheckCircle size={16} style={{ flexShrink: 0 }} />
                <span>{successMsg}</span>
              </div>
            )}

            {!successMsg && session && (
              <form onSubmit={handleSubmit}>
                {/* Expected Cash Box */}
                <div
                  style={{
                    padding: "16px",
                    background: "var(--bg-secondary)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    marginBottom: "18px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
                    Expected Shift Cash:
                  </span>
                  <strong style={{ fontSize: "1.25rem", color: "var(--accent-primary)" }}>
                    Rs. {expected.toLocaleString()}
                  </strong>
                </div>

                <div className="form-group">
                  <label className="form-label">Counted cash</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="form-input"
                    placeholder="e.g. 12000"
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    required
                  />
                </div>

                {countedCash !== "" && (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "var(--radius-sm)",
                      marginBottom: "16px",
                      fontSize: "0.85rem",
                      background:
                        difference === 0
                          ? "var(--accent-soft)"
                          : difference < 0
                          ? "var(--danger-soft)"
                          : "var(--blue-soft)",
                      border: `1px solid ${
                        difference === 0
                          ? "var(--border-accent)"
                          : difference < 0
                          ? "var(--danger-border)"
                          : "var(--blue-border)"
                      }`,
                      color:
                        difference === 0 ? "var(--accent-primary)" : difference < 0 ? "var(--danger)" : "var(--blue-primary)",
                    }}
                  >
                    <strong>Difference: </strong>
                    {difference === 0
                      ? "Poora match hai (Koi shortage nahi)"
                      : difference < 0
                      ? `Shortage: -Rs. ${Math.abs(difference).toLocaleString()}`
                      : `Surplus: +Rs. ${difference.toLocaleString()}`}
                  </div>
                )}

                {difference !== 0 && countedCash !== "" && (
                  <div className="form-group">
                    <label className="form-label">Difference reason</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Member change returning issue"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      required
                    />
                  </div>
                )}

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
                    {loading ? "Closing..." : "Close & Handover Cash"}
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
