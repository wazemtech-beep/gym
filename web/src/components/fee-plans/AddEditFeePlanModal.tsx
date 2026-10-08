"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import {
  X,
  CreditCard,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Info,
} from "lucide-react";
import { DurationUnit, PaymentTerms } from "@prisma/client";
import { calculateMembershipEndDate } from "@/lib/pricing";

interface AddEditFeePlanModalProps {
  isOpen: boolean;
  planToEdit?: any | null;
  onClose: () => void;
  onSuccess: (plan: any) => void;
}

export default function AddEditFeePlanModal({
  isOpen,
  planToEdit,
  onClose,
  onSuccess,
}: AddEditFeePlanModalProps) {
  const isEditing = Boolean(planToEdit);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    durationValue: 1,
    durationUnit: "CALENDAR_MONTHS" as DurationUnit,
    membershipFee: "3000",
    admissionFee: "1000",
    includedServices: "Gym Floor Access, Cardio Area, Standard Lockers",
    eligibility: "Everyone",
    paymentTerms: "FULL_PAYMENT_ONLY" as PaymentTerms,
    isActive: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (planToEdit) {
      setFormData({
        name: planToEdit.name || "",
        description: planToEdit.description || "",
        durationValue: planToEdit.durationValue || 1,
        durationUnit: planToEdit.durationUnit || "CALENDAR_MONTHS",
        membershipFee: planToEdit.membershipFee?.toString() || "3000",
        admissionFee: planToEdit.admissionFee?.toString() || "0",
        includedServices: planToEdit.includedServices || "",
        eligibility: planToEdit.eligibility || "Everyone",
        paymentTerms: planToEdit.paymentTerms || "FULL_PAYMENT_ONLY",
        isActive: planToEdit.isActive ?? true,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        durationValue: 1,
        durationUnit: "CALENDAR_MONTHS",
        membershipFee: "3000",
        admissionFee: "1000",
        includedServices: "Gym Floor Access, Cardio Area, Standard Lockers",
        eligibility: "Everyone",
        paymentTerms: "FULL_PAYMENT_ONLY",
        isActive: true,
      });
    }
  }, [planToEdit, isOpen]);

  if (!isOpen) return null;

  // Live Validity Calculation Preview (Requirement Point 3)
  const sampleStartDate = new Date();
  const sampleEndDate = calculateMembershipEndDate(
    sampleStartDate,
    parseInt(formData.durationValue.toString(), 10) || 1,
    formData.durationUnit
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const url = isEditing ? `/api/v1/fee-plans/${planToEdit.id}` : "/api/v1/fee-plans";
      const method = isEditing ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Fee plan save karne mein khata aayi.");
      }

      onSuccess(data.plan);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save fee plan.");
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
          maxWidth: "680px",
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
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "var(--accent-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-primary)",
                border: "1px solid var(--border-accent)",
              }}
            >
              <CreditCard size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                {isEditing ? `Edit Fee Plan: ${planToEdit.name}` : "Add fee plan"}
              </h2>
              {isEditing && (
                <p style={{ fontSize: "0.825rem", color: "var(--text-secondary)", margin: "2px 0 0" }}>
                  Existing memberships stay unchanged.
                </p>
              )}
            </div>
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

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ overflowY: "auto", padding: "24px" }}>
          {error && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                background: "var(--danger-soft)",
                border: "1px solid var(--danger-border)",
                color: "var(--danger)",
                fontSize: "0.875rem",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          {/* Section 1: Basic Info */}
          <div style={{ marginBottom: "18px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
              Plan Name <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Monthly membership"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field"
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
              
              Description (optional)
            </label>
            <input
              type="text"
              placeholder="Package details"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-field"
              style={{ width: "100%" }}
            />
          </div>

          {/* Section 2: Duration Configuration & Calendar Rules (Point 3) */}
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              marginBottom: "18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
              <Calendar size={16} color="var(--accent-primary)" />
              <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-main)" }}>
                Duration & validity
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.785rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Duration Value <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.durationValue}
                  onChange={(e) => setFormData({ ...formData, durationValue: parseInt(e.target.value, 10) || 1 })}
                  className="input-field"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.785rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  
                  Duration unit <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <select
                  value={formData.durationUnit}
                  onChange={(e) => setFormData({ ...formData, durationUnit: e.target.value as DurationUnit })}
                  className="input-field"
                  style={{ width: "100%" }}
                >
                  <option value="CALENDAR_MONTHS">Calendar months</option>
                  <option value="DAYS">Fixed days</option>
                  <option value="YEARS">Calendar years</option>
                </select>
              </div>
            </div>

            {/* Live Sample Preview */}
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "var(--accent-soft)",
                border: "1px solid var(--border-accent)",
                fontSize: "0.8rem",
                color: "var(--accent-primary)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Info size={16} />
              <span>
                <strong>Example validity:</strong> {sampleStartDate.toLocaleDateString()} – <strong>{sampleEndDate.toLocaleDateString()}</strong>
              </span>
            </div>
          </div>

          {/* Section 3: Pricing (Membership Fee + Admission Fee) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px", marginBottom: "18px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Membership Fee (PKR) <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "12px", top: "10px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Rs.
                </span>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="3000"
                  value={formData.membershipFee}
                  onChange={(e) => setFormData({ ...formData, membershipFee: e.target.value })}
                  className="input-field"
                  style={{ width: "100%", paddingLeft: "40px" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                
                Admission fee (PKR)
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "12px", top: "10px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Rs.
                </span>
                <input
                  type="number"
                  min="0"
                  placeholder="1000"
                  value={formData.admissionFee}
                  onChange={(e) => setFormData({ ...formData, admissionFee: e.target.value })}
                  className="input-field"
                  style={{ width: "100%", paddingLeft: "40px" }}
                />
              </div>
              <p style={{ fontSize: "0.725rem", color: "var(--text-secondary)", margin: "4px 0 0" }}>
                
                Charged on first joining only.
              </p>
            </div>
          </div>

          {/* Section 4: Included Services & Eligibility */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px", marginBottom: "18px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Included Services
              </label>
              <input
                type="text"
                placeholder="Gym Access, Locker, Steam, Sauna"
                value={formData.includedServices}
                onChange={(e) => setFormData({ ...formData, includedServices: e.target.value })}
                className="input-field"
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Eligibility
              </label>
              <select
                value={formData.eligibility}
                onChange={(e) => setFormData({ ...formData, eligibility: e.target.value })}
                className="input-field"
                style={{ width: "100%" }}
              >
                <option value="Everyone">Everyone</option>
                <option value="Students (Valid Student ID Required)">Students (Valid Student ID Required)</option>
                <option value="VIP / Executives">VIP / Executives</option>
                <option value="Ladies Hours">Ladies Hours Only</option>
              </select>
            </div>
          </div>

          {/* Section 5: Payment Terms & Status */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px", marginBottom: "22px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                
                Payment terms
              </label>
              <select
                value={formData.paymentTerms}
                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value as PaymentTerms })}
                className="input-field"
                style={{ width: "100%" }}
              >
                <option value="FULL_PAYMENT_ONLY">Full Payment Only</option>
                <option value="INSTALLMENTS_ALLOWED">Installments allowed</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Plan Status
              </label>
              <select
                value={formData.isActive ? "ACTIVE" : "INACTIVE"}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.value === "ACTIVE" })}
                className="input-field"
                style={{ width: "100%" }}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          {/* Actions */}
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
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 22px" }}
            >
              {loading ? "Saving Plan..." : isEditing ? "Save & Update Plan" : "Create Fee Plan"}
              <Sparkles size={16} />
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
