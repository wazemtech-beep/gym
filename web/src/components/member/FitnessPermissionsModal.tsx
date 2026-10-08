"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch } from "@/lib/apiFetch";

import React, { useState } from "react";
import {
  X,
  Shield,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Lock,
  UserCheck,
  Trash2,
  PowerOff,
  Flame,
  Footprints,
  Compass,
  Dumbbell,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

interface FitnessPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: any;
  assignedTrainer: { id: string; name: string } | null;
  onRefresh: () => void;
}

export default function FitnessPermissionsModal({
  isOpen,
  onClose,
  connection,
  assignedTrainer,
  onRefresh,
}: FitnessPermissionsModalProps) {
  const [activeTab, setActiveTab] = useState<"permissions" | "consent" | "trainer" | "danger">("permissions");

  // Local state for categories
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    connection?.reportedPermissions || ["STEPS", "DISTANCE", "EXERCISE_SESSIONS", "ACTIVE_CALORIES"]
  );
  const [uploadConsent, setUploadConsent] = useState<boolean>(connection?.backendUploadConsent ?? false);
  const [trainerSharingEnabled, setTrainerSharingEnabled] = useState<boolean>(connection?.trainerSharingEnabled ?? false);
  const [trainerCategories, setTrainerCategories] = useState<string[]>(
    connection?.trainerSharingCategories || ["STEPS", "EXERCISE_SESSIONS"]
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOpen) return null;

  const toggleCategory = (cat: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleTrainerCategory = (cat: string) => {
    setTrainerCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSavePermissions = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/v1/member/fitness/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportedPermissions: selectedPermissions,
          platform: "HEALTH_CONNECT",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Permissions update fail ho gayin.");
      setMessage({ text: "Permissions status kamyabi se save ho gaya.", type: "success" });
      onRefresh();
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConsent = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/v1/member/fitness/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consent: uploadConsent,
          version: "v1.0",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Consent update fail ho gayi.");
      setMessage({ text: data.message, type: "success" });
      onRefresh();
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTrainerSharing = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/v1/member/fitness/trainer-sharing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: trainerSharingEnabled,
          categories: trainerCategories,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Trainer sharing update fail ho gayi.");
      setMessage({ text: data.message, type: "success" });
      onRefresh();
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleStopTrainerSharing = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/v1/member/fitness/trainer-sharing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: false,
          categories: [],
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setTrainerSharingEnabled(false);
      setMessage({ text: "Trainer sharing band kar di gayi. Member history mehfooz hai.", type: "success" });
      onRefresh();
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
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setMessage({ text: data.message, type: "success" });
      onRefresh();
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHistory = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/v1/member/fitness/history", { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setConfirmDelete(false);
      setMessage({ text: data.message, type: "success" });
      onRefresh();
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "var(--overlay)",
        backdropFilter: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "680px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          color: "var(--text-main)",
        }}
      >
        {/* Modal Header */}
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
            <Smartphone className="text-orange-500" size={24} />
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>
                Fitness Data Connection & Privacy
              </h3>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Android Health Connect permissions, cloud upload consent & trainer privacy
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
              padding: "4px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Informational Banner */}
        <div
          style={{
            padding: "12px 24px",
            background: "rgba(249, 115, 22, 0.1)",
            borderBottom: "1px solid rgba(249, 115, 22, 0.2)",
            fontSize: "0.82rem",
            color: "var(--amber-primary)",
            lineHeight: "1.4",
          }}
        >
          OXGEN aapki selected fitness information read karke activity summaries dikhayega. Aap decide kar sakte hain ke assigned trainer ko kya share karna hai. Connection kabhi bhi band ya delete kar sakte hain.
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border-subtle)",
            backgroundColor: "#0b0f19",
          }}
        >
          <button
            onClick={() => setActiveTab("permissions")}
            style={{
              flex: 1,
              padding: "12px 14px",
              background: activeTab === "permissions" ? "var(--bg-surface)" : "transparent",
              border: "none",
              borderBottom: activeTab === "permissions" ? "2px solid #f97316" : "none",
              color: activeTab === "permissions" ? "#f97316" : "var(--text-secondary)",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            1. Permissions
          </button>
          <button
            onClick={() => setActiveTab("consent")}
            style={{
              flex: 1,
              padding: "12px 14px",
              background: activeTab === "consent" ? "var(--bg-surface)" : "transparent",
              border: "none",
              borderBottom: activeTab === "consent" ? "2px solid #f97316" : "none",
              color: activeTab === "consent" ? "#f97316" : "var(--text-secondary)",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            2. Cloud Consent
          </button>
          <button
            onClick={() => setActiveTab("trainer")}
            style={{
              flex: 1,
              padding: "12px 14px",
              background: activeTab === "trainer" ? "var(--bg-surface)" : "transparent",
              border: "none",
              borderBottom: activeTab === "trainer" ? "2px solid #f97316" : "none",
              color: activeTab === "trainer" ? "#f97316" : "var(--text-secondary)",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            3. Trainer Sharing
          </button>
          <button
            onClick={() => setActiveTab("danger")}
            style={{
              flex: 1,
              padding: "12px 14px",
              background: activeTab === "danger" ? "var(--bg-surface)" : "transparent",
              border: "none",
              borderBottom: activeTab === "danger" ? "2px solid #ef4444" : "none",
              color: activeTab === "danger" ? "#ef4444" : "var(--text-secondary)",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            4. Disconnect / Delete
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "24px" }}>
          {message && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                marginBottom: "16px",
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

          {/* TAB 1: PERMISSIONS */}
          {activeTab === "permissions" && (
            <div>
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "4px" }}>
                  Selected Health Connect Data Categories
                </h4>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0 }}>
                  Aap chun sakte hain kaunsi information app padhe. Kisi permission ko deny karne par baqi app normal kaam karegi.
                </p>
              </div>

              <div style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
                {[
                  {
                    id: "STEPS",
                    name: "Daily Steps",
                    purpose: "Daily activity summary aur walking trend dikhane ke liye",
                    icon: Footprints,
                  },
                  {
                    id: "DISTANCE",
                    name: "Distance (km)",
                    purpose: "Recorded walking aur running distance calculate karne ke liye",
                    icon: Compass,
                  },
                  {
                    id: "EXERCISE_SESSIONS",
                    name: "Exercise Sessions",
                    purpose: "Workout type, timings aur duration sync karne ke liye",
                    icon: Dumbbell,
                  },
                  {
                    id: "ACTIVE_CALORIES",
                    name: "Active Calories",
                    purpose: "Available activity-energy estimate monitor karne ke liye",
                    icon: Flame,
                  },
                ].map((cat) => {
                  const Icon = cat.icon;
                  const isChecked = selectedPermissions.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                        padding: "12px 16px",
                        borderRadius: "10px",
                        backgroundColor: isChecked ? "rgba(249, 115, 22, 0.08)" : "var(--bg-secondary)",
                        border: `1px solid ${isChecked ? "rgba(249, 115, 22, 0.4)" : "var(--border-medium)"}`,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCategory(cat.id)}
                        style={{ marginTop: "4px", accentColor: "#f97316" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 600, fontSize: "0.9rem" }}>
                          <Icon size={16} className="text-orange-400" />
                          <span>{cat.name}</span>
                        </div>
                        <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                          {cat.purpose}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div
                style={{
                  background: "var(--bg-secondary)",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  fontSize: "0.78rem",
                  color: "var(--text-secondary)",
                  marginBottom: "20px",
                }}
              >
                <strong>Note:</strong> Android phone par OXGEN Flutter app se Health Connect permission grant hoti hai. Web panel se permissions update karne par sync filter lagu ho jayega.
              </div>

              <button
                className="btn btn-primary"
                onClick={handleSavePermissions}
                disabled={saving}
                style={{ width: "100%", padding: "10px", justifyContent: "center" }}
              >
                {saving ? "Saving..." : "Save Permissions Settings"}
              </button>
            </div>
          )}

          {/* TAB 2: BACKEND UPLOAD CONSENT */}
          {activeTab === "consent" && (
            <div>
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "4px" }}>
                  OXGEN Cloud Storage Consent
                </h4>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0 }}>
                  Health Connect permission ko automatic server save nahi samjha jata. Server par save karne ke liye separate consent darkaar hai.
                </p>
              </div>

              <div
                style={{
                  padding: "16px",
                  backgroundColor: "rgba(59, 130, 246, 0.08)",
                  border: "1px solid rgba(59, 130, 246, 0.2)",
                  borderRadius: "12px",
                  marginBottom: "20px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <Shield size={20} className="text-blue-400" />
                  <span style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--blue-primary)" }}>
                    Cloud Synchronization Question
                  </span>
                </div>
                <p style={{ fontSize: "0.85rem", color: "#e2e8f0", margin: "0 0 14px", lineHeight: "1.4" }}>
                  “Kya selected activity summaries aapke OXGEN account mein save ki ja sakti hain, taake aap web dashboard par bhi history aur weekly progress dekh sakein?”
                </p>

                <div style={{ fontSize: "0.78rem", color: "#94a3b8", display: "grid", gap: "6px" }}>
                  <div>• <strong>Data Types:</strong> Daily step counts, walking distance, exercise session metadata. High-frequency sensor samples save nahi honge.</div>
                  <div>• <strong>Retention:</strong> Jab tak aap account rakhein ya Synced History delete na karein.</div>
                  <div>• <strong>Privacy:</strong> Data kisi third-party ad network ko nahi jayega. Trainer sharing alag control hai.</div>
                </div>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px 16px",
                  borderRadius: "10px",
                  backgroundColor: uploadConsent ? "rgba(34, 197, 94, 0.1)" : "var(--bg-secondary)",
                  border: `1px solid ${uploadConsent ? "rgba(34, 197, 94, 0.4)" : "var(--border-medium)"}`,
                  cursor: "pointer",
                  marginBottom: "20px",
                }}
              >
                <input
                  type="checkbox"
                  checked={uploadConsent}
                  onChange={(e) => setUploadConsent(e.target.checked)}
                  style={{ accentColor: "#22c55e", width: "18px", height: "18px" }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", color: uploadConsent ? "var(--accent-primary)" : "var(--text-main)" }}>
                    {uploadConsent ? "Cloud Upload Consent Active (Ijazat Di Gayi Hai)" : "Cloud Upload Consent Revoked (Cloud par save na karein)"}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    {uploadConsent
                      ? "Phone sync hone par selected summaries backend database mein save hongi."
                      : "Phone par data local rahega; server par koi naya data upload nahi hoga."}
                  </div>
                </div>
              </label>

              <button
                className="btn btn-primary"
                onClick={handleSaveConsent}
                disabled={saving}
                style={{ width: "100%", padding: "10px", justifyContent: "center" }}
              >
                {saving ? "Saving..." : "Update Upload Consent"}
              </button>
            </div>
          )}

          {/* TAB 3: TRAINER SHARING */}
          {activeTab === "trainer" && (
            <div>
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "4px" }}>
                  Trainer Sharing Privacy Controls
                </h4>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0 }}>
                  Assigned trainer ko kya dikhana hai yeh aapka mukammal ikhtiyar hai.
                </p>
              </div>

              {/* Assigned Trainer Banner */}
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "10px",
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-medium)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <UserCheck size={18} className="text-orange-400" />
                  <span style={{ fontSize: "0.88rem" }}>
                    Assigned Trainer: <strong>{assignedTrainer ? assignedTrainer.name : "Koi Assigned Trainer Nahi"}</strong>
                  </span>
                </div>
                {!assignedTrainer && (
                  <span style={{ fontSize: "0.75rem", color: "#ef4444", fontWeight: 600 }}>
                    Sharing Unavailable
                  </span>
                )}
              </div>

              {assignedTrainer ? (
                <>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      backgroundColor: trainerSharingEnabled ? "rgba(249, 115, 22, 0.1)" : "var(--bg-secondary)",
                      border: `1px solid ${trainerSharingEnabled ? "rgba(249, 115, 22, 0.4)" : "var(--border-medium)"}`,
                      cursor: "pointer",
                      marginBottom: "16px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={trainerSharingEnabled}
                      onChange={(e) => setTrainerSharingEnabled(e.target.checked)}
                      style={{ accentColor: "#f97316", width: "18px", height: "18px" }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                        Share Fitness Data With Coach {assignedTrainer.name}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                        Agar yeh band ho toh trainer ko koi synced fitness data nahi dikhega.
                      </div>
                    </div>
                  </label>

                  {trainerSharingEnabled && (
                    <div style={{ marginBottom: "20px" }}>
                      <p style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "8px" }}>
                        Trainer ke sath kaunsi categories share hon:
                      </p>
                      <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        {[
                          { id: "STEPS", name: "Daily Steps" },
                          { id: "DISTANCE", name: "Distance (km)" },
                          { id: "EXERCISE_SESSIONS", name: "Exercise Sessions" },
                          { id: "ACTIVE_CALORIES", name: "Active Calories" },
                        ].map((cat) => {
                          const isChecked = trainerCategories.includes(cat.id);
                          return (
                            <label
                              key={cat.id}
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
                                onChange={() => toggleTrainerCategory(cat.id)}
                                style={{ accentColor: "#f97316" }}
                              />
                              <span>{cat.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveTrainerSharing}
                      disabled={saving}
                      style={{ flex: 1, padding: "10px", justifyContent: "center" }}
                    >
                      {saving ? "Saving..." : "Confirm Trainer Sharing"}
                    </button>
                    {connection?.trainerSharingEnabled && (
                      <button
                        className="btn btn-secondary"
                        onClick={handleStopTrainerSharing}
                        disabled={saving}
                        style={{ padding: "10px 16px", borderColor: "#ef4444", color: "#ef4444" }}
                      >
                        Stop Trainer Sharing
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", padding: "12px", background: "var(--bg-secondary)", borderRadius: "8px" }}>
                  Jab gym staff aapko koi personal trainer assign karega, toh yahan sharing enable karne ka option khul jayega.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DISCONNECT / DELETE CONTROLS */}
          {activeTab === "danger" && (
            <div>
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "4px", color: "var(--danger)" }}>
                  Revocation & Deletion Controls
                </h4>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0 }}>
                  Aapke paas 3 alag controls hain: Trainer sharing band karna, Sync disconnect karna, ya Cloud history delete karna.
                </p>
              </div>

              <div style={{ display: "grid", gap: "16px" }}>
                {/* Control 1: Stop Trainer Sharing */}
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
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>1. Stop Trainer Sharing</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                      Trainer access foran band ho jayega; aapki apni web dashboard history mehfooz rahegi.
                    </div>
                  </div>
                  <button
                    onClick={handleStopTrainerSharing}
                    disabled={saving || !connection?.trainerSharingEnabled}
                    className="btn btn-secondary"
                    style={{ fontSize: "0.8rem", padding: "6px 12px", whiteSpace: "nowrap" }}
                  >
                    Stop Sharing
                  </button>
                </div>

                {/* Control 2: Disconnect Sync */}
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
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>2. Disconnect / Stop Sync</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                      Aainda koi data read ya upload nahi hoga. Purani saved cloud history barkarar rahegi.
                    </div>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    disabled={saving || connection?.status === "DISCONNECTED"}
                    className="btn btn-secondary"
                    style={{ fontSize: "0.8rem", padding: "6px 12px", whiteSpace: "nowrap" }}
                  >
                    <PowerOff size={14} /> Disconnect
                  </button>
                </div>

                {/* Control 3: Delete Synced History */}
                <div
                  style={{
                    padding: "16px",
                    backgroundColor: "rgba(239, 68, 68, 0.08)",
                    borderRadius: "10px",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--danger)" }}>
                        3. Delete Synced History
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                        OXGEN database se aapke tamaam imported summaries aur workouts permanently remove kar diye jayenge. Phone ka source data unchanged rahega.
                      </div>
                    </div>
                    {!confirmDelete ? (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        disabled={saving}
                        className="btn btn-secondary"
                        style={{ fontSize: "0.8rem", padding: "6px 12px", borderColor: "#ef4444", color: "#ef4444", whiteSpace: "nowrap" }}
                      >
                        <Trash2 size={14} /> Delete History
                      </button>
                    ) : null}
                  </div>

                  {confirmDelete && (
                    <div
                      style={{
                        marginTop: "12px",
                        padding: "12px",
                        backgroundColor: "var(--bg-surface)",
                        borderRadius: "8px",
                        border: "1px solid #ef4444",
                      }}
                    >
                      <p style={{ fontSize: "0.82rem", color: "#fca5a5", margin: "0 0 10px" }}>
                        Kya aap waqai cloud par saved apni tamaam fitness activity delete karna chahte hain?
                      </p>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={handleDeleteHistory}
                          disabled={saving}
                          className="btn btn-primary"
                          style={{ backgroundColor: "#ef4444", borderColor: "#ef4444", padding: "6px 14px", fontSize: "0.8rem" }}
                        >
                          {saving ? "Deleting..." : "Haan, Mukammal Delete Karein"}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(false)}
                          disabled={saving}
                          className="btn btn-secondary"
                          style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
