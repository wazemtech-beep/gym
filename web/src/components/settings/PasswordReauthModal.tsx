"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch } from "@/lib/apiFetch";

import React, { useState } from "react";
import { Lock, X, AlertCircle } from "lucide-react";

interface PasswordReauthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export default function PasswordReauthModal({
  isOpen,
  onClose,
  onSuccess,
  title = "Security Verification",
  description = "Hassas (sensitive) tabdeeli ke liye barah-e-karam apna password dobara verify karein.",
}: PasswordReauthModalProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch("/api/v1/settings/reauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Password verification fail ho gayi.");
      }

      setPassword("");
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Password durust nahi hai.");
    } finally {
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
        backgroundColor: "var(--overlay)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: "20px",
      }}
    >
      <div
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: "420px",
          borderRadius: "14px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
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
                borderRadius: "8px",
                background: "var(--amber-soft)",
                color: "var(--amber-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Lock size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
                {title}
              </h3>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Identity check required
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="icon-button"
            aria-label="Close"
            style={{ width: "32px", height: "32px" }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "18px" }}>
            {description}
          </p>

          {error && (
            <div className="alert-error" style={{ marginBottom: "16px" }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: "24px" }}>
            <label className="form-label" htmlFor="reauth-password">
              Aapka Password
            </label>
            <input
              id="reauth-password"
              type="password"
              className="form-input"
              placeholder="Enter your current password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
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
              id="submit-reauth-btn"
              className="btn-primary"
              style={{ flex: 1 }}
              disabled={loading}
            >
              {loading ? "Verifying..." : "Verify & Continue"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
