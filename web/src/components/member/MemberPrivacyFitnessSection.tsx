"use client";
import MemberLoadingLayout from "./MemberLoadingLayout";
import layoutStyles from "./MemberPages.module.css";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Smartphone,
  Lock,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  PowerOff,
  Trash2,
  Calendar,
  Footprints,
  Compass,
  Flame,
  Dumbbell,
  RefreshCw,
  Clock,
  ArrowRight,
  Info,
} from "lucide-react";

export default function MemberPrivacyFitnessSection() {
  const readCacheVersion = useReadCacheVersion();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [saving, setSaving] = useState(false);

  // Sharing form state
  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [sharedCategories, setSharedCategories] = useState<string[]>([]);
  const [historyRangeType, setHistoryRangeType] = useState("ALL");

  // Deletion modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteScope, setDeleteScope] = useState<"ALL" | "DATE_RANGE" | "CATEGORY">("ALL");
  const [deleteCategory, setDeleteCategory] = useState("STEPS");
  const [deleteStartDate, setDeleteStartDate] = useState("");
  const [deleteEndDate, setDeleteEndDate] = useState("");

  const fetchPrivacyData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/v1/member/fitness/privacy");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        const conn = json.data.connection;
        setSharingEnabled(conn?.trainerSharingEnabled ?? false);
        setSharedCategories(conn?.trainerSharingCategories || ["STEPS", "EXERCISE_SESSIONS"]);
        setHistoryRangeType(conn?.historyRangeType || "ALL");
      } else {
        setError(json.error || "Failed to load privacy settings.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load privacy settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrivacyData();
  }, [readCacheVersion]);

  const handleSaveSharing = async (enabledOverride?: boolean) => {
    setSaving(true);
    setMessage(null);
    const targetEnabled = enabledOverride !== undefined ? enabledOverride : sharingEnabled;
    try {
      const res = await apiFetch("/api/v1/member/fitness/sharing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: targetEnabled,
          categories: sharedCategories,
          historyRangeType,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setMessage({ text: json.message, type: "success" });
      setSharingEnabled(targetEnabled);
      fetchPrivacyData();
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/v1/member/fitness/disconnect", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setMessage({ text: json.message, type: "success" });
      fetchPrivacyData();
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleExecuteDelete = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/v1/member/fitness/delete-scoped", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: deleteScope,
          targetCategory: deleteScope === "CATEGORY" ? deleteCategory : undefined,
          startDate: deleteScope === "DATE_RANGE" ? deleteStartDate : undefined,
          endDate: deleteScope === "DATE_RANGE" ? deleteEndDate : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setShowDeleteModal(false);
      setMessage({ text: json.message, type: "success" });
      fetchPrivacyData();
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setSharedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  if (loading && !data) return <MemberLoadingLayout variant="privacy" />;

  const conn = data?.connection;
  const assignedTrainer = data?.assignedTrainer;
  const pendingRequests = data?.pendingRequests || [];

  return (
    <div>
      {/* Page Title */}
      <div style={{ marginBottom: "20px" }}>
        <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
          <Shield size={22} className="text-orange-500" />
          Privacy & Fitness Data Controls
        </h3>
        <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--text-dim)" }}>
          Phone permissions, cloud storage consent aur assigned trainer sharing controls independent hain
        </p>
      </div>

      {message && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            marginBottom: "20px",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: message.type === "success" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
            color: message.type === "success" ? "var(--accent-primary)" : "var(--danger)",
            border: `1px solid ${message.type === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
          }}
        >
          {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {message.text}
        </div>
      )}

      {/* PENDING TRAINER ACCESS REQUEST BANNER */}
      {pendingRequests.length > 0 && (
        <div
          style={{
            padding: "16px 20px",
            backgroundColor: "rgba(249, 115, 22, 0.1)",
            border: "1px solid rgba(249, 115, 22, 0.3)",
            borderRadius: "12px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--amber-primary)" }}>
              Coach Access Request Pending
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-main)" }}>
              Coach {assignedTrainer ? assignedTrainer.name : "Assigned Trainer"} ne aapka activity data dekhne ki request bheji hai taake workout aur diet plan optimize kar sakein.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="btn btn-primary"
              onClick={() => handleSaveSharing(true)}
              disabled={saving}
              style={{ fontSize: "0.8rem", padding: "6px 14px" }}
            >
              Approve Sharing
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handleSaveSharing(false)}
              disabled={saving}
              style={{ fontSize: "0.8rem", padding: "6px 14px" }}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* 3 INDEPENDENT CONTROLS OVERVIEW (Point 1) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {/* Control 1: Phone Read */}
        <div
          style={{
            backgroundColor: "var(--bg-surface)",
            borderRadius: "12px",
            padding: "18px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <Smartphone size={18} className="text-orange-400" />
            <h4 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>1. Phone Read</h4>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "10px" }}>
            OXGEN app phone ke Health Connect se kya read kar sakti hai
          </div>
          <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            Status: <span style={{ color: conn?.status === "CONNECTED" ? "var(--accent-primary)" : "var(--amber-primary)" }}>{conn?.status || "DISCONNECTED"}</span>
          </div>
          <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Allowed: {conn?.reportedPermissions?.length ? conn.reportedPermissions.join(", ") : "None"}
          </div>
        </div>

        {/* Control 2: Cloud Storage */}
        <div
          style={{
            backgroundColor: "var(--bg-surface)",
            borderRadius: "12px",
            padding: "18px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <Shield size={18} className="text-blue-400" />
            <h4 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>2. Cloud Storage</h4>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "10px" }}>
            Kya summaries OXGEN backend database mein save ho sakti hain
          </div>
          <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            Consent:{" "}
            <span style={{ color: conn?.backendUploadConsent ? "var(--accent-primary)" : "var(--danger)" }}>
              {conn?.backendUploadConsent ? "Active (Granted)" : "Revoked (Off)"}
            </span>
          </div>
          <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Version: {conn?.backendUploadConsentVersion || "v1.0"}
          </div>
        </div>

        {/* Control 3: Trainer Sharing */}
        <div
          style={{
            backgroundColor: "var(--bg-surface)",
            borderRadius: "12px",
            padding: "18px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <UserCheck size={18} className="text-emerald-400" />
            <h4 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>3. Trainer Sharing</h4>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "10px" }}>
            Saved data kaunsa trainer dekh sakta hai aur kis date range tak
          </div>
          <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            Sharing:{" "}
            <span style={{ color: conn?.trainerSharingEnabled ? "var(--accent-primary)" : "var(--danger)" }}>
              {conn?.trainerSharingEnabled ? `Active (${assignedTrainer?.name || "Coach"})` : "Off (Restricted)"}
            </span>
          </div>
          <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Range: {conn?.historyRangeType || "ALL"}
          </div>
        </div>
      </div>

      {/* DETAILED TRAINER SHARING CONFIGURATION (Point 2 & 3) */}
      <div
        style={{
          backgroundColor: "var(--bg-surface)",
          borderRadius: "14px",
          padding: "24px",
          border: "1px solid var(--border-subtle)",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
              Trainer Sharing & Date Boundary Setup
            </h4>
            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Assigned trainer: <strong>{assignedTrainer ? assignedTrainer.name : "Koi Trainer Assigned Nahi"}</strong>
            </p>
          </div>
          {conn?.trainerSharingEnabled && (
            <button
              onClick={() => handleSaveSharing(false)}
              disabled={saving}
              className="btn btn-secondary"
              style={{ fontSize: "0.78rem", padding: "6px 12px", borderColor: "#ef4444", color: "#ef4444" }}
            >
              Stop Sharing
            </button>
          )}
        </div>

        {assignedTrainer ? (
          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                borderRadius: "10px",
                backgroundColor: sharingEnabled ? "rgba(249, 115, 22, 0.08)" : "var(--bg-secondary)",
                border: `1px solid ${sharingEnabled ? "rgba(249, 115, 22, 0.3)" : "var(--border-medium)"}`,
                cursor: "pointer",
                marginBottom: "16px",
              }}
            >
              <input
                type="checkbox"
                checked={sharingEnabled}
                onChange={(e) => setSharingEnabled(e.target.checked)}
                style={{ accentColor: "#f97316", width: "18px", height: "18px" }}
              />
              <div>
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  Coach {assignedTrainer.name} ke sath fitness data share karein
                </span>
                <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  Trainer sirf aapki select ki hui categories dekh sakega.
                </p>
              </div>
            </label>

            {sharingEnabled && (
              <div style={{ display: "grid", gap: "16px", marginBottom: "20px" }}>
                {/* Category Selection */}
                <div>
                  <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "8px" }}>
                    Categories to Share:
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: "8px" }}>
                    {[
                      { id: "STEPS", name: "Daily Steps", icon: Footprints },
                      { id: "DISTANCE", name: "Distance (km)", icon: Compass },
                      { id: "EXERCISE_SESSIONS", name: "Exercise Sessions", icon: Dumbbell },
                      { id: "ACTIVE_CALORIES", name: "Active Calories", icon: Flame },
                    ].map((c) => {
                      const isChecked = sharedCategories.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px 12px",
                            borderRadius: "8px",
                            backgroundColor: isChecked ? "rgba(249, 115, 22, 0.08)" : "var(--bg-secondary)",
                            border: `1px solid ${isChecked ? "rgba(249, 115, 22, 0.3)" : "var(--border-medium)"}`,
                            cursor: "pointer",
                            fontSize: "0.82rem",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCategory(c.id)}
                            style={{ accentColor: "#f97316" }}
                          />
                          <span>{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* History Range Selection (Point 2 & 3) */}
                <div>
                  <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "8px" }}>
                    Shared History Range Boundary:
                  </label>
                  <select
                    value={historyRangeType}
                    onChange={(e) => setHistoryRangeType(e.target.value)}
                    style={{
                      width: "100%",
                      maxWidth: "340px",
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-medium)",
                      borderRadius: "8px",
                      color: "var(--text-main)",
                      padding: "8px 12px",
                      fontSize: "0.82rem",
                    }}
                  >
                    <option value="ALL">All Past & Future History</option>
                    <option value="LAST_30_DAYS">Last 30 Days + Future</option>
                    <option value="LAST_90_DAYS">Last 90 Days + Future</option>
                    <option value="CONSENT_ONWARD">Consent Date Onward Only (Future Only)</option>
                  </select>
                  <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    Trainer is boundary se purana data nahi dekh sakega.
                  </p>
                </div>
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={() => handleSaveSharing()}
              disabled={saving}
              style={{ padding: "8px 20px", fontSize: "0.85rem" }}
            >
              {saving ? "Saving..." : "Save Trainer Sharing Preferences"}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", padding: "12px", background: "var(--bg-secondary)", borderRadius: "8px" }}>
            Gym staff ne abhi aapko koi personal trainer assign nahi kiya. Assignment hone par yahan sharing enable ki ja sakegi.
          </div>
        )}
      </div>

      {/* DISCONNECT & SCOPED DELETION ACTIONS (Point 5 & 6) */}
      <div
        style={{
          backgroundColor: "var(--bg-surface)",
          borderRadius: "14px",
          padding: "24px",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 16px", color: "var(--danger)" }}>
          Disconnect & Scoped Deletion Controls
        </h4>

        <div style={{ display: "grid", gap: "16px" }}>
          {/* Action A: Disconnect */}
          <div
            style={{
              padding: "16px",
              backgroundColor: "var(--bg-secondary)",
              borderRadius: "10px",
              border: "1px solid var(--border-medium)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Disconnect Fitness Data</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Future sync aur cloud upload disable ho jayenge; trainer sharing default revoke hogi. Existing saved history web par retained rahegi.
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={saving || conn?.status === "DISCONNECTED"}
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", padding: "6px 14px", whiteSpace: "nowrap" }}
            >
              <PowerOff size={14} /> Disconnect
            </button>
          </div>

          {/* Action B: Scoped Deletion */}
          <div
            style={{
              padding: "16px",
              backgroundColor: "rgba(239, 68, 68, 0.06)",
              borderRadius: "10px",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--danger)" }}>
                Delete Synced Fitness History (Scoped)
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                OXGEN cloud se imported activity records remove karein (Specific Date Range, Specific Category, ya All). Gym fees, attendance aur gym workout logs bilkul mehfooz rahenge.
              </div>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={saving}
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", padding: "6px 14px", borderColor: "#ef4444", color: "#ef4444", whiteSpace: "nowrap" }}
            >
              <Trash2 size={14} /> Delete Synced Data
            </button>
          </div>
        </div>
      </div>

      {/* SCOPED DELETION MODAL */}
      {showDeleteModal && (
        <ModalOverlay
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "16px",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--bg-surface)",
              borderRadius: "16px",
              border: "1px solid #ef4444",
              maxWidth: "520px",
              width: "100%",
              padding: "24px",
              color: "var(--text-main)",
            }}
          >
            <h4 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 10px", color: "var(--danger)" }}>
              Choose Deletion Scope
            </h4>
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: "0 0 16px" }}>
              Aap chun sakte hain ke kaunsa synced data OXGEN database se delete karna hai. Source-app aur Health Connect ka data unchanged rahega.
            </p>

            <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
              {[
                { id: "ALL", label: "All Synced Fitness History (Saari imported activity remove)" },
                { id: "DATE_RANGE", label: "Selected Date Range (Khas tareekhon ka data remove)" },
                { id: "CATEGORY", label: "Selected Category (e.g. Sirf steps ya active calories)" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    backgroundColor: deleteScope === opt.id ? "rgba(239, 68, 68, 0.1)" : "var(--bg-secondary)",
                    border: `1px solid ${deleteScope === opt.id ? "#ef4444" : "var(--border-medium)"}`,
                    cursor: "pointer",
                    fontSize: "0.84rem",
                  }}
                >
                  <input
                    type="radio"
                    name="deleteScope"
                    checked={deleteScope === opt.id}
                    onChange={() => setDeleteScope(opt.id as any)}
                    style={{ accentColor: "#ef4444" }}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>

            {/* Date Range Fields */}
            {deleteScope === "DATE_RANGE" && (
              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "2px" }}>Start Date</label>
                  <input
                    type="date"
                    value={deleteStartDate}
                    onChange={(e) => setDeleteStartDate(e.target.value)}
                    style={{ width: "100%", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", color: "#fff", padding: "6px 10px", borderRadius: "6px", fontSize: "0.8rem" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "2px" }}>End Date</label>
                  <input
                    type="date"
                    value={deleteEndDate}
                    onChange={(e) => setDeleteEndDate(e.target.value)}
                    style={{ width: "100%", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", color: "#fff", padding: "6px 10px", borderRadius: "6px", fontSize: "0.8rem" }}
                  />
                </div>
              </div>
            )}

            {/* Category Field */}
            {deleteScope === "CATEGORY" && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Target Category</label>
                <select
                  value={deleteCategory}
                  onChange={(e) => setDeleteCategory(e.target.value)}
                  style={{ width: "100%", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", color: "#fff", padding: "8px 12px", borderRadius: "8px", fontSize: "0.82rem" }}
                >
                  <option value="STEPS">Steps History Only</option>
                  <option value="DISTANCE">Distance History Only</option>
                  <option value="ACTIVE_CALORIES">Active Calories Only</option>
                  <option value="EXERCISE_SESSIONS">Synced Exercise Sessions Only</option>
                </select>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={saving}
                style={{ padding: "8px 16px", fontSize: "0.82rem" }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleExecuteDelete}
                disabled={saving}
                style={{ backgroundColor: "#ef4444", borderColor: "#ef4444", padding: "8px 16px", fontSize: "0.82rem" }}
              >
                {saving ? "Deleting..." : "Confirm & Delete"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
