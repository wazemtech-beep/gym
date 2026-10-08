"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import {
  User,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  DollarSign,
  Receipt,
  Dumbbell,
  Heart,
  Activity,
  CalendarCheck,
  Smartphone,
  History,
  Edit3,
  Archive,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Shield,
  Copy,
  Check,
  Plus,
  Snowflake,
  Printer,
  KeyRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { Role } from "@prisma/client";
import OpeningBalanceCorrection from "./OpeningBalanceCorrection";
import EditDetailsModal from "./EditDetailsModal";
import AssignMembershipModal from "./AssignMembershipModal";
import RecordPaymentModal from "./RecordPaymentModal";
import AssignTrainerModal from "./AssignTrainerModal";
import ArchiveMemberModal from "./ArchiveMemberModal";
import ReceiptModal from "@/components/receipts/ReceiptModal";

interface MemberProfileProps {
  initialMember: any;
  auditLogs: any[];
  currentUserRole: Role;
}

export default function MemberProfileClient({
  initialMember,
  auditLogs,
  currentUserRole,
}: MemberProfileProps) {
  const [member, setMember] = useState(initialMember);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false);
  const [membershipModalMode, setMembershipModalMode] = useState<"ASSIGN" | "FREEZE">("ASSIGN");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isTrainerModalOpen, setIsTrainerModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [viewReceiptId, setViewReceiptId] = useState<string | null>(null);

  // App access generation state
  const [activationInfo, setActivationInfo] = useState<any>(null);
  const [appAccessLoading, setAppAccessLoading] = useState(false);

  // Attendance marking state
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [attendanceSuccess, setAttendanceSuccess] = useState<string | null>(null);

  const refreshMember = async () => {
    try {
      const res = await apiFetch(`/api/v1/members/${member.id}`);
      const data = await res.json();
      if (data.success) {
        setMember(data.member);
      }
    } catch (err) {
      console.error("Failed to refresh member data:", err);
    }
  };

  const handleGenerateActivation = async () => {
    try {
      setAppAccessLoading(true);
      const res = await apiFetch(`/api/v1/members/${member.id}/app-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ACTIVATE_INVITE" }),
      });
      const data = await res.json();
      if (data.success) {
        setActivationInfo(data);
      } else {
        alert(data.error || "Failed to generate activation code.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAppAccessLoading(false);
    }
  };

  const handleToggleSuspend = async () => {
    try {
      setAppAccessLoading(true);
      const res = await apiFetch(`/api/v1/members/${member.id}/app-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "TOGGLE_SUSPEND" }),
      });
      const data = await res.json();
      if (data.success) {
        refreshMember();
      } else {
        alert(data.error || "Failed to toggle status.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAppAccessLoading(false);
    }
  };

  const [resetCodeModal, setResetCodeModal] = useState<{ memberName: string; code: string; expiresAt: string } | null>(null);
  const [resetCodeLoading, setResetCodeLoading] = useState(false);
  const [copiedResetCode, setCopiedResetCode] = useState(false);

  const handleGenerateResetCode = async () => {
    try {
      setResetCodeLoading(true);
      const res = await apiFetch(`/api/v1/members/${member.id}/reset-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Reset code generate nahi ho saka.");
        return;
      }
      setResetCodeModal({
        memberName: data.memberName || member.fullName,
        code: data.resetCode,
        expiresAt: new Date(data.expiresAt).toLocaleTimeString(),
      });
    } catch {
      alert("Server error.");
    } finally {
      setResetCodeLoading(false);
    }
  };

  const handleMarkAttendance = async () => {
    try {
      setMarkingAttendance(true);
      setAttendanceSuccess(null);
      const res = await apiFetch(`/api/v1/members/${member.id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "MANUAL" }),
      });
      const data = await res.json();
      if (data.success) {
        setAttendanceSuccess("Attendance mark ho gayi!");
        refreshMember();
        setTimeout(() => setAttendanceSuccess(null), 4000);
      } else {
        alert(data.error || "Attendance mark karne mein khata aayi.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMarkingAttendance(false);
    }
  };

  const initials = member.fullName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const isOwner = currentUserRole === Role.OWNER;
  const currentPlan = member.memberships && member.memberships.length > 0 ? member.memberships[0] : null;

  return (
    <div>
      {/* Breadcrumb Back Link */}
      <div style={{ marginBottom: "16px" }}>
        <Link
          href="/admin/members"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--text-secondary)",
            fontSize: "0.85rem",
            textDecoration: "none",
          }}
        >
          ← Back to Members Directory
        </Link>
      </div>

      {/* Top Profile Header Card (Point 6) */}
      <div
        className="glass-card"
        style={{
          padding: "24px 28px",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {/* Avatar / Photo */}
          {member.photoUrl ? (
            <img
              src={member.photoUrl}
              alt={member.fullName}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "18px",
                objectFit: "cover",
                border: "2px solid var(--border-subtle)",
              }}
            />
          ) : (
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "18px",
                background: "var(--accent-soft)",
                border: "2px solid var(--border-accent)",
                color: "var(--accent-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "1.6rem",
              }}
            >
              {initials}
            </div>
          )}

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                {member.fullName}
              </h1>

              {/* Member ID Badge */}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "var(--accent-primary)",
                  padding: "4px 10px",
                  borderRadius: "8px",
                  background: "var(--accent-soft)",
                  border: "1px solid var(--border-accent)",
                }}
              >
                {member.memberId}
              </span>

              {/* Status Badges */}
              {member.status === "ARCHIVED" ? (
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "3px 10px",
                    borderRadius: "12px",
                    background: "var(--danger-soft)",
                    border: "1px solid var(--danger-border)",
                    color: "var(--danger)",
                    fontWeight: 700,
                  }}
                >
                  ARCHIVED
                </span>
              ) : (
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "3px 10px",
                    borderRadius: "12px",
                    background: "var(--accent-soft)",
                    border: "1px solid var(--border-accent)",
                    color: "var(--accent-primary)",
                    fontWeight: 700,
                  }}
                >
                  CURRENT ROSTER
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "6px", flexWrap: "wrap", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Phone size={14} /> {member.phone}
              </span>
              {member.email && (
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Mail size={14} /> {member.email}
                </span>
              )}
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Calendar size={14} /> Joined: {new Date(member.joiningDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Summary Badges & Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Outstanding Dues Counter */}
          <div
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              background: member.totalDues > 0 ? "var(--amber-soft)" : "var(--accent-soft)",
              border: member.totalDues > 0 ? "1px solid var(--amber-border)" : "1px solid var(--border-accent)",
              textAlign: "right",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
              Outstanding Balance
            </div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: member.totalDues > 0 ? "var(--amber-primary)" : "var(--accent-primary)",
              }}
            >
              Rs. {member.totalDues ? member.totalDues.toLocaleString() : "0"}
            </div>
          </div>

          {/* Quick Pay Button */}
          {member.totalDues > 0 && (
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 16px" }}
            >
              <DollarSign size={16} />
              Record Payment
            </button>
          )}

          {/* Mark Attendance Button */}
          <button
            onClick={handleMarkAttendance}
            disabled={markingAttendance}
            className="btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 14px" }}
            title="Mark attendance check-in"
          >
            <CalendarCheck size={16} color="var(--accent-primary)" />
            {markingAttendance ? "Marking..." : "Check-in"}
          </button>

          {isOwner && <OpeningBalanceCorrection memberId={member.id} onSaved={refreshMember} />}
          {/* Edit Details Button */}
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 14px" }}
          >
            <Edit3 size={15} />
            Edit
          </button>

          {/* Assign / Change Trainer Button (Feature 16) */}
          {isOwner && (
            <button
              onClick={() => setIsTrainerModalOpen(true)}
              className="btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 14px", color: "var(--purple-primary)" }}
            >
              <Dumbbell size={15} />
              {member.trainer ? "Change Trainer" : "Assign Trainer"}
            </button>
          )}

          {/* Reset Password Code Button (Walk-in Members) */}
          {(isOwner || currentUserRole === Role.RECEPTIONIST) && (
            <button
              onClick={handleGenerateResetCode}
              disabled={resetCodeLoading}
              className="btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 14px" }}
              title="Issue temporary 6-digit password reset code for member"
            >
              <KeyRound size={15} />
              {resetCodeLoading ? "Generating..." : "Reset Code"}
            </button>
          )}

          {/* Archive / Unarchive Button (strictly Owner Only, Point 10 & 11) */}
          {isOwner && (
            <button
              onClick={() => setIsArchiveModalOpen(true)}
              className="btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 14px",
                color: member.status === "ARCHIVED" ? "var(--accent-primary)" : "var(--danger)",
                borderColor: member.status === "ARCHIVED" ? "var(--border-accent)" : "var(--danger-border)",
              }}
            >
              {member.status === "ARCHIVED" ? <RotateCcw size={15} /> : <Archive size={15} />}
              {member.status === "ARCHIVED" ? "Unarchive" : "Archive"}
            </button>
          )}
        </div>
      </div>

      {/* Attendance Success Toast Notification */}
      {attendanceSuccess && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "10px",
            background: "var(--accent-soft)",
            border: "1px solid var(--border-accent)",
            color: "var(--accent-primary)",
            fontSize: "0.88rem",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <CheckCircle2 size={18} />
          {attendanceSuccess}
        </div>
      )}

      {/* Archive Notice Banner if Archived */}
      {member.status === "ARCHIVED" && (
        <div
          style={{
            padding: "14px 20px",
            borderRadius: "12px",
            background: "var(--danger-soft)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger)",
            fontSize: "0.88rem",
            marginBottom: "24px",
          }}
        >
          <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", color: "var(--danger)" }}>
            <Archive size={16} />
            Yeh Member Archived Hai
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "0.825rem", color: "var(--text-secondary)" }}>
            Reason: <em>{member.archiveReason || "Not specified"}</em> • Archived Date:{" "}
            {member.archivedAt ? new Date(member.archivedAt).toLocaleDateString() : "N/A"}. Financial records are
            preserved and dues follow-up remains active.
          </p>
        </div>
      )}

      {/* Tab Navigation (Point 6: 9 Specific Tabs) */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-subtle)",
          marginBottom: "24px",
          overflowX: "auto",
          gap: "4px",
        }}
      >
        {[
          { id: "overview", label: "Overview", icon: Activity },
          { id: "personal", label: "Personal Details", icon: User },
          { id: "memberships", label: "Memberships", icon: CreditCard },
          { id: "invoices", label: "Invoices & Payments", icon: Receipt },
          { id: "training", label: "Training & Coaching", icon: Dumbbell },
          { id: "progress", label: "Progress Log", icon: Heart },
          { id: "attendance", label: "Attendance", icon: CalendarCheck },
          { id: "app-access", label: "App Access", icon: Smartphone },
          { id: "history", label: "History (Audit)", icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 18px",
                border: "none",
                background: "transparent",
                color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
                fontWeight: isActive ? 700 : 500,
                fontSize: "0.875rem",
                borderBottom: isActive ? "2px solid var(--accent-primary)" : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content Display */}

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Current Membership Plan Card */}
            <div className="glass-card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <CreditCard size={18} color="var(--accent-primary)" />
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                    Active Membership Plan
                  </h3>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {currentPlan && currentPlan.status === "ACTIVE" && (
                    <button
                      onClick={() => {
                        setMembershipModalMode("FREEZE");
                        setIsMembershipModalOpen(true);
                      }}
                      className="btn-secondary"
                      style={{ padding: "6px 12px", fontSize: "0.785rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <Snowflake size={14} color="#38bdf8" />
                      Freeze
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setMembershipModalMode("ASSIGN");
                      setIsMembershipModalOpen(true);
                    }}
                    className="btn-secondary"
                    style={{ padding: "6px 12px", fontSize: "0.785rem" }}
                  >
                    {currentPlan ? "Renew Plan" : "Assign Plan"}
                  </button>
                </div>
              </div>

              {currentPlan ? (
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)" }}>
                        {currentPlan.planName}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                        Subscription Period: {new Date(currentPlan.startDate).toLocaleDateString()} to{" "}
                        {new Date(currentPlan.endDate).toLocaleDateString()}
                      </div>
                    </div>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "8px",
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        background:
                          currentPlan.status === "ACTIVE"
                            ? "var(--accent-soft)"
                            : currentPlan.status === "FROZEN"
                            ? "var(--blue-soft)"
                            : "var(--danger-soft)",
                        color:
                          currentPlan.status === "ACTIVE"
                            ? "var(--accent-primary)"
                            : currentPlan.status === "FROZEN"
                            ? "var(--blue-primary)"
                            : "var(--danger)",
                      }}
                    >
                      {currentPlan.status}
                    </span>
                  </div>

                  {currentPlan.status === "FROZEN" && currentPlan.freezeReason && (
                    <div style={{ fontSize: "0.8rem", color: "var(--blue-primary)", marginTop: "8px" }}>
                      Frozen Reason: {currentPlan.freezeReason}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)", fontStyle: "italic" }}>
                  <p style={{ margin: "0 0 12px" }}>Is member ko abhi tak koi membership plan assign nahi kiya gaya.</p>
                  <button
                    onClick={() => {
                      setMembershipModalMode("ASSIGN");
                      setIsMembershipModalOpen(true);
                    }}
                    className="btn-primary"
                    style={{ padding: "8px 18px", fontSize: "0.85rem" }}
                  >
                    Assign Membership Now
                  </button>
                </div>
              )}
            </div>

            {/* Invoices & Dues Snapshot */}
            <div className="glass-card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Receipt size={18} color="var(--accent-primary)" />
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                    Invoices & Payment Snapshot
                  </h3>
                </div>
                <button
                  onClick={() => setActiveTab("invoices")}
                  className="btn-secondary"
                  style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                >
                  View All
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: "14px" }}>
                <div style={{ padding: "14px", borderRadius: "10px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "0.785rem", color: "var(--text-secondary)" }}>Total Dues Baqi</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 700, color: member.totalDues > 0 ? "var(--amber-primary)" : "var(--accent-primary)", marginTop: "4px" }}>
                    Rs. {member.totalDues?.toLocaleString() || "0"}
                  </div>
                </div>

                <div style={{ padding: "14px", borderRadius: "10px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "0.785rem", color: "var(--text-secondary)" }}>Total Fees Confirmed Paid</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--accent-primary)", marginTop: "4px" }}>
                    Rs. {member.totalPaid?.toLocaleString() || "0"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Coaching, App Access & Staff Notes */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Trainer Coaching Card */}
            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Dumbbell size={16} color="var(--accent-primary)" />
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                    Assigned Trainer
                  </h4>
                </div>
                {isOwner && (
                  <button
                    onClick={() => setIsTrainerModalOpen(true)}
                    className="btn-secondary"
                    style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                  >
                    Change
                  </button>
                )}
              </div>

              {member.trainer ? (
                <div>
                  <div style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "1rem" }}>
                    {member.trainer.name}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                    Email: {member.trainer.email || "N/A"}
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontStyle: "italic" }}>
                  Koi trainer assigned nahi hai.
                </div>
              )}

              {member.fitnessGoal && (
                <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border-subtle)" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Goal: </span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--accent-primary)" }}>
                    {member.fitnessGoal}
                  </span>
                </div>
              )}
            </div>

            {/* App Access Card */}
            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <Smartphone size={16} color="var(--accent-primary)" />
                <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                  Mobile App Status
                </h4>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  style={{
                    fontSize: "0.8rem",
                    padding: "3px 10px",
                    borderRadius: "12px",
                    fontWeight: 700,
                    background:
                      member.appAccessStatus === "ACTIVE"
                        ? "var(--accent-soft)"
                        : member.appAccessStatus === "SUSPENDED"
                        ? "var(--danger-soft)"
                        : "var(--bg-secondary)",
                    color:
                      member.appAccessStatus === "ACTIVE"
                        ? "var(--accent-primary)"
                        : member.appAccessStatus === "SUSPENDED"
                        ? "var(--danger)"
                        : "var(--text-secondary)",
                  }}
                >
                  {member.appAccessStatus === "ACTIVE"
                    ? "Active Login"
                    : member.appAccessStatus === "SUSPENDED"
                    ? "Suspended"
                    : "Not Activated"}
                </span>

                <button
                  onClick={() => setActiveTab("app-access")}
                  className="btn-secondary"
                  style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                >
                  Manage Access
                </button>
              </div>
            </div>

            {/* Internal Staff Note */}
            <div className="glass-card" style={{ padding: "20px" }}>
              <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)", margin: "0 0 8px" }}>
                Staff Internal Note
              </h4>
              <p style={{ margin: 0, fontSize: "0.85rem", color: member.staffNote ? "var(--text-primary)" : "var(--text-secondary)", fontStyle: member.staffNote ? "normal" : "italic" }}>
                {member.staffNote || "Koi internal note darj nahi hai."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PERSONAL DETAILS */}
      {activeTab === "personal" && (
        <div className="glass-card" style={{ padding: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
              
              Personal details
            </h3>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px" }}
            >
              <Edit3 size={15} />
              Edit Personal Details
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "20px" }}>
            <div style={{ padding: "14px", borderRadius: "10px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Full Name</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-main)", marginTop: "4px" }}>
                {member.fullName}
              </div>
            </div>

            <div style={{ padding: "14px", borderRadius: "10px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Phone Number (Normalized)</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--accent-primary)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
                {member.phone}
              </div>
            </div>

            <div style={{ padding: "14px", borderRadius: "10px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Email Address</div>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-main)", marginTop: "4px" }}>
                {member.email || "Not Provided"}
              </div>
            </div>

            <div style={{ padding: "14px", borderRadius: "10px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Joining Date</div>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-main)", marginTop: "4px" }}>
                {new Date(member.joiningDate).toLocaleDateString()}
              </div>
            </div>

            <div style={{ padding: "14px", borderRadius: "10px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Date of Birth</div>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-main)", marginTop: "4px" }}>
                {member.dateOfBirth ? new Date(member.dateOfBirth).toLocaleDateString() : "Not Provided"}
              </div>
            </div>

            <div style={{ padding: "14px", borderRadius: "10px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Address</div>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-main)", marginTop: "4px" }}>
                {member.address || "Not Provided"}
              </div>
            </div>

            <div style={{ padding: "14px", borderRadius: "10px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Emergency Contact Name</div>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-main)", marginTop: "4px" }}>
                {member.emergencyContactName || "Not Provided"}
              </div>
            </div>

            <div style={{ padding: "14px", borderRadius: "10px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Emergency Contact Phone</div>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-main)", marginTop: "4px" }}>
                {member.emergencyContactPhone || "Not Provided"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MEMBERSHIPS */}
      {activeTab === "memberships" && (
        <div className="glass-card" style={{ padding: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                Membership History & Plans
              </h3>
              
            </div>
            <button
              onClick={() => {
                setMembershipModalMode("ASSIGN");
                setIsMembershipModalOpen(true);
              }}
              className="btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px" }}
            >
              <Plus size={16} />
              Assign New Plan
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                  <th style={{ padding: "10px 14px" }}>Plan Name</th>
                  <th style={{ padding: "10px 14px" }}>Start Date</th>
                  <th style={{ padding: "10px 14px" }}>End Date</th>
                  <th style={{ padding: "10px 14px" }}>Plan Fee</th>
                  <th style={{ padding: "10px 14px" }}>Status</th>
                  <th style={{ padding: "10px 14px" }}>Notes / Freeze</th>
                </tr>
              </thead>
              <tbody>
                {member.memberships && member.memberships.length > 0 ? (
                  member.memberships.map((m: any) => (
                    <tr key={m.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "14px", fontWeight: 700, color: "var(--text-main)" }}>{m.planName}</td>
                      <td style={{ padding: "14px", color: "var(--text-secondary)" }}>
                        {new Date(m.startDate).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "14px", color: "var(--text-secondary)" }}>
                        {new Date(m.endDate).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "14px", fontWeight: 700, color: "var(--accent-primary)" }}>
                        Rs. {m.feeAmount?.toLocaleString() || "0"}
                      </td>
                      <td style={{ padding: "14px" }}>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontWeight: 700,
                            background:
                              m.status === "ACTIVE"
                                ? "var(--accent-soft)"
                                : m.status === "FROZEN"
                                ? "var(--blue-soft)"
                                : "var(--danger-soft)",
                            color:
                              m.status === "ACTIVE"
                                ? "var(--accent-primary)"
                                : m.status === "FROZEN"
                                ? "var(--blue-primary)"
                                : "var(--danger)",
                          }}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td style={{ padding: "14px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {m.freezeReason ? `Freeze: ${m.freezeReason}` : m.notes || "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>
                      Koi membership plan record nahi mila.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: INVOICES & PAYMENTS */}
      {activeTab === "invoices" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Unpaid / Active Invoices */}
          <div className="glass-card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                  Invoices & Outstanding Dues
                </h3>
                
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px" }}
              >
                <DollarSign size={16} />
                Record Payment
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                    <th style={{ padding: "10px 12px" }}>Invoice #</th>
                    <th style={{ padding: "10px 12px" }}>Description</th>
                    <th style={{ padding: "10px 12px" }}>Total Amount</th>
                    <th style={{ padding: "10px 12px" }}>Paid Amount</th>
                    <th style={{ padding: "10px 12px" }}>Balance Due</th>
                    <th style={{ padding: "10px 12px" }}>Due Date</th>
                    <th style={{ padding: "10px 12px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {member.invoices && member.invoices.length > 0 ? (
                    member.invoices.map((inv: any) => (
                      <tr key={inv.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "12px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent-primary)" }}>
                          {inv.invoiceNumber}
                        </td>
                        <td style={{ padding: "12px", color: "var(--text-main)", fontWeight: 600 }}>{inv.title}</td>
                        <td style={{ padding: "12px" }}>Rs. {inv.totalAmount.toLocaleString()}</td>
                        <td style={{ padding: "12px", color: "var(--accent-primary)" }}>Rs. {inv.paidAmount.toLocaleString()}</td>
                        <td style={{ padding: "12px", fontWeight: 700, color: inv.balanceAmount > 0 ? "var(--amber-primary)" : "var(--accent-primary)" }}>
                          Rs. {inv.balanceAmount.toLocaleString()}
                        </td>
                        <td style={{ padding: "12px", color: "var(--text-secondary)" }}>
                          {new Date(inv.dueDate).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              padding: "3px 8px",
                              borderRadius: "4px",
                              fontWeight: 700,
                              background:
                                inv.status === "PAID"
                                  ? "var(--accent-soft)"
                                  : inv.status === "PARTIALLY_PAID"
                                  ? "var(--amber-soft)"
                                  : "var(--danger-soft)",
                              color:
                                inv.status === "PAID"
                                  ? "var(--accent-primary)"
                                  : inv.status === "PARTIALLY_PAID"
                                  ? "var(--amber-primary)"
                                  : "var(--danger)",
                            }}
                          >
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ padding: "28px", textAlign: "center", color: "var(--text-secondary)" }}>
                        Koi invoice mojood nahi hai.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Confirmed Payments & Receipts */}
          <div className="glass-card" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)", margin: "0 0 16px" }}>
              
              Payments & receipts
            </h3>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                    <th style={{ padding: "10px 12px" }}>Receipt #</th>
                    <th style={{ padding: "10px 12px" }}>Amount Paid</th>
                    <th style={{ padding: "10px 12px" }}>Payment Method</th>
                    <th style={{ padding: "10px 12px" }}>Received Date</th>
                    <th style={{ padding: "10px 12px" }}>Account</th>
                    <th style={{ padding: "10px 12px" }}>Recorded By</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {member.payments && member.payments.length > 0 ? (
                    member.payments.map((p: any) => (
                      <tr key={p.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "12px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent-primary)" }}>
                          {p.receiptNumber}
                        </td>
                        <td style={{ padding: "12px", fontWeight: 700, color: "var(--accent-primary)" }}>
                          Rs. {p.amount.toLocaleString()}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                            {p.method} {p.referenceNumber ? `(${p.referenceNumber})` : ""}
                          </span>
                        </td>
                        <td style={{ padding: "12px", color: "var(--text-secondary)" }}>
                          {new Date(p.paymentDate).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "12px", color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                          {p.receivingAccount ? p.receivingAccount.displayName : "Cash Drawer"}
                        </td>
                        <td style={{ padding: "12px", color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                          {p.recordedBy?.name || "Staff"}
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <button
                            onClick={() => setViewReceiptId(p.id)}
                            style={{
                              background: "rgba(16, 185, 129, 0.12)",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                              color: "var(--accent-primary)",
                              borderRadius: "6px",
                              padding: "4px 10px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Printer size={13} />
                            Receipt
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ padding: "28px", textAlign: "center", color: "var(--text-secondary)" }}>
                        Is member ki koi confirmed payment record nahi hui.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: TRAINING & COACHING */}
      {activeTab === "training" && (
        <div className="glass-card" style={{ padding: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
              
              Trainer & fitness profile
            </h3>
            {(isOwner || currentUserRole === Role.RECEPTIONIST) && (
              <button
                onClick={() => setIsTrainerModalOpen(true)}
                className="btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px" }}
              >
                <Dumbbell size={16} />
                {member.trainer ? "Change Trainer" : "Assign Trainer"}
              </button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: "20px" }}>
            <div style={{ padding: "18px", borderRadius: "12px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
              <h4 style={{ fontSize: "0.9rem", color: "var(--text-secondary)", margin: "0 0 10px" }}>
                Assigned Personal Trainer
              </h4>
              {member.trainer ? (
                <div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)" }}>
                    {member.trainer.name}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                    Email: {member.trainer.email || "N/A"}
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>
                  Abhi koi trainer assigned nahi hai.
                </div>
              )}
            </div>

            <div style={{ padding: "18px", borderRadius: "12px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
              <h4 style={{ fontSize: "0.9rem", color: "var(--text-secondary)", margin: "0 0 10px" }}>
                Fitness Goal
              </h4>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent-primary)" }}>
                {member.fitnessGoal || "General Fitness"}
              </div>
            </div>
          </div>

          <div style={{ marginTop: "20px", padding: "18px", borderRadius: "12px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
            <h4 style={{ fontSize: "0.9rem", color: "var(--text-secondary)", margin: "0 0 10px" }}>
              
              Medical limitations (private)
            </h4>
            <p style={{ margin: 0, fontSize: "0.9rem", color: member.limitations ? "var(--amber-primary)" : "var(--text-secondary)" }}>
              {member.limitations || "Member ne koi medical limitation ya injury report nahi ki."}
            </p>
          </div>
        </div>
      )}

      {/* TAB 6: PROGRESS LOG */}
      {activeTab === "progress" && (
        <div className="glass-card" style={{ padding: "28px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: "0 0 6px" }}>
            
            Fitness progress
          </h3>
          

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "16px" }}>
            <div style={{ padding: "18px", borderRadius: "12px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Primary Target</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--accent-primary)", marginTop: "6px" }}>
                {member.fitnessGoal || "Fitness"}
              </div>
            </div>

            <div style={{ padding: "18px", borderRadius: "12px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Current Status</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--accent-primary)", marginTop: "6px" }}>
                Active Training
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: ATTENDANCE */}
      {activeTab === "attendance" && (
        <div className="glass-card" style={{ padding: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                Attendance & Check-in Log
              </h3>
              
            </div>
            <button
              onClick={handleMarkAttendance}
              disabled={markingAttendance}
              className="btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px" }}
            >
              <CalendarCheck size={16} />
              {markingAttendance ? "Recording..." : "Mark Check-in Now"}
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                  <th style={{ padding: "10px 14px" }}>Check-in Date</th>
                  <th style={{ padding: "10px 14px" }}>Time (PKT)</th>
                  <th style={{ padding: "10px 14px" }}>Method</th>
                  <th style={{ padding: "10px 14px" }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {member.attendance && member.attendance.length > 0 ? (
                  member.attendance.map((att: any) => (
                    <tr key={att.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "14px", color: "var(--text-main)", fontWeight: 600 }}>
                        {new Date(att.checkIn).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "14px", fontFamily: "var(--font-mono)", color: "var(--accent-primary)" }}>
                        {new Date(att.checkIn).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: "14px" }}>
                        <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "4px", background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                          {att.method}
                        </span>
                      </td>
                      <td style={{ padding: "14px", color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                        {att.notes || "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>
                      Abhi tak koi attendance record nahi hui. "Mark Check-in Now" par click karein.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: APP ACCESS */}
      {activeTab === "app-access" && (
        <div className="glass-card" style={{ padding: "28px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: "0 0 6px" }}>
            
            App access
          </h3>
          

          <div
            style={{
              padding: "20px",
              borderRadius: "12px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              marginBottom: "24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Current Access Status</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-main)", marginTop: "4px" }}>
                {member.appAccessStatus === "ACTIVE"
                  ? "Active App Access"
                  : member.appAccessStatus === "SUSPENDED"
                  ? "Suspended"
                  : "Not Activated"}
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              {member.appAccessStatus !== "ACTIVE" && (
                <button
                  onClick={handleGenerateActivation}
                  disabled={appAccessLoading}
                  className="btn-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px" }}
                >
                  <Sparkles size={16} />
                  {appAccessLoading ? "Generating..." : "Generate Activation Code"}
                </button>
              )}

              {member.user && (
                <button
                  onClick={handleToggleSuspend}
                  disabled={appAccessLoading}
                  className="btn-secondary"
                  style={{
                    padding: "8px 16px",
                    color: member.appAccessStatus === "SUSPENDED" ? "var(--accent-primary)" : "var(--danger)",
                    borderColor: member.appAccessStatus === "SUSPENDED" ? "var(--border-accent)" : "var(--danger-border)",
                  }}
                >
                  {member.appAccessStatus === "SUSPENDED" ? "Reactivate Access" : "Suspend Access"}
                </button>
              )}
            </div>
          </div>

          {/* Activation Code Banner when generated */}
          {activationInfo && (
            <div
              style={{
                padding: "20px",
                borderRadius: "12px",
                background: "var(--accent-soft)",
                border: "1px solid var(--border-accent)",
                marginBottom: "24px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "var(--accent-primary)", marginBottom: "8px" }}>
                <CheckCircle2 size={18} />
                
                Activation code
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0 0 14px" }}>
                Share this code with the member. They can set their password at <code>/activate</code>.
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                <div
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-accent)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "1.4rem",
                    fontWeight: 700,
                    letterSpacing: "4px",
                    color: "var(--accent-primary)",
                  }}
                >
                  {activationInfo.activationCode}
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activationInfo.activationCode);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="btn-secondary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 12px", fontSize: "0.825rem" }}
                >
                  {copiedCode ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  {copiedCode ? "Copied!" : "Copy Code"}
                </button>

                <button
                  onClick={() => {
                    const fullUrl = `${window.location.origin}${activationInfo.activationUrl}`;
                    navigator.clipboard.writeText(fullUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="btn-secondary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 12px", fontSize: "0.825rem" }}
                >
                  {copiedLink ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  {copiedLink ? "Link Copied!" : "Copy Activation Link"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 9: HISTORY (AUDIT LOG) */}
      {activeTab === "history" && (
        <div className="glass-card" style={{ padding: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <Shield size={18} color="var(--accent-primary)" />
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
              Recent activity Trail
            </h3>
          </div>
          

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {auditLogs && auditLogs.length > 0 ? (
              auditLogs.map((log: any) => {
                let parsedDetails = null;
                try {
                  if (log.details) parsedDetails = JSON.parse(log.details);
                } catch {
                  parsedDetails = log.details;
                }

                return (
                  <div
                    key={log.id}
                    style={{
                      padding: "14px 18px",
                      borderRadius: "10px",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontWeight: 700, color: "var(--text-main)" }}>
                        {log.action}
                      </span>
                      <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginBottom: "6px" }}>
                      Actor: <strong style={{ color: "var(--text-main)" }}>{log.actorName || "System"}</strong> (
                      <span style={{ color: "var(--accent-primary)" }}>{log.actorRole || "N/A"}</span>)
                    </div>

                    {parsedDetails && (
                      <div
                        style={{
                          fontSize: "0.775rem",
                          fontFamily: "var(--font-mono)",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          background: "var(--bg-secondary)",
                          color: "var(--text-secondary)",
                          overflowX: "auto",
                        }}
                      >
                        {JSON.stringify(parsedDetails, null, 2)}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p style={{ color: "var(--text-secondary)", fontStyle: "italic", textAlign: "center", padding: "20px" }}>
                Is member ka audit log abhi khali hai.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <EditDetailsModal
        isOpen={isEditModalOpen}
        member={member}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => refreshMember()}
      />

      <AssignMembershipModal
        isOpen={isMembershipModalOpen}
        member={member}
        mode={membershipModalMode}
        activeMembershipId={currentPlan?.id}
        onClose={() => setIsMembershipModalOpen(false)}
        onSuccess={() => refreshMember()}
      />

      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        member={member}
        invoices={member.invoices || []}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={() => refreshMember()}
      />

      <AssignTrainerModal
        isOpen={isTrainerModalOpen}
        member={member}
        onClose={() => setIsTrainerModalOpen(false)}
        onSuccess={() => refreshMember()}
      />

      <ArchiveMemberModal
        isOpen={isArchiveModalOpen}
        member={member}
        onClose={() => setIsArchiveModalOpen(false)}
        onSuccess={() => refreshMember()}
      />

      <ReceiptModal
        receiptId={viewReceiptId}
        isOpen={!!viewReceiptId}
        onClose={() => setViewReceiptId(null)}
        currentUserRole={currentUserRole}
        onReceiptUpdated={() => refreshMember()}
      />

      {/* Member Password Reset Code Modal */}
      {resetCodeModal && (
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
              maxWidth: "460px",
              padding: "28px",
              background: "var(--bg-surface)",
              position: "relative",
            }}
          >
            <button
              onClick={() => {
                setResetCodeModal(null);
                setCopiedResetCode(false);
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
              Member Password Reset Code
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: "20px" }}>
              Share this single-use 6-digit verification code with <strong>{resetCodeModal.memberName}</strong>.
            </p>
            <div
              style={{
                background: "var(--bg-secondary)",
                borderRadius: "10px",
                padding: "20px",
                textAlign: "center",
                border: "1px dashed var(--border-accent)",
                marginBottom: "16px",
              }}
            >
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "6px" }}>
                Temporary 6-Digit Code
              </span>
              <div
                style={{
                  fontSize: "2.2rem",
                  fontWeight: 800,
                  letterSpacing: "8px",
                  color: "var(--accent-primary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {resetCodeModal.code}
              </div>
              <span style={{ fontSize: "0.76rem", color: "var(--text-muted)", display: "block", marginTop: "8px" }}>
                Valid for 15 minutes (Expires at {resetCodeModal.expiresAt})
              </span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "20px" }}>
              Member can enter their Phone / Member ID and this 6-digit code on the <strong>Forgot Password</strong> screen to immediately set a new password.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(resetCodeModal.code);
                  setCopiedResetCode(true);
                  setTimeout(() => setCopiedResetCode(false), 2000);
                }}
                className="btn-secondary"
                style={{ flex: 1, padding: "10px" }}
              >
                {copiedResetCode ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
                <span>{copiedResetCode ? "Copied" : "Copy Code"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetCodeModal(null);
                  setCopiedResetCode(false);
                }}
                className="btn-primary"
                style={{ flex: 1, padding: "10px" }}
              >
                Done
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
