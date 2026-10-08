"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch } from "@/lib/apiFetch";

import React, { useState } from "react";
import {
  Building2,
  CreditCard,
  FileText,
  Users,
  Shield,
  CalendarCheck,
  Receipt,
  RotateCcw,
  Check,
  AlertCircle,
  AlertTriangle,
  Lock,
  Plus,
  Trash2,
  Edit,
  Star,
  RefreshCw,
  ExternalLink,
  Info,
  CheckCircle2,
  Smartphone,
  Wallet,
  Clock,
  Printer,
  Bell,
  Eye,
  Mail,
  Copy,
  X,
} from "lucide-react";
import SystemHealth from "./SystemHealth";
import PasswordReauthModal from "./PasswordReauthModal";
import PaymentAccountModal from "./PaymentAccountModal";
import StaffPermissionModal from "./StaffPermissionModal";
import AuditLogsViewer from "./AuditLogsViewer";
import { PaymentMethod, Role } from "@prisma/client";

interface SettingsClientProps {
  initialSettings: any;
  initialPaymentAccounts: any[];
  initialStaffList: any[];
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
}

export default function SettingsClient({
  initialSettings,
  initialPaymentAccounts,
  initialStaffList,
  currentUser,
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<
    | "profile"
    | "accounts"
    | "membership"
    | "receipts"
    | "staff"
    | "attendance"
    | "audit"
    | "system"
  >("profile");

  // State
  const [settings, setSettings] = useState<any>(initialSettings || {});
  const [accounts, setAccounts] = useState<any[]>(initialPaymentAccounts || []);
  const [staffList, setStaffList] = useState<any[]>(initialStaffList || []);

  // Form Fields
  const [gymName, setGymName] = useState(settings.gymName || "OXGEN GYM");
  const [tagline, setTagline] = useState(settings.tagline || "");
  const [contactPhone, setContactPhone] = useState(settings.contactPhone || "");
  const [contactEmail, setContactEmail] = useState(settings.contactEmail || "");
  const [address, setAddress] = useState(settings.address || "");
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || "");

  const [receiptPrefix, setReceiptPrefix] = useState(settings.receiptPrefix || "OXG-RCP");
  const [receiptFooter, setReceiptFooter] = useState(
    settings.receiptFooter || "Thank you for training with OXGEN GYM. Fees once paid are non-refundable."
  );
  const [receiptPrintFormat, setReceiptPrintFormat] = useState(
    settings.receiptPrintFormat || "A4"
  );
  const [emailReceiptsAutomatically, setEmailReceiptsAutomatically] = useState(
    Boolean(settings.emailReceiptsAutomatically)
  );

  const [invoiceDueDays, setInvoiceDueDays] = useState<number>(settings.invoiceDueDays ?? 7);
  const [maxFreezeDays, setMaxFreezeDays] = useState<number>(settings.maxFreezeDays ?? 30);
  const [expiryReminderDays, setExpiryReminderDays] = useState<string>(
    Array.isArray(settings.expiryReminderDays) ? settings.expiryReminderDays.join(", ") : "7, 1"
  );
  const [overdueReminderDays, setOverdueReminderDays] = useState<string>(
    Array.isArray(settings.overdueReminderDays) ? settings.overdueReminderDays.join(", ") : "3"
  );
  const [dueDateReminderEnabled, setDueDateReminderEnabled] = useState<boolean>(
    settings.dueDateReminderEnabled ?? true
  );

  const [attendanceEnabled, setAttendanceEnabled] = useState<boolean>(
    settings.attendanceEnabled ?? false
  );

  // Status & Feedback
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [versionConflict, setVersionConflict] = useState(false);

  // Modals
  const [isReauthModalOpen, setIsReauthModalOpen] = useState(false);
  const [pendingActionAfterReauth, setPendingActionAfterReauth] = useState<(() => void) | null>(null);

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any | null>(null);

  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any | null>(null);
  const [resendInviteData, setResendInviteData] = useState<{ name: string; link: string } | null>(null);
  const [resendingStaffId, setResendingStaffId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleResendStaffInvite = async (staffMember: any) => {
    setResendingStaffId(staffMember.id);
    try {
      const res = await apiFetch("/api/staff/invite/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: staffMember.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Failed to resend invitation.");
        return;
      }
      setResendInviteData({
        name: staffMember.name,
        link: data.activationLink,
      });
    } catch {
      alert("Server error while resending invite.");
    } finally {
      setResendingStaffId(null);
    }
  };

  // Action states
  const [accountActionLoading, setAccountActionLoading] = useState<string | null>(null);
  const [accountActionError, setAccountActionError] = useState<string | null>(null);

  // Reload settings
  const refreshAllData = async () => {
    try {
      const res = await apiFetch("/api/v1/settings");
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setAccounts(data.paymentAccounts || []);
        setStaffList(data.staffList || []);

        // Sync form state
        setGymName(data.settings.gymName || "OXGEN GYM");
        setTagline(data.settings.tagline || "");
        setContactPhone(data.settings.contactPhone || "");
        setContactEmail(data.settings.contactEmail || "");
        setAddress(data.settings.address || "");
        setLogoUrl(data.settings.logoUrl || "");

        setReceiptPrefix(data.settings.receiptPrefix || "OXG-RCP");
        setReceiptFooter(data.settings.receiptFooter || "");
        setReceiptPrintFormat(data.settings.receiptPrintFormat || "A4");
        setEmailReceiptsAutomatically(Boolean(data.settings.emailReceiptsAutomatically));

        setInvoiceDueDays(data.settings.invoiceDueDays ?? 7);
        setMaxFreezeDays(data.settings.maxFreezeDays ?? 30);
        setExpiryReminderDays(
          Array.isArray(data.settings.expiryReminderDays)
            ? data.settings.expiryReminderDays.join(", ")
            : "7, 1"
        );
        setOverdueReminderDays(
          Array.isArray(data.settings.overdueReminderDays)
            ? data.settings.overdueReminderDays.join(", ")
            : "3"
        );
        setDueDateReminderEnabled(data.settings.dueDateReminderEnabled ?? true);
        setAttendanceEnabled(data.settings.attendanceEnabled ?? false);

        setVersionConflict(false);
        setSaveError(null);
      }
    } catch (e) {
      console.error("Refresh error:", e);
    }
  };

  // Save Settings handler with Optimistic Concurrency
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);
    setVersionConflict(false);

    try {
      // Parse reminder numbers
      const parsedExpiryDays = expiryReminderDays
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);

      const parsedOverdueDays = overdueReminderDays
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);

      const payload = {
        expectedVersion: settings.version,
        gymName: gymName.trim(),
        tagline: tagline.trim(),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim(),
        address: address.trim(),
        logoUrl: logoUrl.trim() || undefined,
        receiptPrefix: receiptPrefix.trim().toUpperCase(),
        receiptFooter: receiptFooter.trim(),
        receiptPrintFormat,
        emailReceiptsAutomatically,
        invoiceDueDays: Number(invoiceDueDays),
        maxFreezeDays: Number(maxFreezeDays),
        expiryReminderDays: parsedExpiryDays,
        overdueReminderDays: parsedOverdueDays,
        dueDateReminderEnabled,
        attendanceEnabled,
      };

      const res = await apiFetch("/api/v1/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 409 || data.conflict) {
        setVersionConflict(true);
        setSaveError(
          data.error ||
            "Conflict! Settings kisi aur session ya user ne update kar di hain. Barah-e-karam page refresh karein."
        );
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Settings save karne mein khata aayi.");
      }

      setSettings(data.settings);
      setSaveSuccess(
        data.changes?.length > 0
          ? `Settings kamiyabi se update ho gayi hain! (${data.changes.length} tabdeeliyan record huin)`
          : "Settings save ho gayi hain (koi tabdeeli nahi thi)."
      );

      // Auto dismiss success message after 4s
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setSaveError(err.message || "Settings save nahi ho sakeen.");
    } finally {
      setSaving(false);
    }
  };

  // Account Operations
  const handleToggleAccountActive = async (account: any) => {
    setAccountActionLoading(account.id);
    setAccountActionError(null);
    try {
      const res = await apiFetch(`/api/v1/settings/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !account.isActive }),
      });
      const data = await res.json();

      if (data.reauthRequired) {
        setPendingActionAfterReauth(() => () => handleToggleAccountActive(account));
        setIsReauthModalOpen(true);
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Account update fail ho gaya.");
      }

      refreshAllData();
    } catch (err: any) {
      setAccountActionError(err.message);
    } finally {
      setAccountActionLoading(null);
    }
  };

  const handleSetDefaultAccount = async (account: any) => {
    setAccountActionLoading(account.id);
    setAccountActionError(null);
    try {
      const res = await apiFetch(`/api/v1/settings/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true, isActive: true }),
      });
      const data = await res.json();

      if (data.reauthRequired) {
        setPendingActionAfterReauth(() => () => handleSetDefaultAccount(account));
        setIsReauthModalOpen(true);
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Default account set nahi ho saka.");
      }

      refreshAllData();
    } catch (err: any) {
      setAccountActionError(err.message);
    } finally {
      setAccountActionLoading(null);
    }
  };

  const handleDeleteAccount = async (account: any) => {
    const confirmDelete = window.confirm(
      `Kya aap waqai "${account.displayName}" (${account.accountTitle}) account delete karna chahte hain?`
    );
    if (!confirmDelete) return;

    setAccountActionLoading(account.id);
    setAccountActionError(null);
    try {
      const res = await apiFetch(`/api/v1/settings/accounts/${account.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.reauthRequired) {
        setPendingActionAfterReauth(() => () => handleDeleteAccount(account));
        setIsReauthModalOpen(true);
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Account delete nahi ho saka.");
      }

      refreshAllData();
    } catch (err: any) {
      setAccountActionError(err.message);
    } finally {
      setAccountActionLoading(null);
    }
  };

  const getAccountIcon = (type: PaymentMethod) => {
    switch (type) {
      case PaymentMethod.BANK_TRANSFER:
        return <Building2 size={20} className="text-blue-600" />;
      case PaymentMethod.EASYPAISA:
        return <Smartphone size={20} className="text-green-600" />;
      case PaymentMethod.JAZZCASH:
        return <Wallet size={20} className="text-amber-600" />;
      default:
        return <CreditCard size={20} />;
    }
  };

  const tabs = [
    { id: "profile", label: "Gym details & profile", icon: Building2 },
    { id: "accounts", label: "Receiving accounts", icon: CreditCard, count: accounts.length },
    { id: "membership", label: "Membership & dues", icon: Clock },
    { id: "receipts", label: "Receipt branding & format", icon: Receipt },
    { id: "staff", label: "Staff permissions", icon: Users, count: staffList.length },
    { id: "attendance", label: "Attendance & alerts", icon: CalendarCheck },
    { id: "audit", label: "Audit history ledger", icon: Shield },
    { id: "system", label: "System health & version", icon: Info },
  ] as const;

  return (
    <div style={{ paddingBottom: "60px" }}>
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <span className="page-eyebrow">SYSTEM CONFIGURATION & GOVERNANCE</span>
          <h1 className="page-heading">Gym Settings & Audit</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginTop: "4px" }}>
            Manage gym branding, receiving accounts, defaults, staff permissions, and review the immutable audit ledger.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={refreshAllData}
            className="btn-secondary"
            title="Reload latest state"
          >
            <RefreshCw size={15} />
            <span>Reload</span>
          </button>

          {activeTab !== "audit" && (
            <button
              type="button"
              onClick={() => handleSaveSettings()}
              disabled={saving}
              className="btn-primary"
              style={{ minWidth: "140px" }}
            >
              {saving ? (
                <>
                  <RefreshCw size={15} className="spin-slow" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Version Conflict Alert */}
      {versionConflict && (
        <div
          style={{
            padding: "16px 20px",
            borderRadius: "10px",
            background: "var(--danger-soft)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger)",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <AlertTriangle size={24} style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ display: "block", fontSize: "0.95rem" }}>
                Concurrency Conflict (409)
              </strong>
              <span style={{ fontSize: "0.85rem" }}>{saveError}</span>
            </div>
          </div>
          <button
            onClick={refreshAllData}
            className="btn-secondary"
            style={{ borderColor: "var(--danger-border)", color: "var(--danger)", flexShrink: 0 }}
          >
            <RefreshCw size={14} />
            <span>Load Latest Version (v{settings.version})</span>
          </button>
        </div>
      )}

      {/* Normal Success Alert */}
      {saveSuccess && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "8px",
            background: "var(--accent-soft)",
            border: "1px solid var(--border-accent)",
            color: "var(--accent-primary)",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "0.88rem",
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Normal Error Alert */}
      {saveError && !versionConflict && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "8px",
            background: "var(--danger-soft)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger)",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "0.88rem",
          }}
        >
          <AlertCircle size={18} />
          <span>{saveError}</span>
        </div>
      )}

      {/* Tabs navigation */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          borderBottom: "1px solid var(--border-subtle)",
          marginBottom: "24px",
          overflowX: "auto",
          paddingBottom: "2px",
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                borderRadius: "8px 8px 0 0",
                fontSize: "0.85rem",
                fontWeight: isActive ? 650 : 500,
                color: isActive ? "var(--accent-primary)" : "var(--text-muted)",
                backgroundColor: isActive ? "var(--bg-surface)" : "transparent",
                border: "1px solid",
                borderColor: isActive ? "var(--border-subtle)" : "transparent",
                borderBottomColor: isActive ? "var(--bg-surface)" : "transparent",
                marginBottom: "-1px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {"count" in tab && tab.count !== undefined && (
                <span
                  style={{
                    fontSize: "0.72rem",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    backgroundColor: isActive ? "var(--accent-soft)" : "var(--bg-secondary)",
                    color: isActive ? "var(--accent-primary)" : "var(--text-muted)",
                    fontWeight: 600,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}

      {/* 1. GYM DETAILS & PROFILE */}
      {activeTab === "profile" && (
        <form onSubmit={handleSaveSettings} className="glass-panel" style={{ padding: "28px" }}>
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "1.15rem", marginBottom: "4px" }}>Gym Identity & Contact</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
              These details are used across receipts, member SMS/emails, and the portal header.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
              gap: "20px",
            }}
          >
            <div className="form-group">
              <label className="form-label">Gym / Business Name *</label>
              <input
                type="text"
                className="form-input"
                value={gymName}
                onChange={(e) => setGymName(e.target.value)}
                required
                placeholder="e.g. OXGEN GYM"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Brand Tagline</label>
              <input
                type="text"
                className="form-input"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Strength & Performance"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Official Phone Number *</label>
              <input
                type="text"
                className="form-input"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                required
                placeholder="+92 300 1234567"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Official Contact Email *</label>
              <input
                type="email"
                className="form-input"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                placeholder="info@oxgengym.com"
              />
            </div>

            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Physical Address</label>
              <textarea
                className="form-input"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full address of the gym facility..."
              />
            </div>

            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Gym Logo URL (Optional)</label>
              <input
                type="url"
                className="form-input"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Leave empty to use the standard OXGEN brand symbol on printed receipts.
              </span>
            </div>
          </div>

          {/* Locked System Attributes */}
          <div
            style={{
              marginTop: "24px",
              padding: "16px 20px",
              borderRadius: "8px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Lock size={18} style={{ color: "var(--text-muted)" }} />
              <div>
                <strong style={{ fontSize: "0.85rem", display: "block" }}>
                  Operational Currency: PKR (Rs) &bull; Timezone: Asia/Karachi (PKT)
                </strong>
                <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                  As per system specifications, the Pakistani Rupee and Karachi time standard are immutable and locked.
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <span className="badge badge-member">PKR (Rs) Locked</span>
              <span className="badge badge-receptionist">Asia/Karachi Locked</span>
            </div>
          </div>
        </form>
      )}

      {/* 2. RECEIVING ACCOUNTS */}
      {activeTab === "accounts" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <h3 style={{ fontSize: "1.15rem", marginBottom: "4px" }}>Payment Receiving Accounts</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                Add and manage Bank, Easypaisa, and JazzCash accounts shown to members for manual transfers.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingAccount(null);
                setIsAccountModalOpen(true);
              }}
              className="btn-primary"
            >
              <Plus size={16} />
              <span>Add Receiving Account</span>
            </button>
          </div>

          {accountActionError && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                background: "var(--danger-soft)",
                border: "1px solid var(--danger-border)",
                color: "var(--danger)",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "0.85rem",
              }}
            >
              <AlertCircle size={18} />
              <span>{accountActionError}</span>
            </div>
          )}

          {accounts.length === 0 ? (
            <div
              className="glass-panel"
              style={{
                padding: "48px 24px",
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              <CreditCard size={40} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
              <h4>No Receiving Accounts Configured</h4>
              <p style={{ fontSize: "0.85rem", marginTop: "4px" }}>
                Configure at least one Bank or Mobile Wallet account so members can transfer fees.
              </p>
              <button
                onClick={() => {
                  setEditingAccount(null);
                  setIsAccountModalOpen(true);
                }}
                className="btn-primary"
                style={{ marginTop: "16px" }}
              >
                <Plus size={16} />
                <span>Add First Account</span>
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))",
                gap: "16px",
              }}
            >
              {accounts.map((acc) => {
                const isBusy = accountActionLoading === acc.id;
                return (
                  <div
                    key={acc.id}
                    className="glass-panel"
                    style={{
                      padding: "20px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      borderColor: acc.isDefault ? "var(--accent-primary)" : "var(--border-subtle)",
                      background: acc.isActive ? "var(--bg-surface)" : "var(--bg-secondary)",
                      opacity: acc.isActive ? 1 : 0.75,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: "12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "38px",
                              height: "38px",
                              borderRadius: "8px",
                              background: "var(--bg-secondary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {getAccountIcon(acc.type)}
                          </div>
                          <div>
                            <strong style={{ fontSize: "0.95rem", display: "block" }}>
                              {acc.displayName}
                            </strong>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              {acc.type.replace("_", " ")}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "6px" }}>
                          {acc.isDefault && (
                            <span className="badge badge-member" title="Default Receiving Account">
                              <Star size={10} style={{ fill: "currentColor" }} />
                              Default
                            </span>
                          )}
                          <span className={`badge ${acc.isActive ? "badge-active" : "badge-pending"}`}>
                            {acc.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          background: "var(--bg-secondary)",
                          padding: "12px",
                          borderRadius: "6px",
                          fontSize: "0.82rem",
                          marginBottom: "12px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ color: "var(--text-muted)" }}>Account Title:</span>
                          <strong>{acc.accountTitle}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-muted)" }}>Account / IBAN:</span>
                          <strong style={{ fontFamily: "monospace" }}>{acc.accountNumber}</strong>
                        </div>
                      </div>

                      {acc.instructions && (
                        <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginBottom: "14px" }}>
                          {acc.instructions}
                        </p>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: "12px",
                        borderTop: "1px solid var(--border-subtle)",
                        marginTop: "auto",
                      }}
                    >
                      <div style={{ display: "flex", gap: "8px" }}>
                        {!acc.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultAccount(acc)}
                            disabled={isBusy}
                            className="btn-secondary"
                            style={{ padding: "6px 10px", fontSize: "0.75rem", minHeight: "32px" }}
                            title="Make this the primary receiving account"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleAccountActive(acc)}
                          disabled={isBusy}
                          className="btn-secondary"
                          style={{ padding: "6px 10px", fontSize: "0.75rem", minHeight: "32px" }}
                        >
                          {acc.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAccount(acc);
                            setIsAccountModalOpen(true);
                          }}
                          disabled={isBusy}
                          className="icon-button"
                          title="Edit details"
                          style={{ width: "32px", height: "32px" }}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(acc)}
                          disabled={isBusy}
                          className="icon-button"
                          title="Delete account (blocked if transactions exist)"
                          style={{ width: "32px", height: "32px", color: "var(--danger)" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div
            style={{
              marginTop: "24px",
              padding: "14px 18px",
              borderRadius: "8px",
              background: "var(--amber-soft)",
              border: "1px solid var(--amber-border)",
              color: "var(--amber-primary)",
              fontSize: "0.82rem",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <Shield size={18} style={{ flexShrink: 0 }} />
            <span>
              <strong>Security Policy:</strong> Adding, updating, or deleting receiving accounts requires password re-authentication. Furthermore, accounts that have linked member payments or expenses cannot be deleted to preserve audit trails.
            </span>
          </div>
        </div>
      )}

      {/* 3. MEMBERSHIP & DUE RULES */}
      {activeTab === "membership" && (
        <form onSubmit={handleSaveSettings} className="glass-panel" style={{ padding: "28px" }}>
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "1.15rem", marginBottom: "4px" }}>Membership Lifecycle & Billing Rules</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
              Configure grace periods, freezing limits, and automated fee reminders.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
              gap: "24px",
            }}
          >
            <div className="form-group">
              <label className="form-label">
                <Clock size={15} />
                Invoice Due Grace Period (Days) *
              </label>
              <input
                type="number"
                min={1}
                max={30}
                className="form-input"
                value={invoiceDueDays}
                onChange={(e) => setInvoiceDueDays(Number(e.target.value))}
                required
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Number of days allowed from invoice generation until payment is marked overdue.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">
                <RotateCcw size={15} />
                Maximum Allowed Freeze Duration (Days) *
              </label>
              <input
                type="number"
                min={1}
                max={90}
                className="form-input"
                value={maxFreezeDays}
                onChange={(e) => setMaxFreezeDays(Number(e.target.value))}
                required
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Staff cannot freeze a member's pass for longer than this limit without Owner approval.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">
                <Bell size={15} />
                Expiry Reminder Thresholds (Days Before Expiry)
              </label>
              <input
                type="text"
                className="form-input"
                value={expiryReminderDays}
                onChange={(e) => setExpiryReminderDays(e.target.value)}
                placeholder="7, 1"
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Comma-separated list of days before plan expiry to send renewal alerts (e.g. 7, 1).
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">
                <Bell size={15} />
                Overdue Follow-up Intervals (Days After Due Date)
              </label>
              <input
                type="text"
                className="form-input"
                value={overdueReminderDays}
                onChange={(e) => setOverdueReminderDays(e.target.value)}
                placeholder="3"
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Days after due date to ping members with outstanding balances (e.g. 3).
              </span>
            </div>

            <div
              className="form-group"
              style={{
                gridColumn: "1 / -1",
                padding: "16px",
                background: "var(--bg-secondary)",
                borderRadius: "8px",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={dueDateReminderEnabled}
                  onChange={(e) => setDueDateReminderEnabled(e.target.checked)}
                  style={{ width: "18px", height: "18px" }}
                />
                <span>Enable Automated Due Date & Expiry Reminder System</span>
              </label>
              <p
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-muted)",
                  marginTop: "6px",
                  marginLeft: "28px",
                }}
              >
                When active, scheduled jobs and reports will flag expiring plans and prompt notifications.
              </p>
            </div>
          </div>
        </form>
      )}

      {/* 4. RECEIPTS & TEMPLATES */}
      {activeTab === "receipts" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))",
            gap: "24px",
            alignItems: "start",
          }}
        >
          {/* Form */}
          <form onSubmit={handleSaveSettings} className="glass-panel" style={{ padding: "28px" }}>
            <div style={{ marginBottom: "20px" }}>
              <h3 style={{ fontSize: "1.15rem", marginBottom: "4px" }}>Receipt Customization</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                Control prefix sequence, print dimensions, and footer legal disclaimers.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Receipt Number Prefix *</label>
              <input
                type="text"
                className="form-input"
                value={receiptPrefix}
                onChange={(e) => setReceiptPrefix(e.target.value.toUpperCase())}
                required
                placeholder="OXG-RCP"
                style={{ fontFamily: "monospace", letterSpacing: "1px" }}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Receipts will be numbered sequentially like: <code>{receiptPrefix}-202610-0001</code>
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Receipt Print Layout</label>
              <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                <label
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid",
                    borderColor:
                      receiptPrintFormat === "A4" ? "var(--accent-primary)" : "var(--border-subtle)",
                    backgroundColor:
                      receiptPrintFormat === "A4" ? "var(--accent-soft)" : "var(--bg-surface)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="printFormat"
                    value="A4"
                    checked={receiptPrintFormat === "A4"}
                    onChange={(e) => setReceiptPrintFormat(e.target.value)}
                  />
                  <div>
                    <strong style={{ display: "block", fontSize: "0.85rem" }}>A4 Standard</strong>
                    <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                      Full page format with logo & tables
                    </span>
                  </div>
                </label>

                <label
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid",
                    borderColor:
                      receiptPrintFormat === "THERMAL_80MM"
                        ? "var(--accent-primary)"
                        : "var(--border-subtle)",
                    backgroundColor:
                      receiptPrintFormat === "THERMAL_80MM"
                        ? "var(--accent-soft)"
                        : "var(--bg-surface)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="printFormat"
                    value="THERMAL_80MM"
                    checked={receiptPrintFormat === "THERMAL_80MM"}
                    onChange={(e) => setReceiptPrintFormat(e.target.value)}
                  />
                  <div>
                    <strong style={{ display: "block", fontSize: "0.85rem" }}>Thermal 80mm</strong>
                    <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                      POS counter roll printer
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Receipt Footer Notes & Policy</label>
              <textarea
                className="form-input"
                rows={3}
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                placeholder="e.g. Thank you for choosing OXGEN GYM. Fees are non-refundable."
              />
            </div>

            <div
              style={{
                padding: "14px",
                background: "var(--bg-secondary)",
                borderRadius: "8px",
                marginTop: "16px",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={emailReceiptsAutomatically}
                  onChange={(e) => setEmailReceiptsAutomatically(e.target.checked)}
                />
                <span>Email Receipts Automatically to Members on Payment</span>
              </label>
            </div>
          </form>

          {/* Live Preview Card */}
          <div className="glass-panel" style={{ padding: "28px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Eye size={18} style={{ color: "var(--accent-primary)" }} />
                <h4 style={{ fontSize: "1rem" }}>Receipt Live Preview</h4>
              </div>
              <span className="badge badge-receptionist">
                <Printer size={12} />
                {receiptPrintFormat === "A4" ? "A4 Page" : "Thermal 80mm"}
              </span>
            </div>

            <div
              style={{
                background: "#ffffff",
                border: "1px dashed var(--border-medium)",
                borderRadius: "8px",
                padding: "24px",
                color: "#1a1a1a",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                fontFamily: receiptPrintFormat === "THERMAL_80MM" ? "monospace" : "inherit",
                maxWidth: receiptPrintFormat === "THERMAL_80MM" ? "300px" : "100%",
                margin: "0 auto",
              }}
            >
              <div style={{ textAlign: "center", borderBottom: "1px solid #e0e0e0", paddingBottom: "16px" }}>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0 }}>{gymName}</h3>
                {tagline && <p style={{ fontSize: "0.78rem", color: "#666", margin: "2px 0 6px" }}>{tagline}</p>}
                <div style={{ fontSize: "0.74rem", color: "#666" }}>
                  <div>{contactPhone} &bull; {contactEmail}</div>
                  <div>{address || "Lahore, Pakistan"}</div>
                </div>
              </div>

              <div
                style={{
                  padding: "16px 0",
                  borderBottom: "1px solid #e0e0e0",
                  fontSize: "0.8rem",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <span style={{ color: "#777", display: "block" }}>Receipt No:</span>
                  <strong style={{ fontFamily: "monospace" }}>{receiptPrefix}-202610-0104</strong>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ color: "#777", display: "block" }}>Date:</span>
                  <span>{new Date().toLocaleDateString("en-GB")}</span>
                </div>
              </div>

              <div style={{ padding: "16px 0", borderBottom: "1px solid #e0e0e0", fontSize: "0.82rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span>Monthly Membership (Gold Plan)</span>
                  <strong>PKR 7,500</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#059669", fontWeight: 700 }}>
                  <span>Paid (Cash / Bank)</span>
                  <span>PKR 7,500</span>
                </div>
              </div>

              <div style={{ paddingTop: "16px", textAlign: "center", fontSize: "0.75rem", color: "#666" }}>
                <p style={{ margin: 0, fontStyle: "italic" }}>{receiptFooter}</p>
              </div>
            </div>

            <p style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "14px", textAlign: "center" }}>
              * Receipt branding is snapshotted at time of payment creation so historical receipts remain unaltered.
            </p>
          </div>
        </div>
      )}

      {/* 5. STAFF PERMISSIONS */}
      {activeTab === "staff" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <h3 style={{ fontSize: "1.15rem", marginBottom: "4px" }}>Staff Role & Granular Permissions</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                Control what Receptionists and Trainers can access. Changing permissions immediately revokes active sessions.
              </p>
            </div>
          </div>

          <div className="glass-panel" style={{ overflow: "hidden" }}>
            <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border-subtle)" }}>
                  <th style={{ padding: "14px 18px" }}>Staff Member</th>
                  <th style={{ padding: "14px 18px" }}>Role</th>
                  <th style={{ padding: "14px 18px" }}>Status</th>
                  <th style={{ padding: "14px 18px" }}>Granted Permissions</th>
                  <th style={{ padding: "14px 18px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffList.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
                      No staff members found. Add Receptionists or Trainers from the Team dashboard.
                    </td>
                  </tr>
                ) : (
                  staffList.map((member) => {
                    const grants = (member.permissionGrants as Record<string, boolean>) || {};
                    const isReceptionist = member.role === Role.RECEPTIONIST;

                    return (
                      <tr key={member.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "14px 18px" }}>
                          <div>
                            <strong style={{ display: "block" }}>{member.name}</strong>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              {member.email || member.phone || "No contact info"}
                            </span>
                          </div>
                        </td>

                        <td style={{ padding: "14px 18px" }}>
                          <span
                            className={`badge ${
                              member.role === Role.RECEPTIONIST ? "badge-receptionist" : "badge-trainer"
                            }`}
                          >
                            {member.role}
                          </span>
                        </td>

                        <td style={{ padding: "14px 18px" }}>
                          <span
                            className={`badge ${
                              member.status === "ACTIVE" ? "badge-active" : "badge-pending"
                            }`}
                          >
                            {member.status}
                          </span>
                        </td>

                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {/* Expenses Manage */}
                            {grants.EXPENSES_MANAGE ? (
                              <span className="badge badge-member" title="Can create and manage gym expenses">
                                Expenses Manage: YES
                              </span>
                            ) : (
                              <span
                                className="badge"
                                style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}
                              >
                                Expenses: View Only
                              </span>
                            )}

                            {/* Attendance */}
                            {(grants.ATTENDANCE_MANAGE ?? isReceptionist) ? (
                              <span className="badge badge-member">Attendance Check-in</span>
                            ) : null}

                            {/* Member Register */}
                            {(grants.MEMBER_REGISTER_UPDATE ?? isReceptionist) ? (
                              <span className="badge badge-member">Register Members</span>
                            ) : null}

                            {/* Payments */}
                            {(grants.PAYMENT_RECORD_VERIFY ?? isReceptionist) ? (
                              <span className="badge badge-member">Record Payments</span>
                            ) : null}
                          </div>
                        </td>

                        <td style={{ padding: "14px 18px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            {member.status === "PENDING" && (
                              <button
                                type="button"
                                onClick={() => handleResendStaffInvite(member)}
                                disabled={resendingStaffId === member.id}
                                className="btn-secondary"
                                style={{ padding: "6px 12px", fontSize: "0.78rem", minHeight: "32px", color: "var(--accent-primary)" }}
                                title="Resend invitation link (invalidates old link)"
                              >
                                <Mail size={13} />
                                <span>{resendingStaffId === member.id ? "Sending..." : "Resend Invite"}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStaff(member);
                                setIsStaffModalOpen(true);
                              }}
                              className="btn-secondary"
                              style={{ padding: "6px 12px", fontSize: "0.78rem", minHeight: "32px" }}
                            >
                              <Shield size={13} />
                              <span>Edit Permissions</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table></div>
          </div>

          <div
            style={{
              marginTop: "20px",
              padding: "14px 18px",
              borderRadius: "8px",
              background: "var(--blue-soft)",
              border: "1px solid var(--blue-border)",
              color: "var(--blue-primary)",
              fontSize: "0.82rem",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <Info size={18} style={{ flexShrink: 0 }} />
            <span>
              <strong>Immediate Security Revocation:</strong> When you modify permissions for any staff member, their existing browser sessions are instantly terminated in the database. They must log back in to activate their newly granted or restricted privileges.
            </span>
          </div>
        </div>
      )}

      {/* 6. ATTENDANCE & OPERATIONAL PREFERENCES */}
      {activeTab === "attendance" && (
        <form onSubmit={handleSaveSettings} className="glass-panel" style={{ padding: "28px" }}>
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "1.15rem", marginBottom: "4px" }}>Attendance & Operational Controls</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
              Enable or disable the optional daily check-in feature without interrupting memberships or billing.
            </p>
          </div>

          <div
            style={{
              padding: "20px",
              borderRadius: "8px",
              background: attendanceEnabled ? "var(--accent-soft)" : "var(--bg-secondary)",
              border: "1px solid",
              borderColor: attendanceEnabled ? "var(--border-accent)" : "var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ maxWidth: "600px" }}>
              <strong style={{ fontSize: "0.95rem", display: "block" }}>
                Gym Member Attendance Tracking (Feature 13)
              </strong>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "4px" }}>
                When enabled, the Attendance check-in page is active for receptionists to scan or search members entering the gym. When disabled, attendance features are tucked away, and the system functions purely for billing, memberships, and receipts.
              </p>
            </div>

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                padding: "8px 16px",
                borderRadius: "20px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-medium)",
              }}
            >
              <input
                type="checkbox"
                checked={attendanceEnabled}
                onChange={(e) => setAttendanceEnabled(e.target.checked)}
                style={{ width: "20px", height: "20px" }}
              />
              <span style={{ fontWeight: 650, fontSize: "0.85rem" }}>
                {attendanceEnabled ? "Attendance: ENABLED" : "Attendance: DISABLED"}
              </span>
            </label>
          </div>
        </form>
      )}

      {/* 7. AUDIT HISTORY LEDGER */}
      {activeTab === "audit" && (
        <div>
          <AuditLogsViewer />
        </div>
      )}

      {/* 8. SYSTEM HEALTH & VERSION */}
      {activeTab === "system" && (
        <div className="glass-panel" style={{ padding: "28px" }}>
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "1.15rem", marginBottom: "4px" }}>System State & Concurrency Governance</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
              Review the current optimistic locking version counter and environment health.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
              gap: "16px",
            }}
          >
            <div
              style={{
                padding: "16px",
                background: "var(--bg-secondary)",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>
                Settings Version Counter
              </span>
              <strong style={{ fontSize: "1.4rem", fontFamily: "monospace", color: "var(--accent-primary)" }}>
                v{settings.version || 1}
              </strong>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>
                Increments atomically on every validated save.
              </span>
            </div>

            <SystemHealth />
          </div>
        </div>
      )}

      {/* MODALS */}

      {/* Password Re-Authentication Modal */}
      <PasswordReauthModal
        isOpen={isReauthModalOpen}
        onClose={() => {
          setIsReauthModalOpen(false);
          setPendingActionAfterReauth(null);
        }}
        onSuccess={() => {
          setIsReauthModalOpen(false);
          if (pendingActionAfterReauth) {
            const action = pendingActionAfterReauth;
            setPendingActionAfterReauth(null);
            action();
          }
        }}
      />

      {/* Receiving Account Modal */}
      <PaymentAccountModal
        isOpen={isAccountModalOpen}
        onClose={() => {
          setIsAccountModalOpen(false);
          setEditingAccount(null);
        }}
        onSuccess={() => {
          setIsAccountModalOpen(false);
          setEditingAccount(null);
          refreshAllData();
        }}
        onRequireReauth={() => {
          setIsAccountModalOpen(false);
          setPendingActionAfterReauth(() => () => setIsAccountModalOpen(true));
          setIsReauthModalOpen(true);
        }}
        initialAccount={editingAccount}
      />

      {/* Staff Permission Modal */}
      <StaffPermissionModal
        isOpen={isStaffModalOpen}
        onClose={() => {
          setIsStaffModalOpen(false);
          setEditingStaff(null);
        }}
        onSuccess={() => {
          setIsStaffModalOpen(false);
          setEditingStaff(null);
          refreshAllData();
        }}
        staffUser={editingStaff}
      />

      {/* Resend Staff Invitation Link Modal */}
      {resendInviteData && (
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
              maxWidth: "480px",
              padding: "28px",
              background: "var(--bg-surface)",
              position: "relative",
            }}
          >
            <button
              onClick={() => {
                setResendInviteData(null);
                setCopiedLink(false);
              }}
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
            <h3 style={{ fontSize: "1.15rem", marginBottom: "6px" }}>
              Invitation Link Re-issued
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: "16px" }}>
              Previous links have been invalidated. Share this new 48-hour activation link with <strong>{resendInviteData.name}</strong>:
            </p>
            <div
              style={{
                display: "flex",
                gap: "8px",
                background: "var(--bg-secondary)",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                marginBottom: "20px",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                readOnly
                value={resendInviteData.link}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-main)",
                  fontSize: "0.82rem",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(resendInviteData.link);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="btn-secondary"
                style={{ padding: "6px 12px", fontSize: "0.78rem", flexShrink: 0 }}
              >
                {copiedLink ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{copiedLink ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setResendInviteData(null);
                setCopiedLink(false);
              }}
              className="btn-primary"
              style={{ width: "100%" }}
            >
              Done
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
