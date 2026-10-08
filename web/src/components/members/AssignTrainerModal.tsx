"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import { X, Dumbbell, AlertTriangle, CheckCircle2, Shield, Calendar, UserCheck } from "lucide-react";

interface AssignTrainerModalProps {
  isOpen: boolean;
  member: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AssignTrainerModal({
  isOpen,
  member,
  onClose,
  onSuccess,
}: AssignTrainerModalProps) {
  const readCacheVersion = useReadCacheVersion();
  const [trainers, setTrainers] = useState<any[]>([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>(member.trainerId || "");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [coachingFocus, setCoachingFocus] = useState(member.fitnessGoal || "General Fitness & Strength");
  const [notes, setNotes] = useState("");
  const [consentMeasurements, setConsentMeasurements] = useState(false);
  const [consentHealthActivity, setConsentHealthActivity] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        setFetching(true);
        // Fetch active trainers
        const trRes = await apiFetch("/api/v1/trainers");
        const trData = await trRes.json();
        if (trData.success) {
          setTrainers(trData.data || []);
        }

        // Fetch past assignments for this member
        const histRes = await apiFetch(`/api/v1/members/${member.id}/trainer`);
        const histData = await histRes.json();
        if (histData.success) {
          setHistory(histData.data || []);
          const active = histData.data?.find((a: any) => a.isActive);
          if (active) {
            setSelectedTrainerId(active.trainerId);
            setCoachingFocus(active.coachingFocus || member.fitnessGoal || "");
            setConsentMeasurements(active.consentMeasurements);
            setConsentHealthActivity(active.consentHealthActivity);
          }
        }
      } catch (err) {
        console.error("Failed to load trainer data:", err);
      } finally {
        setFetching(false);
      }
    };

    loadData();
  }, [isOpen, member.id, readCacheVersion]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedTrainerId) {
      setError("Active trainer muntakhib karein.");
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch(`/api/v1/members/${member.id}/trainer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainerId: selectedTrainerId,
          startDate,
          endDate: endDate || null,
          coachingFocus,
          notes,
          consentMeasurements,
          consentHealthActivity,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Trainer assign karne mein masla aya.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to assign trainer.");
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
        backgroundColor: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
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
          maxWidth: "540px",
          borderRadius: "16px",
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-surface)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
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
                borderRadius: "10px",
                background: "var(--purple-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--purple-primary)",
              }}
            >
              <UserCheck size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                Assign / Change Trainer
              </h2>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "2px 0 0" }}>
                Member: {member.fullName} ({member.memberId})
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
              padding: "6px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && (
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#f87171",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <div>
            <label className="field-label">Active Trainer Select Karein *</label>
            {fetching ? (
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>Trainers load ho rahe hain...</p>
            ) : (
              <select
                value={selectedTrainerId}
                onChange={(e) => setSelectedTrainerId(e.target.value)}
                className="input-field"
                required
              >
                <option value="">Trainer select karein...</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.phone || "No Phone"}) — {t._count?.assignedMembers || 0} members active
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="field-label">Effective Start Date *</label>
              <input
                type="date"
                className="input-field"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label">End Date (Optional)</label>
              <input
                type="date"
                className="input-field"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="field-label">Coaching Focus / Goal</label>
            <input
              type="text"
              className="input-field"
              value={coachingFocus}
              onChange={(e) => setCoachingFocus(e.target.value)}
              placeholder="e.g. Strength Training, Weight Loss, Muscle Building"
            />
          </div>

          <div>
            <label className="field-label">Operational Note / Reason</label>
            <textarea
              className="input-field"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Assignment ki tafseel ya tabdeeli ki wajah..."
            />
          </div>

          {/* Privacy Boundaries Consent */}
          <div style={{ background: "rgba(255,255,255,0.02)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", color: "var(--text-main)", fontWeight: 600, fontSize: "0.85rem" }}>
              <Shield size={16} color="var(--accent-primary)" />
              Privacy & Data Sharing Consent
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "10px", lineHeight: 1.4 }}>
              Trainer assign hone se financial records ka access NAHI milta. Neeche diye gaye private data sharing ke liye member ka razamand hona zaroori hai:
            </p>

            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", cursor: "pointer", marginBottom: "8px" }}>
              <input
                type="checkbox"
                checked={consentMeasurements}
                onChange={(e) => setConsentMeasurements(e.target.checked)}
              />
              Measurements & Progress Photos Sharing Allowed
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={consentHealthActivity}
                onChange={(e) => setConsentHealthActivity(e.target.checked)}
              />
              Health Connect Daily Steps & Fitness Activity Sharing Allowed
            </label>
          </div>

          {/* Previous Handover History */}
          {history.length > 0 && (
            <div>
              <label className="field-label" style={{ fontSize: "0.8rem", marginBottom: "6px" }}>Assignment History</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "120px", overflowY: "auto" }}>
                {history.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      background: "rgba(255,255,255,0.02)",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600 }}>{h.trainer?.name}</span>
                      <span style={{ color: "var(--text-dim)", marginLeft: "6px" }}>
                        ({new Date(h.startDate).toLocaleDateString()} {h.endDate ? `- ${new Date(h.endDate).toLocaleDateString()}` : "- Active"})
                      </span>
                    </div>
                    <span className={h.isActive ? "badge badge-accent" : "badge"}>
                      {h.isActive ? "Active" : "Closed"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "12px",
              marginTop: "8px",
            }}
          >
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary" style={{ padding: "8px 20px" }}>
              {loading ? "Assigning..." : "Confirm Trainer Assignment"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
