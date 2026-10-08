"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Heart,
  AlertTriangle,
  FileText,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import CloudinaryUploadButton from "@/components/common/CloudinaryUploadButton";

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newMember: any) => void;
}

export default function AddMemberModal({ isOpen, onClose, onSuccess }: AddMemberModalProps) {
  const readCacheVersion = useReadCacheVersion();
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    photoUrl: "",
    joiningDate: new Date().toISOString().split("T")[0],
    dateOfBirth: "",
    address: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    fitnessGoal: "General Fitness",
    limitations: "",
    staffNote: "",
    openingDues: "",
    allowFamilyDuplicate: false,
    familyContactReason: "",
    admissionFeePreviouslyPaid: false,
    admissionHistoryNote: "",
  });

  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdMember, setCreatedMember] = useState<any>(null);
  const [nameWarnings, setNameWarnings] = useState<any[]>([]);

  // Debounced duplicate check when phone or email changes
  useEffect(() => {
    if ((!formData.phone || formData.phone.length < 7) && formData.fullName.trim().length < 3) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsCheckingDuplicate(true);
        const res = await apiFetch("/api/v1/members/check-duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: formData.phone, email: formData.email, fullName: formData.fullName }),
        });
        const data = await res.json();
        setNameWarnings(data.sameNameMembers || []);
        if (data.exists) {
          setDuplicateWarning(data.member);
        } else {
          setDuplicateWarning(null);
        }
      } catch (err) {
        console.error("Duplicate check error:", err);
      } finally {
        setIsCheckingDuplicate(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [formData.phone, formData.email, formData.fullName, readCacheVersion]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch("/api/v1/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Member register karne mein khata aayi.");
      }

      setCreatedMember(data.member);
      onSuccess(data.member);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setCreatedMember(null);
    setFormData({
      fullName: "",
      phone: "",
      email: "",
      photoUrl: "",
      joiningDate: new Date().toISOString().split("T")[0],
      dateOfBirth: "",
      address: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      fitnessGoal: "General Fitness",
      limitations: "",
      staffNote: "",
      openingDues: "",
      allowFamilyDuplicate: false,
      familyContactReason: "",
      admissionFeePreviouslyPaid: false,
      admissionHistoryNote: "",
    });
    setError(null);
    setDuplicateWarning(null);
    onClose();
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
          maxWidth: "760px",
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
              <User size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                {createdMember ? "Member added" : "Add member"}
              </h2>
              
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "8px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Success Screen with Next Actions (Point 5) */}
        {createdMember ? (
          <div style={{ padding: "32px 24px", overflowY: "auto" }}>
            <div
              style={{
                textAlign: "center",
                marginBottom: "28px",
                padding: "24px",
                borderRadius: "14px",
                background: "var(--accent-soft)",
                border: "1px solid var(--border-accent)",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "var(--accent-primary)",
                  color: "var(--text-inverse)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                  boxShadow: "var(--shadow-lg)",
                }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h3 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-main)", margin: "0 0 6px" }}>
                {createdMember.fullName}
              </h3>
              <div
                style={{
                  display: "inline-block",
                  padding: "4px 14px",
                  borderRadius: "20px",
                  background: "var(--accent-soft)",
                  color: "var(--accent-primary)",
                  fontWeight: 700,
                  fontSize: "1rem",
                  letterSpacing: "0.5px",
                  marginBottom: "8px",
                }}
              >
                Member ID: {createdMember.memberId}
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
                Phone: {createdMember.phone} • Joining: {new Date(createdMember.joiningDate).toLocaleDateString()}
              </p>
              {createdMember.openingDues > 0 && (
                <div
                  style={{
                    marginTop: "12px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    background: "var(--amber-soft)",
                    border: "1px solid var(--amber-border)",
                    color: "var(--amber-primary)",
                    fontSize: "0.825rem",
                  }}
                >
                  <DollarSign size={14} />
                  Opening Dues Invoice Generated: Rs. {createdMember.openingDues.toLocaleString()}
                </div>
              )}
            </div>

            {/* Point 5: Next Action Options */}
            <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "14px" }}>
              
              Next steps
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px", marginBottom: "24px" }}>
              <Link
                href={`/admin/members/${createdMember.id}?tab=memberships&action=new`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px",
                  borderRadius: "12px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  textDecoration: "none",
                  color: "var(--text-main)",
                  transition: "all 0.2s",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--accent-primary)" }}>
                    
                    Assign membership
                  </div>
                  
                </div>
                <ArrowRight size={18} color="var(--accent-primary)" />
              </Link>

              <Link
                href={`/admin/members/${createdMember.id}?tab=payments&action=record`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px",
                  borderRadius: "12px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  textDecoration: "none",
                  color: "var(--text-main)",
                  transition: "all 0.2s",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--blue-primary)" }}>
                    
                    Record payment
                  </div>
                  
                </div>
                <ArrowRight size={18} color="#38bdf8" />
              </Link>

              <Link
                href={`/admin/members/${createdMember.id}?tab=app-access`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px",
                  borderRadius: "12px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  textDecoration: "none",
                  color: "var(--text-main)",
                  transition: "all 0.2s",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--purple-primary)" }}>
                    
                    Activate app access
                  </div>
                  
                </div>
                <ArrowRight size={18} color="#a855f7" />
              </Link>

              <Link
                href={`/admin/members/${createdMember.id}?tab=training`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px",
                  borderRadius: "12px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  textDecoration: "none",
                  color: "var(--text-main)",
                  transition: "all 0.2s",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--amber-primary)" }}>
                    
                    Assign trainer
                  </div>
                  
                </div>
                <ArrowRight size={18} color="#f59e0b" />
              </Link>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                type="button"
                onClick={handleResetAndClose}
                className="btn-secondary"
                style={{ padding: "10px 20px" }}
              >
                
                Done
              </button>
              <Link
                href={`/admin/members/${createdMember.id}`}
                className="btn-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  textDecoration: "none",
                }}
              >
                View Full Profile
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        ) : (
          /* Form Screen */
          <form onSubmit={handleSubmit} style={{ overflowY: "auto", padding: "24px" }}>
            {nameWarnings.length > 0 && <p role="status">Similar name already registered: {nameWarnings.map(member => `${member.fullName} (${member.memberId})`).join(", ")}. Check these records before creating another member.</p>}
            <label className="form-label"><input type="checkbox" checked={formData.admissionFeePreviouslyPaid} onChange={e => setFormData({ ...formData, admissionFeePreviouslyPaid: e.target.checked })} /> Existing member already paid admission</label>
            {formData.admissionFeePreviouslyPaid && <label className="form-label">Admission history note<input className="input-field" required value={formData.admissionHistoryNote} onChange={e => setFormData({ ...formData, admissionHistoryNote: e.target.value })} /></label>}
            {formData.allowFamilyDuplicate && <label className="form-label">Reason for shared family contact<input className="input-field" required value={formData.familyContactReason} onChange={e => setFormData({ ...formData, familyContactReason: e.target.value })} /></label>}
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

            {/* Duplicate Member Warning (Point 3) */}
            {duplicateWarning && (
              <div
                style={{
                  padding: "14px 18px",
                  borderRadius: "10px",
                  background: "var(--amber-soft)",
                  border: "1px solid var(--amber-border)",
                  color: "var(--amber-primary)",
                  fontSize: "0.875rem",
                  marginBottom: "20px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700 }}>
                  <AlertTriangle size={18} />
                  Existing Member Record Found!
                </div>
                <p style={{ margin: "6px 0 10px", color: "var(--text-primary)", fontSize: "0.85rem" }}>
                  Is phone number par <strong>{duplicateWarning.fullName}</strong> (ID:{" "}
                  <strong>{duplicateWarning.memberId}</strong>) pehle se register hain.
                </p>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.825rem" }}>
                  <input
                    type="checkbox"
                    checked={formData.allowFamilyDuplicate}
                    onChange={(e) => setFormData({ ...formData, allowFamilyDuplicate: e.target.checked })}
                    style={{ accentColor: "var(--accent-primary)" }}
                  />
                  
                  Allow shared family phone number
                </label>
              </div>
            )}

            {/* Section 1: Basic Information */}
            <div style={{ marginBottom: "22px" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--accent-primary)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                <User size={16} />  Contact details
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Full Name <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bilal Tariq"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="input-field"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                    
                    Phone number <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      required
                      placeholder="03001234567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="input-field"
                      style={{ width: "100%" }}
                    />
                    {isCheckingDuplicate && (
                      <span style={{ position: "absolute", right: "12px", top: "10px", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        Checking...
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px", marginTop: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="bilal@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Gym Joining Date <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.joiningDate}
                    onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                    className="input-field"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Identification / Profile Photo
                  </label>
                  <CloudinaryUploadButton
                    folder="members"
                    currentUrl={formData.photoUrl}
                    label="Upload photo"
                    accept="image/*"
                    onUploadSuccess={(data) => setFormData(previous => ({ ...previous, photoUrl: data.url }))}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Contact & Emergency Details */}
            <div style={{ marginBottom: "22px" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                <MapPin size={16} />  Personal & emergency details
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px" }}>
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
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Residential Address
                  </label>
                  <input
                    type="text"
                    placeholder="Gulberg III, Lahore"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="input-field"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px", marginTop: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tariq Mehmood (Father)"
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
                    placeholder="03009876543"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                    className="input-field"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Fitness & Internal Notes */}
            <div style={{ marginBottom: "22px" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Heart size={16} />  Fitness profile
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px" }}>
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
                    Physical Limitations / Medical Injuries
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lower back pain, asthma"
                    value={formData.limitations}
                    onChange={(e) => setFormData({ ...formData, limitations: e.target.value })}
                    className="input-field"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ marginTop: "14px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  
                  Staff note (private)
                </label>
                <input
                  type="text"
                  placeholder="e.g. VIP member reference, corporate discount query"
                  value={formData.staffNote}
                  onChange={(e) => setFormData({ ...formData, staffNote: e.target.value })}
                  className="input-field"
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Section 4: Existing Member Opening Balance (Point 8) */}
            <div
              style={{
                marginBottom: "24px",
                padding: "16px",
                borderRadius: "12px",
                background: "var(--bg-secondary)",
                border: "1px dashed var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <DollarSign size={16} color="var(--accent-primary)" />
                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-main)" }}>
                  
                  Opening dues
                </span>
              </div>
              <p style={{ fontSize: "0.785rem", color: "var(--text-secondary)", margin: "0 0 10px" }}>
                Enter unpaid past fees. <strong>Counted in collections only when paid.</strong>
              </p>
              <div style={{ maxWidth: "260px" }}>
                <input
                  type="number"
                  min="0"
                  placeholder="Rs. 0"
                  value={formData.openingDues}
                  onChange={(e) => setFormData({ ...formData, openingDues: e.target.value })}
                  className="input-field"
                  style={{ width: "100%" }}
                />
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
                paddingTop: "20px",
              }}
            >
              <button
                type="button"
                onClick={handleResetAndClose}
                className="btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 24px",
                }}
              >
                {loading ? "Saving Member..." : "Save Member & Generate ID"}
                <Sparkles size={16} />
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalOverlay>
  );
}
