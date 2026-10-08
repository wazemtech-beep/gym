"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch } from "@/lib/apiFetch";

import React, { useState } from "react";
import { Shield, X, AlertCircle } from "lucide-react";
import { Role, AccountStatus } from "@prisma/client";

interface StaffPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  staffUser: any;
}

export default function StaffPermissionModal({
  isOpen,
  onClose,
  onSuccess,
  staffUser,
}: StaffPermissionModalProps) {
  const [role, setRole] = useState<Role>(staffUser?.role || Role.RECEPTIONIST);
  const [status, setStatus] = useState<AccountStatus>(staffUser?.status || AccountStatus.ACTIVE);
  const [reason, setReason] = useState("");

  const currentGrants = (staffUser?.permissionGrants as Record<string, boolean>) || {};

  const [canManageExpenses, setCanManageExpenses] = useState<boolean>(
    currentGrants.EXPENSES_MANAGE ?? false
  );
  const [canRegisterMembers, setCanRegisterMembers] = useState<boolean>(
    currentGrants.MEMBER_REGISTER_UPDATE ?? (staffUser?.role === Role.RECEPTIONIST)
  );
  const [canAssignMembership, setCanAssignMembership] = useState<boolean>(
    currentGrants.MEMBERSHIP_ASSIGN_RENEW ?? (staffUser?.role === Role.RECEPTIONIST)
  );
  const [canRecordPayments, setCanRecordPayments] = useState<boolean>(
    currentGrants.PAYMENT_RECORD_VERIFY ?? (staffUser?.role === Role.RECEPTIONIST)
  );
  const [canManageAttendance, setCanManageAttendance] = useState<boolean>(
    currentGrants.ATTENDANCE_MANAGE ?? (staffUser?.role === Role.RECEPTIONIST)
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !staffUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const permissionGrants = {
        EXPENSES_MANAGE: canManageExpenses,
        MEMBER_REGISTER_UPDATE: canRegisterMembers,
        MEMBERSHIP_ASSIGN_RENEW: canAssignMembership,
        PAYMENT_RECORD_VERIFY: canRecordPayments,
        ATTENDANCE_MANAGE: canManageAttendance,
      };

      const res = await apiFetch("/api/v1/settings/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: staffUser.id,
          newRole: role,
          newStatus: status,
          permissionGrants,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Permissions update karne mein masla aaya.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update permissions.");
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
        zIndex: 160,
        padding: "20px",
      }}
    >
      <div
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: "540px",
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
                background: "var(--purple-soft)",
                color: "var(--purple-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Shield size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                Manage Permissions: {staffUser.name}
              </h3>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {staffUser.email || staffUser.phone || "Staff Member"}
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

          <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="staff-role-select">
                Account Role
              </label>
              <select
                id="staff-role-select"
                className="form-input"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value={Role.RECEPTIONIST}>Receptionist</option>
                <option value={Role.TRAINER}>Trainer</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="staff-status-select">
                Account Status
              </label>
              <select
                id="staff-status-select"
                className="form-input"
                value={status}
                onChange={(e) => setStatus(e.target.value as AccountStatus)}
              >
                <option value={AccountStatus.ACTIVE}>Active</option>
                <option value={AccountStatus.SUSPENDED}>Suspended (Block Login)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label className="form-label" style={{ marginBottom: "10px" }}>
              Custom Permissions & Overrides
            </label>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                background: "var(--bg-secondary)",
                padding: "14px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.85rem", cursor: "pointer" }}>
                <div>
                  <strong>Expenses Manage</strong>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Bills record karna aur expenses view karna
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={canManageExpenses}
                  onChange={(e) => setCanManageExpenses(e.target.checked)}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.85rem", cursor: "pointer" }}>
                <div>
                  <strong>Member Registration & Edit</strong>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Naye members add karna aur details update karna
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={canRegisterMembers}
                  onChange={(e) => setCanRegisterMembers(e.target.checked)}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.85rem", cursor: "pointer" }}>
                <div>
                  <strong>Membership Assign & Renew</strong>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Plans assign aur renew karna
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={canAssignMembership}
                  onChange={(e) => setCanAssignMembership(e.target.checked)}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.85rem", cursor: "pointer" }}>
                <div>
                  <strong>Payment Record & Verification</strong>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Cash payments aur bank transfers confirm karna
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={canRecordPayments}
                  onChange={(e) => setCanRecordPayments(e.target.checked)}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.85rem", cursor: "pointer" }}>
                <div>
                  <strong>Attendance Check-in</strong>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Desk check-in mark karna
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={canManageAttendance}
                  onChange={(e) => setCanManageAttendance(e.target.checked)}
                />
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="perm-reason">
              Tabdeeli Ki Waja (Audit Reason)
            </label>
            <input
              id="perm-reason"
              type="text"
              className="form-input"
              placeholder="e.g. Assigned to manage reception expenses"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginBottom: "20px", lineHeight: 1.4 }}>
            * Note: Permissions ya status change hone par is staff member ke tamam active sessions revoke ho jayenge aur agli login par updated access milega.
          </p>

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
              id="save-permissions-btn"
              className="btn-primary"
              style={{ flex: 1 }}
              disabled={loading}
            >
              {loading ? "Updating..." : "Save Permissions"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
