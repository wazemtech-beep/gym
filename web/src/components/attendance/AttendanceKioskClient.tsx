"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect, useCallback } from "react";
import {
  CalendarCheck,
  Search,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Power,
  RefreshCw,
  Trash2,
  Users,
  AlertCircle,
  Dumbbell,
  ArrowRight,
  UserX
} from "lucide-react";
import { formatDateTime } from "@/lib/formatters";

interface AttendanceKioskClientProps {
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
}

export default function AttendanceKioskClient({ currentUser }: AttendanceKioskClientProps) {
  const readCacheVersion = useReadCacheVersion();
  const [attendanceEnabled, setAttendanceEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  // Kiosk Search & Check-in State
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);

  // Checking in state
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [duesWarning, setDuesWarning] = useState<string | null>(null);

  // Override State
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  // Repeat Visit Prompt State
  const [repeatVisitPrompt, setRepeatVisitPrompt] = useState<{
    memberId: string;
    message: string;
  } | null>(null);

  // Today's Stream List
  const [todayRecords, setTodayRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalVisits: 0,
    uniqueMembers: 0,
    overridesCount: 0,
    voidedCount: 0,
  });

  // Void State
  const [voidRecord, setVoidRecord] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  // Load Settings and Records
  const fetchAttendanceData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, recordsRes] = await Promise.all([
        apiFetch("/api/v1/attendance/settings"),
        apiFetch("/api/v1/attendance?dateRange=today&status=ALL"),
      ]);

      const settingsData = await settingsRes.json();
      if (settingsData.success) {
        setAttendanceEnabled(settingsData.attendanceEnabled);
      }

      const recordsData = await recordsRes.json();
      if (recordsData.success) {
        setTodayRecords(recordsData.records || []);
        if (recordsData.summary) setSummary(recordsData.summary);
      }
    } catch (err) {
      console.error("Failed to load attendance:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendanceData();
  }, [fetchAttendanceData, readCacheVersion]);

  // Handle Feature Toggle (Owner only)
  const handleToggleFeature = async () => {
    if (currentUser.role !== "OWNER") {
      alert("Attendance setting sirf Owner change kar sakta hai.");
      return;
    }

    setToggling(true);
    try {
      const res = await apiFetch("/api/v1/attendance/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !attendanceEnabled }),
      });
      const data = await res.json();
      if (data.success) {
        setAttendanceEnabled(data.attendanceEnabled);
      } else {
        alert(data.error || "Setting update fail ho gayi.");
      }
    } catch {
      alert("Network error while toggling attendance.");
    } finally {
      setToggling(false);
    }
  };

  // Search Member for Check-in
  const handleSearch = async (term: string) => {
    setSearchQuery(term);
    setCheckInSuccess(null);
    setCheckInError(null);
    setDuesWarning(null);

    if (!term || term.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await apiFetch(`/api/v1/members?search=${encodeURIComponent(term.trim())}&limit=5`);
      const data = await res.json();
      if (data.success && data.members) {
        setSearchResults(data.members);
      }
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  };

  const handleSelectMember = (mem: any) => {
    setSelectedMember(mem);
    setSearchResults([]);
    setSearchQuery(mem.fullName);
  };

  // Execute Check-in
  const handleCheckIn = async (
    isOverride: boolean = false,
    confirmAnotherVisit: boolean = false
  ) => {
    if (!selectedMember) return;
    setCheckingIn(true);
    setCheckInSuccess(null);
    setCheckInError(null);
    setDuesWarning(null);

    try {
      const res = await apiFetch("/api/v1/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: selectedMember.id,
          isOverride,
          overrideReason: isOverride ? overrideReason.trim() : null,
          confirmAnotherVisit,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setCheckInSuccess(data.message);
        if (data.duesWarning) setDuesWarning(data.duesWarning);
        setShowOverrideModal(false);
        setOverrideReason("");
        setRepeatVisitPrompt(null);
        setSelectedMember(null);
        setSearchQuery("");
        fetchAttendanceData();
      } else if (data.needsConfirmation) {
        setRepeatVisitPrompt({
          memberId: selectedMember.id,
          message: data.message,
        });
      } else if (data.blocked) {
        setCheckInError(data.error);
      } else {
        setCheckInError(data.error || "Check-in fail ho gaya.");
      }
    } catch {
      setCheckInError("Check-in request bhejne mein network masla aaya.");
    } finally {
      setCheckingIn(false);
    }
  };

  // Void Check-in
  const handleVoidCheckIn = async () => {
    if (!voidRecord || !voidReason.trim()) return;
    setVoiding(true);
    try {
      const res = await apiFetch(`/api/v1/attendance/${voidRecord.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setVoidRecord(null);
        setVoidReason("");
        fetchAttendanceData();
      } else {
        alert(data.error || "Void fail ho gaya.");
      }
    } catch {
      alert("Void request fail ho gayi.");
    } finally {
      setVoiding(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              background: attendanceEnabled ? "rgba(16, 185, 129, 0.12)" : "rgba(148, 163, 184, 0.12)",
              color: attendanceEnabled ? "var(--accent-primary)" : "var(--text-dim)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CalendarCheck size={22} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                
                Attendance
              </h1>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: "6px",
                  background: attendanceEnabled ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: attendanceEnabled ? "#10b981" : "#ef4444",
                  border: attendanceEnabled ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                }}
              >
                {attendanceEnabled ? "ACTIVE (ENABLED)" : "DISABLED (OPTIONAL)"}
              </span>
            </div>
            
          </div>
        </div>

        {/* Feature Enable/Disable Button (Owner only) */}
        {currentUser.role === "OWNER" && (
          <button
            onClick={handleToggleFeature}
            disabled={toggling}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "8px",
              background: attendanceEnabled ? "rgba(239, 68, 68, 0.12)" : "var(--accent-primary)",
              color: attendanceEnabled ? "#ef4444" : "#000",
              border: attendanceEnabled ? "1px solid rgba(239, 68, 68, 0.3)" : "none",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Power size={15} />
            {toggling ? "Saving..." : attendanceEnabled ? "Disable Attendance Feature" : "Enable Attendance Feature"}
          </button>
        )}
      </div>

      {/* Feature Disabled Notice Banner */}
      {!attendanceEnabled && (
        <div
          style={{
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.25)",
            borderRadius: "14px",
            padding: "20px 24px",
            display: "flex",
            alignItems: "flex-start",
            gap: "16px",
          }}
        >
          <AlertTriangle size={24} color="#f59e0b" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 4px", color: "#f59e0b" }}>
              
              Attendance is disabled
            </h3>
            <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
              
              Check-ins are paused. Existing history is saved.
            </p>
          </div>
        </div>
      )}

      {/* Summary Metrics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))", gap: "16px" }}>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "18px 20px" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Total Visits Today</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--accent-primary)", marginTop: "4px" }}>
            {summary.totalVisits}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>Valid checked-in sessions</div>
        </div>

        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "18px 20px" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Unique Members</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#fff", marginTop: "4px" }}>
            {summary.uniqueMembers}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>Distinct individuals today</div>
        </div>

        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "18px 20px" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Overrides Allowed</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#f59e0b", marginTop: "4px" }}>
            {summary.overridesCount}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>Exceptions with saved reason</div>
        </div>

        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "18px 20px" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Voided Check-ins</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--text-dim)", marginTop: "4px" }}>
            {summary.voidedCount}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>Cancelled mistaken entries</div>
        </div>
      </div>

      {/* Reception Rapid Check-in Kiosk Card (When enabled) */}
      {attendanceEnabled && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <UserCheck size={20} color="var(--accent-primary)" />
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>
              
              Member check-in
            </h2>
          </div>

          {/* Search Input */}
          <div style={{ position: "relative", marginBottom: "16px" }}>
            <Search
              size={18}
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-dim)",
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search name, phone or member ID"
              style={{
                width: "100%",
                padding: "12px 14px 12px 42px",
                borderRadius: "10px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                color: "#fff",
                fontSize: "0.95rem",
                outline: "none",
              }}
            />

            {/* Instant Search Dropdown */}
            {searchResults.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  marginTop: "6px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "10px",
                  boxShadow: "0 15px 30px rgba(0,0,0,0.6)",
                  zIndex: 100,
                  overflow: "hidden",
                }}
              >
                {searchResults.map((mem) => (
                  <div
                    key={mem.id}
                    onClick={() => handleSelectMember(mem)}
                    style={{
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderBottom: "1px solid var(--border-subtle)",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-secondary)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.9rem" }}>{mem.fullName}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                        {mem.memberId} • {mem.phone}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: mem.memberships?.[0]?.status === "ACTIVE" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: mem.memberships?.[0]?.status === "ACTIVE" ? "#10b981" : "#ef4444",
                        }}
                      >
                        {mem.memberships?.[0]?.planName || "No Active Plan"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Member Card & Eligibility Verification */}
          {selectedMember && (
            <div
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "var(--accent-primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "1.2rem",
                    }}
                  >
                    {selectedMember.fullName.charAt(0)}
                  </div>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "#fff" }}>
                      {selectedMember.fullName}
                    </h3>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginTop: "2px" }}>
                      Member ID: <strong>{selectedMember.memberId}</strong> • Phone: {selectedMember.phone}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: "6px",
                      background: selectedMember.memberships?.[0]?.status === "ACTIVE" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: selectedMember.memberships?.[0]?.status === "ACTIVE" ? "#10b981" : "#ef4444",
                    }}
                  >
                    {selectedMember.memberships?.[0]?.status || "NO PLAN"}
                  </span>
                </div>
              </div>

              {/* Dues Warning if any */}
              {selectedMember.invoices?.some((i: any) => i.balanceAmount > 0) && (
                <div
                  style={{
                    background: "rgba(245, 158, 11, 0.12)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    color: "#f59e0b",
                    fontSize: "0.82rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <AlertTriangle size={16} />
                  <span>
                    
                    Unpaid dues. Check-in is allowed; remind the member to pay.
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setSelectedMember(null)}
                  className="btn btn-secondary"
                  style={{ fontSize: "0.82rem" }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => handleCheckIn(false, false)}
                  disabled={checkingIn}
                  className="btn btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", fontWeight: 700 }}
                >
                  <UserCheck size={16} />
                  {checkingIn ? "Checking In..." : "Confirm Check In"}
                </button>

                {/* Owner Override trigger */}
                {currentUser.role === "OWNER" && (
                  <button
                    type="button"
                    onClick={() => setShowOverrideModal(true)}
                    style={{
                      background: "rgba(245, 158, 11, 0.12)",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      color: "#f59e0b",
                      borderRadius: "8px",
                      padding: "6px 12px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Owner Override Check-in
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Feedback Alerts */}
          {checkInSuccess && (
            <div
              style={{
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: "8px",
                padding: "12px 16px",
                color: "#10b981",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <CheckCircle2 size={18} />
              <span>{checkInSuccess}</span>
            </div>
          )}

          {checkInError && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "8px",
                padding: "12px 16px",
                color: "#ef4444",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <AlertCircle size={18} />
              <span>{checkInError}</span>
            </div>
          )}

          {/* Repeat Visit Prompt */}
          {repeatVisitPrompt && (
            <div
              style={{
                background: "rgba(99, 102, 241, 0.12)",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                borderRadius: "10px",
                padding: "16px",
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#818cf8" }}>
                <Clock size={18} />
                <span>Already checked in today</span>
              </div>
              <p style={{ fontSize: "0.85rem", margin: 0, color: "var(--text-muted)" }}>
                {repeatVisitPrompt.message}
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setRepeatVisitPrompt(null)}
                  className="btn btn-secondary"
                  style={{ fontSize: "0.8rem" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleCheckIn(false, true)}
                  className="btn btn-primary"
                  style={{ fontSize: "0.8rem", fontWeight: 700 }}
                >
                  Yes, Record Another Visit
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Today's Live Attendance Stream Table */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Today's check-ins</div>
          <button
            onClick={() => fetchAttendanceData()}
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "4px 10px", display: "flex", alignItems: "center", gap: "4px" }}
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
                <th style={{ padding: "12px 16px" }}>Time (PKT)</th>
                <th style={{ padding: "12px 16px" }}>Member Details</th>
                <th style={{ padding: "12px 16px" }}>Membership Plan</th>
                <th style={{ padding: "12px 16px" }}>Recorded By</th>
                <th style={{ padding: "12px 16px" }}>Status / Type</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {todayRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>
                    Aaj koi check-in record nahi hua.
                  </td>
                </tr>
              ) : (
                todayRecords.map((r) => {
                  const isVoid = r.isVoid;

                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        opacity: isVoid ? 0.5 : 1,
                      }}
                    >
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: isVoid ? "#94a3b8" : "var(--accent-primary)" }}>
                        {formatDateTime(r.checkIn)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 700, color: "#fff" }}>{r.gymMember?.fullName}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                          {r.gymMember?.memberId} • {r.gymMember?.phone}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {r.membership?.planName || "General Visit"}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-dim)" }}>
                        {r.recordedBy?.name || "Reception Staff"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {isVoid ? (
                          <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "4px", background: "rgba(239,68,68,0.15)", color: "#ef4444", fontWeight: 700 }}>
                            VOIDED ({r.voidReason})
                          </span>
                        ) : r.overrideReason ? (
                          <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "4px", background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontWeight: 700 }} title={r.overrideReason}>
                            OVERRIDE
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "4px", background: "rgba(16,185,129,0.15)", color: "#10b981", fontWeight: 700 }}>
                            VALID
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        {!isVoid && (
                          <button
                            onClick={() => setVoidRecord(r)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--text-dim)",
                              cursor: "pointer",
                              padding: "4px",
                            }}
                            title="Void mistaken check-in entry"
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Owner Override Reason Modal */}
      {showOverrideModal && (
        <ModalOverlay
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(8px)",
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
              maxWidth: "460px",
              background: "var(--bg-surface)",
              borderRadius: "14px",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <ShieldAlert size={22} color="#f59e0b" />
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "#f59e0b" }}>
                  
                  Allow exceptional visit
                </h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", margin: 0 }}>
                  Member: {selectedMember?.fullName} ({selectedMember?.memberId})
                </p>
              </div>
            </div>

            <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "16px" }}>
              
              Allow entry despite an expired or pending plan. A reason is required.
            </p>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px" }}>
                Override Reason (Lazmi)*
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Guest trial, promise to pay tomorrow, special training session..."
                rows={2}
                style={{
                  width: "100%",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "10px",
                  color: "#fff",
                  fontSize: "0.85rem",
                  outline: "none",
                  resize: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="btn btn-secondary"
                disabled={checkingIn}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCheckIn(true, false)}
                disabled={checkingIn || !overrideReason.trim()}
                style={{
                  background: "#f59e0b",
                  color: "#000",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 18px",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {checkingIn ? "Overriding..." : "Confirm Override Check-in"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Void Check-in Modal */}
      {voidRecord && (
        <ModalOverlay
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(8px)",
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
              maxWidth: "460px",
              background: "var(--bg-surface)",
              borderRadius: "14px",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <Trash2 size={22} color="#ef4444" />
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "#ef4444" }}>
                  Void Check-in Entry?
                </h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", margin: 0 }}>
                  Member: {voidRecord.gymMember?.fullName} ({formatDateTime(voidRecord.checkIn)})
                </p>
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px" }}>
                Void Reason (Waja)*
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Selected wrong member, accidental click..."
                rows={2}
                style={{
                  width: "100%",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "10px",
                  color: "#fff",
                  fontSize: "0.85rem",
                  outline: "none",
                  resize: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setVoidRecord(null)}
                className="btn btn-secondary"
                disabled={voiding}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVoidCheckIn}
                disabled={voiding || !voidReason.trim()}
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 18px",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {voiding ? "Voiding..." : "Confirm Void"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
