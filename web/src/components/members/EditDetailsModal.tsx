"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch } from "@/lib/apiFetch";

import React, { useState } from "react";
import { X, User, Phone, Mail, MapPin, Heart, AlertTriangle, CheckCircle2 } from "lucide-react";

interface EditDetailsModalProps {
  isOpen: boolean;
  member: any;
  onClose: () => void;
  onSuccess: (updated: any) => void;
}

export default function EditDetailsModal({
  isOpen,
  member,
  onClose,
  onSuccess,
}: EditDetailsModalProps) {
  const [formData, setFormData] = useState({
    fullName: member.fullName || "",
    phone: member.phone || "",
    email: member.email || "",
    dateOfBirth: member.dateOfBirth ? member.dateOfBirth.split("T")[0] : "",
    address: member.address || "",
    emergencyContactName: member.emergencyContactName || "",
    emergencyContactPhone: member.emergencyContactPhone || "",
    fitnessGoal: member.fitnessGoal || "General Fitness",
    limitations: member.limitations || "",
    staffNote: member.staffNote || "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch(`/api/v1/members/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Member update karne mein khata aayi.");
      }

      onSuccess(data.member);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update member.");
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
          maxWidth: "700px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "16px",
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-surface)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
              Edit Member Details: {member.fullName} ({member.memberId})
            </h2>
            
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: "auto", padding: "24px" }}>
          {error && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                background: "var(--danger-soft)",
                border: "1px solid var(--danger-border)",
                color: "var(--danger)",
                fontSize: "0.85rem",
                marginBottom: "18px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Full Name <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="input-field"
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Phone Number (03XXXXXXXXX) <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input-field"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-field"
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Date of Birth
              </label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="input-field"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
              Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="input-field"
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Emergency Contact Name
              </label>
              <input
                type="text"
                value={formData.emergencyContactName}
                onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                className="input-field"
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Emergency Contact Phone
              </label>
              <input
                type="text"
                value={formData.emergencyContactPhone}
                onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                className="input-field"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Fitness Goal
              </label>
              <select
                value={formData.fitnessGoal}
                onChange={(e) => setFormData({ ...formData, fitnessGoal: e.target.value })}
                className="input-field"
                style={{ width: "100%" }}
              >
                <option value="General Fitness">General Fitness</option>
                <option value="Weight Loss">Weight Loss & Fat Burning</option>
                <option value="Muscle Gain">Muscle Gain & Hypertrophy</option>
                <option value="Strength & Power">Strength & Powerlifting</option>
                <option value="Cardio & Stamina">Cardio & Stamina</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Limitations / Injuries
              </label>
              <input
                type="text"
                value={formData.limitations}
                onChange={(e) => setFormData({ ...formData, limitations: e.target.value })}
                className="input-field"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
              Staff Internal Note
            </label>
            <input
              type="text"
              value={formData.staffNote}
              onChange={(e) => setFormData({ ...formData, staffNote: e.target.value })}
              className="input-field"
              style={{ width: "100%" }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "12px",
              borderTop: "1px solid var(--border-subtle)",
              paddingTop: "18px",
            }}
          >
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary" style={{ padding: "8px 20px" }}>
              {loading ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
