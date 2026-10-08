"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import { Building2, Smartphone, Wallet, X, AlertCircle } from "lucide-react";
import { PaymentMethod } from "@prisma/client";

interface PaymentAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onRequireReauth: () => void;
  initialAccount?: any;
}

export default function PaymentAccountModal({
  isOpen,
  onClose,
  onSuccess,
  onRequireReauth,
  initialAccount,
}: PaymentAccountModalProps) {
  const isEditing = Boolean(initialAccount);

  const [type, setType] = useState<PaymentMethod>(PaymentMethod.BANK_TRANSFER);
  const [displayName, setDisplayName] = useState("");
  const [accountTitle, setAccountTitle] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [instructions, setInstructions] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialAccount) {
      setType(initialAccount.type || PaymentMethod.BANK_TRANSFER);
      setDisplayName(initialAccount.displayName || "");
      setAccountTitle(initialAccount.accountTitle || "");
      setAccountNumber(initialAccount.accountNumber || "");
      setInstructions(initialAccount.instructions || "");
      setIsDefault(Boolean(initialAccount.isDefault));
      setIsActive(initialAccount.isActive !== false);
    } else {
      setType(PaymentMethod.BANK_TRANSFER);
      setDisplayName("");
      setAccountTitle("");
      setAccountNumber("");
      setInstructions("Transfer confirmation ka TRX reference submit karein.");
      setIsDefault(false);
      setIsActive(true);
    }
    setError(null);
  }, [initialAccount, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const url = isEditing
        ? `/api/v1/settings/accounts/${initialAccount.id}`
        : `/api/v1/settings/accounts`;
      const method = isEditing ? "PATCH" : "POST";

      const payload: Record<string, any> = {
        displayName,
        accountTitle,
        accountNumber,
        instructions,
        isDefault,
        isActive,
      };

      if (!isEditing) {
        payload.type = type;
      }

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 403 && data.requiresReauth) {
        onRequireReauth();
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Account save karne mein masla aaya.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save account.");
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
        zIndex: 150,
        padding: "20px",
      }}
    >
      <div
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: "520px",
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
                background: "var(--accent-soft)",
                color: "var(--accent-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Wallet size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                {isEditing ? "Edit Payment Account" : "Add Payment Account"}
              </h3>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Receiving destination for member fee transfers
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
          {error && (
            <div className="alert-error" style={{ marginBottom: "18px" }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {!isEditing && (
            <div className="form-group">
              <label className="form-label">Account Type</label>
              <div className="responsive-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "10px",
                }}
              >
                {[
                  { value: PaymentMethod.BANK_TRANSFER, label: "Bank Account", icon: Building2 },
                  { value: PaymentMethod.EASYPAISA, label: "Easypaisa", icon: Smartphone },
                  { value: PaymentMethod.JAZZCASH, label: "JazzCash", icon: Smartphone },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = type === opt.value;
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => setType(opt.value)}
                      style={{
                        padding: "10px",
                        borderRadius: "8px",
                        border: isSelected ? "2px solid var(--accent-primary)" : "1px solid var(--border-medium)",
                        background: isSelected ? "var(--accent-soft)" : "var(--bg-surface)",
                        color: isSelected ? "var(--accent-primary)" : "var(--text-main)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer",
                        fontSize: "0.78rem",
                        fontWeight: isSelected ? 650 : 500,
                      }}
                    >
                      <Icon size={18} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="acc-display-name">
              Display Name (e.g. Gym HBL Account, Reception Cash Drawer)
            </label>
            <input
              id="acc-display-name"
              type="text"
              className="form-input"
              placeholder="e.g. Meezan Bank Main Account"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

          <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="acc-title">
                Account Title (Name)
              </label>
              <input
                id="acc-title"
                type="text"
                className="form-input"
                placeholder="e.g. OXGEN FITNESS CLUB"
                value={accountTitle}
                onChange={(e) => setAccountTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="acc-number">
                Account Number / IBAN
              </label>
              <input
                id="acc-number"
                type="text"
                className="form-input"
                placeholder="e.g. PK12MEZN000123456789"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="acc-instructions">
              Transfer Instructions (Member app mein dikhayi dengi)
            </label>
            <textarea
              id="acc-instructions"
              className="form-input"
              rows={2}
              placeholder="Transfer karne ke baad screenshot ya TRX ID darj karein."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px", marginBottom: "22px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              <span><strong>Default account</strong> (Member ko pehle yeh account show ho)</span>
            </label>

            {isEditing && (
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>Account active hai (Uncheck karne par naye transfers ke liye hide hoga)</span>
              </label>
            )}
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
              id="save-account-submit-btn"
              className="btn-primary"
              style={{ flex: 1 }}
              disabled={loading}
            >
              {loading ? "Saving..." : isEditing ? "Save Changes" : "Add Account"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
