"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch } from "@/lib/apiFetch";

import React, { useState } from "react";
import { X, Archive, RotateCcw, AlertTriangle, ShieldAlert } from "lucide-react";

interface ArchiveMemberModalProps {
  isOpen: boolean;
  member: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ArchiveMemberModal({
  isOpen,
  member,
  onClose,
  onSuccess,
}: ArchiveMemberModalProps) {
  const isArchived = member.status === "ARCHIVED";
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch(`/api/v1/members/${member.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isArchived ? "UNARCHIVE" : "ARCHIVE",
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Archive action fail ho gaya.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to process request.");
    } finally {
      setLoading(false);
    }
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
          maxWidth: "500px",
          borderRadius: "16px",
          border: isArchived ? "1px solid var(--border-accent)" : "1px solid var(--danger-border)",
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
                background: isArchived ? "var(--accent-soft)" : "var(--danger-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isArchived ? "var(--accent-primary)" : "var(--danger)",
              }}
            >
              {isArchived ? <RotateCcw size={18} /> : <Archive size={18} />}
            </div>
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                {isArchived ? "Unarchive Member" : "Archive Member (Gym Chhorna)"}
              </h2>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "2px 0 0" }}>
                {member.fullName} ({member.memberId})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
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

        <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
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

          {isArchived ? (
            <div style={{ marginBottom: "20px" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--text-main)", lineHeight: 1.5 }}>
                Restore this member to the active list. Their ID and financial records stay unchanged.
              </p>
            </div>
          ) : (
            <div>
              <div
                style={{
                  padding: "14px",
                  borderRadius: "10px",
                  background: "var(--danger-soft)",
                  border: "1px solid var(--danger-border)",
                  marginBottom: "18px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "var(--danger)", fontSize: "0.85rem", marginBottom: "6px" }}>
                  <ShieldAlert size={16} />
                  
                  Archiving this member
                </div>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.785rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  <li>Member default active list se hide hoga.</li>
                  <li>Invoices aur receipts bilkul delete nahi hongi.</li>
                  <li>Agar dues baqi hain (Rs. {member.totalDues || 0}), toh collection follow-up mein balance show hota rahega.</li>
                </ul>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  
                  Archive reason <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Relocated to another city, fee default, medical issue"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input-field"
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "12px",
            }}
          >
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={isArchived ? "btn-primary" : "btn-secondary"}
              style={{
                padding: "8px 20px",
                background: isArchived ? undefined : "var(--danger)",
                borderColor: isArchived ? undefined : "var(--danger)",
                color: "var(--text-main)",
              }}
            >
              {loading
                ? "Processing..."
                : isArchived
                ? "Unarchive & Restore"
                : "Confirm Archive"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
