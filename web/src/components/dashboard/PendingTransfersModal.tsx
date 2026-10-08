"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch } from "@/lib/apiFetch";

import { useState } from "react";
import { Clock, CheckCircle2, XCircle, AlertCircle, X, Check, ShieldAlert } from "lucide-react";

interface PendingTransferItem {
  id: string;
  amount: number;
  transactionReference: string | null;
  submittedAt: string;
  gymMember: {
    fullName: string;
    memberId: string;
    phone: string;
  };
  receivingAccount: {
    displayName: string;
    accountNumber: string;
  };
}

interface PendingTransfersModalProps {
  transfers: PendingTransferItem[];
  onSuccess: () => void;
}

export default function PendingTransfersModal({ transfers, onSuccess }: PendingTransfersModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleAction = async (submissionId: string, action: "APPROVE" | "REJECT", reason?: string) => {
    setActionLoading(submissionId);
    setStatusMsg(null);

    try {
      const res = await apiFetch("/api/v1/transfers/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          action,
          rejectionReason: reason,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setStatusMsg({ type: "error", text: data.error || "Action fail ho gaya." });
        setActionLoading(null);
        return;
      }

      setStatusMsg({ type: "success", text: data.message });
      setActionLoading(null);
      setRejectingId(null);
      setRejectReason("");
      onSuccess();
    } catch {
      setStatusMsg({ type: "error", text: "Server se rabta nahi ho saka." });
      setActionLoading(null);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-secondary"
        style={{
          fontSize: "0.85rem",
          padding: "8px 14px",
          position: "relative",
          borderColor: transfers.length > 0 ? "var(--amber-border)" : "var(--border-subtle)",
        }}
      >
        <Clock size={15} color={transfers.length > 0 ? "#f59e0b" : "var(--text-dim)"} />
        <span>Review transfers ({transfers.length})</span>
        {transfers.length > 0 && (
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--amber-primary)",
              boxShadow: "none",
            }}
          />
        )}
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
              maxWidth: "680px",
              padding: "32px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              maxHeight: "85vh",
              overflowY: "auto",
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
              <Clock size={20} color="#f59e0b" />
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>
                
                Review transfers
              </h3>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "20px" }}>
              
              Confirm only after the payment reaches your account.
            </p>

            {statusMsg && (
              <div
                className={statusMsg.type === "success" ? "alert-success" : "alert-error"}
                style={{ marginBottom: "16px" }}
              >
                <span>{statusMsg.text}</span>
              </div>
            )}

            {transfers.length === 0 ? (
              <div
                style={{
                  padding: "40px",
                  textAlign: "center",
                  background: "var(--bg-secondary)",
                  borderRadius: "var(--radius-md)",
                  border: "1px dashed var(--border-subtle)",
                }}
              >
                <CheckCircle2 size={36} color="var(--accent-primary)" style={{ marginBottom: "10px" }} />
                <h4 style={{ color: "var(--text-main)", marginBottom: "4px" }}>
                  
                  No pending transfers
                </h4>
                
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {transfers.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: "18px",
                      background: "var(--bg-secondary)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                          {item.gymMember.fullName}
                          <span style={{ marginLeft: "8px", fontSize: "0.78rem", color: "var(--text-dim)" }}>
                            ({item.gymMember.memberId})
                          </span>
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          Destination: <strong style={{ color: "var(--text-main)" }}>{item.receivingAccount.displayName}</strong>
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--accent-primary)" }}>
                          Rs. {item.amount.toLocaleString()}
                        </div>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                          Ref: {item.transactionReference || "N/A"}
                        </span>
                      </div>
                    </div>

                    {rejectingId === item.id ? (
                      <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border-subtle)" }}>
                        <label className="form-label" style={{ fontSize: "0.75rem" }}>
                          Rejection Reason (Member ko dikhega)
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Account mein transaction receive nahi hui"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          style={{ marginBottom: "10px" }}
                        />
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => setRejectingId(null)}
                            className="btn-secondary"
                            style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleAction(item.id, "REJECT", rejectReason)}
                            className="btn-primary"
                            style={{ padding: "6px 12px", fontSize: "0.8rem", background: "var(--danger)" }}
                            disabled={actionLoading === item.id}
                          >
                            Confirm Reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                        <button
                          onClick={() => setRejectingId(item.id)}
                          className="btn-secondary"
                          style={{ padding: "7px 14px", fontSize: "0.8rem", borderColor: "var(--danger-border)", color: "var(--danger)" }}
                          disabled={actionLoading === item.id}
                        >
                          <XCircle size={14} />
                          <span>Reject</span>
                        </button>

                        <button
                          onClick={() => handleAction(item.id, "APPROVE")}
                          className="btn-primary"
                          style={{ padding: "7px 16px", fontSize: "0.8rem" }}
                          disabled={actionLoading === item.id}
                        >
                          <Check size={14} />
                          <span>Confirm & Issue Receipt</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
