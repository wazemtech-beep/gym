"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import { X, Bell, Mail, Smartphone, ShieldCheck, Check } from "lucide-react";

interface NotificationPreferencesModalProps {
  onClose: () => void;
}

export default function NotificationPreferencesModal({
  onClose,
}: NotificationPreferencesModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [prefs, setPrefs] = useState({
    emailPayment: true,
    emailMembership: true,
    emailTraining: true,
    emailAnnouncements: true,
    pushPayment: true,
    pushMembership: true,
    pushTraining: true,
    pushAnnouncements: true,
  });

  useEffect(() => {
    fetchPrefs();
  }, []);

  const fetchPrefs = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/v1/member/notification-preferences");
      const json = await res.json();
      if (json.success && json.data) {
        setPrefs({
          emailPayment: json.data.emailPayment,
          emailMembership: json.data.emailMembership,
          emailTraining: json.data.emailTraining,
          emailAnnouncements: json.data.emailAnnouncements,
          pushPayment: json.data.pushPayment,
          pushMembership: json.data.pushMembership,
          pushTraining: json.data.pushTraining,
          pushAnnouncements: json.data.pushAnnouncements,
        });
      }
    } catch (err) {
      console.error("Failed to load preferences:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSuccessMsg(null);
      const res = await apiFetch("/api/v1/member/notification-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg("Preferences kamiyabi se save ho gayi hain!");
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error("Failed to save preferences:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay className="modal-overlay">
      <div
        className="modal-content glass-panel"
        style={{ maxWidth: "600px", maxHeight: "90vh", overflowY: "auto", padding: "28px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ background: "rgba(249, 115, 22, 0.15)", padding: "8px", borderRadius: "8px", color: "var(--accent-primary)" }}>
              <Bell size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Notification Preferences</h3>
              <p style={{ fontSize: "0.82rem", color: "var(--text-dim)", margin: 0 }}>
                Email aur mobile push channel controls
              </p>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: "6px" }}>
            <X size={18} />
          </button>
        </div>

        {/* Lock Screen Privacy Banner */}
        <div
          style={{
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            borderRadius: "10px",
            padding: "12px 14px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            marginBottom: "20px",
          }}
        >
          <ShieldCheck size={18} style={{ color: "#34d399", marginTop: "2px", flexShrink: 0 }} />
          <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", lineHeight: "1.4" }}>
            <strong style={{ color: "#e2e8f0" }}>Lock Screen Privacy Protected:</strong> Sensitive payment amounts,
            body measurements aur diet details lock screen par hide rahenge. Sirf secure app notice preview show hoga.
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "30px", textAlign: "center", color: "var(--text-dim)" }}>Loading preferences...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Category Rows */}
            {[
              {
                title: "Payments & Invoices",
                desc: "Receipts, installment dues, transfer approvals",
                emailKey: "emailPayment" as const,
                pushKey: "pushPayment" as const,
              },
              {
                title: "Membership & Renewals",
                desc: "Expiry notices (7d / 1d), renewal decisions",
                emailKey: "emailMembership" as const,
                pushKey: "pushMembership" as const,
              },
              {
                title: "Training & Nutrition",
                desc: "Assigned workout & diet routine publications",
                emailKey: "emailTraining" as const,
                pushKey: "pushTraining" as const,
              },
              {
                title: "Gym Announcements",
                desc: "Holiday schedules, timing changes, gym notices",
                emailKey: "emailAnnouncements" as const,
                pushKey: "pushAnnouncements" as const,
              },
            ].map((cat, idx) => (
              <div
                key={idx}
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--text-main)" }}>
                    {cat.title}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: "2px" }}>
                    {cat.desc}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
                  {/* Email Toggle */}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      cursor: "pointer",
                      fontSize: "0.82rem",
                      color: prefs[cat.emailKey] ? "var(--text-main)" : "var(--text-dim)",
                    }}
                  >
                    <Mail size={15} style={{ color: prefs[cat.emailKey] ? "var(--accent-primary)" : "var(--text-dim)" }} />
                    <input
                      type="checkbox"
                      checked={prefs[cat.emailKey]}
                      onChange={(e) => setPrefs({ ...prefs, [cat.emailKey]: e.target.checked })}
                    />
                    <span>Email</span>
                  </label>

                  {/* Push Toggle */}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      cursor: "pointer",
                      fontSize: "0.82rem",
                      color: prefs[cat.pushKey] ? "var(--text-main)" : "var(--text-dim)",
                    }}
                  >
                    <Smartphone size={15} style={{ color: prefs[cat.pushKey] ? "#38bdf8" : "var(--text-dim)" }} />
                    <input
                      type="checkbox"
                      checked={prefs[cat.pushKey]}
                      onChange={(e) => setPrefs({ ...prefs, [cat.pushKey]: e.target.checked })}
                    />
                    <span>Push</span>
                  </label>
                </div>
              </div>
            ))}

            {successMsg && (
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#34d399",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Check size={16} />
                {successMsg}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}
