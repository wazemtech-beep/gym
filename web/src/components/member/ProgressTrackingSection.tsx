"use client";
import MemberLoadingLayout from "./MemberLoadingLayout";
import layoutStyles from "./MemberPages.module.css";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Plus,
  Calendar,
  Camera,
  Trash2,
  Lock,
  Unlock,
  Shield,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  X,
  Check,
  Target,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import CloudinaryUploadButton from "@/components/common/CloudinaryUploadButton";
import ProgressChart from "./ProgressChart";
import ProgressSharing from "./ProgressSharing";

export default function ProgressTrackingSection() {
  const readCacheVersion = useReadCacheVersion();
  const [data, setData] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Measurement modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [weightKg, setWeightKg] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [chestCm, setChestCm] = useState("");
  const [hipsCm, setHipsCm] = useState("");
  const [armsCm, setArmsCm] = useState("");
  const [thighsCm, setThighsCm] = useState("");
  const [notes, setNotes] = useState("");
  const [sameDayChoice, setSameDayChoice] = useState("");
  const [confirmUnusual, setConfirmUnusual] = useState(false);
  const [submittingMeasurement, setSubmittingMeasurement] = useState(false);
  const [measurementMsg, setMeasurementMsg] = useState<string | null>(null);

  // Set Goal modal state
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [targetWeight, setTargetWeight] = useState("");
  const [targetWaist, setTargetWaist] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [submittingGoal, setSubmittingGoal] = useState(false);

  // Add Photo modal state
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoViewType, setPhotoViewType] = useState<"FRONT" | "SIDE" | "BACK">("FRONT");
  const [shareWithTrainer, setShareWithTrainer] = useState(false);
  const [submittingPhoto, setSubmittingPhoto] = useState(false);

  const fetchProgress = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/v1/member/progress/measurements");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        if (json.data.goal) {
          setTargetWeight(json.data.goal.targetWeightKg ? String(json.data.goal.targetWeightKg) : "");
          setTargetWaist(json.data.goal.targetWaistCm ? String(json.data.goal.targetWaistCm) : "");
          setTargetDate(json.data.goal.targetDate ? json.data.goal.targetDate.split("T")[0] : "");
        }
      } else {
        setError(json.error || "Readings load nahi huin.");
      }

      // Fetch photos
      const photoRes = await apiFetch("/api/v1/member/progress/photos");
      const photoJson = await photoRes.json();
      if (photoJson.success) {
        setPhotos(photoJson.data || []);
      }
    } catch (err) {
      setError("Server connection error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [readCacheVersion]);

  const handleSaveMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingMeasurement(true);
    setMeasurementMsg(null);
    try {
      const res = await apiFetch("/api/v1/member/progress/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: entryDate,
          weightKg: weightKg ? parseFloat(weightKg) : undefined,
          waistCm: waistCm ? parseFloat(waistCm) : undefined,
          chestCm: chestCm ? parseFloat(chestCm) : undefined,
          hipsCm: hipsCm ? parseFloat(hipsCm) : undefined,
          armsCm: armsCm ? parseFloat(armsCm) : undefined,
          thighsCm: thighsCm ? parseFloat(thighsCm) : undefined,
          notes,
          sameDayChoice,
          confirmUnusual,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMeasurementMsg(json.message);
        fetchProgress();
        setTimeout(() => setShowAddModal(false), 1200);
      } else {
        setMeasurementMsg(`Masla: ${json.error}`);
      }
    } catch (err) {
      setMeasurementMsg("Server connection error.");
    } finally {
      setSubmittingMeasurement(false);
    }
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingGoal(true);
    try {
      const res = await apiFetch("/api/v1/member/progress/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetWeightKg: targetWeight,
          targetWaistCm: targetWaist,
          targetDate: targetDate || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchProgress();
        setShowGoalModal(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingGoal(false);
    }
  };

  const handleSavePhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoUrl) return;
    setSubmittingPhoto(true);
    try {
      const res = await apiFetch("/api/v1/member/progress/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoUrl,
          viewType: photoViewType,
          shareWithTrainer,
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchProgress();
        setShowPhotoModal(false);
        setPhotoUrl("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingPhoto(false);
    }
  };

  const handleDeletePhoto = async (id: string) => {
    try {
      const res = await apiFetch(`/api/v1/member/progress/photos/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        fetchProgress();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleShare = async (id: string, currentShare: boolean) => {
    try {
      const res = await apiFetch(`/api/v1/member/progress/photos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareWithTrainer: !currentShare }),
      });
      const json = await res.json();
      if (json.success) {
        fetchProgress();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !data) return <MemberLoadingLayout variant="progress" />;

  const { baseline, latest, comparison, goal, measurements = [] } = data || {};

  return (
    <div>
      {/* Top Banner & Quick Actions */}
      <div
        className="glass-panel"
        style={{
          padding: "20px 24px",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <span className="badge badge-accent" style={{ marginBottom: "6px" }}>Body Transformation Log</span>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>Progress Tracking & Metrics</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", margin: "4px 0 0" }}>
            Baseline se ab tak ke body measurements aur weight trends ka accurate jaiza.
          </p>
        </div>

        <div className={layoutStyles.sectionActions}>
          <button className="btn btn-secondary" onClick={() => setShowGoalModal(true)}>
            <Target size={15} /> Set Target Goal
          </button>
          <button className="btn btn-primary" onClick={() => { setShowAddModal(true); setMeasurementMsg(null); }}>
            <Plus size={15} /> Add Measurement
          </button>
        </div>
      </div>

      <div className={layoutStyles.connectedStack}><ProgressChart measurements={measurements} />
      {data?.metricSummary && <section className="glass-panel" style={{ padding: 20, marginBottom: 24 }}><h3>Weekly and monthly averages</h3>{Object.entries(data.metricSummary).map(([metric, raw]) => { const summary = raw as any; return <p key={metric}>{metric.replace(/(Kg|Cm)$/, "")} ({metric.endsWith("Kg") ? "kg" : "cm"}) · 7 days: {summary.week.average ?? "—"} ({summary.week.readingCount} readings) · 30 days: {summary.month.average ?? "—"} ({summary.month.readingCount} readings) · Last: {summary.latestDate ? new Date(summary.latestDate).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" }) : "—"}</p>; })}</section>}</div>
      {/* Target Goal Banner */}
      {goal && (
        <div
          className="glass-panel"
          style={{
            padding: "16px 20px",
            marginBottom: "24px",
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Target size={22} color="var(--accent-primary)" />
            <div>
              <div style={{ fontWeight: 600, color: "var(--text-bright)" }}>
                Active Target: {goal.targetWeightKg ? `${goal.targetWeightKg} kg Weight` : ""}
                {goal.targetWaistCm ? ` • ${goal.targetWaistCm} cm Waist` : ""}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                {goal.targetDate ? `Target Deadline: ${new Date(goal.targetDate).toLocaleDateString()}` : "Ongoing Fitness Journey"}
              </div>
            </div>
          </div>
          {latest?.weightKg && goal.targetWeightKg && (
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent-primary)" }}>
              {Math.abs(latest.weightKg - goal.targetWeightKg).toFixed(1)} kg remaining to goal
            </div>
          )}
        </div>
      )}

      {/* Comparison Overview Metrics (Baseline vs Latest) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        {/* Weight Card */}
        <div className="glass-panel" style={{ padding: "18px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "4px" }}>Body Weight</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-bright)" }}>
            {latest?.weightKg ? `${latest.weightKg} kg` : "—"}
          </div>
          {comparison?.weightChangeKg !== null && comparison?.weightChangeKg !== undefined ? (
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                marginTop: "6px",
                color: comparison.weightChangeKg < 0 ? "#34d399" : "#fbbf24",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {comparison.weightChangeKg < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
              {comparison.weightChangeKg > 0 ? `+${comparison.weightChangeKg}` : comparison.weightChangeKg} kg since baseline ({baseline?.weightKg || "—"} kg)
            </div>
          ) : (
            <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginTop: "6px" }}>Baseline reading</div>
          )}
        </div>

        {/* Waist Card */}
        <div className="glass-panel" style={{ padding: "18px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "4px" }}>Waist Circumference</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-bright)" }}>
            {latest?.waistCm ? `${latest.waistCm} cm` : "—"}
          </div>
          {comparison?.waistChangeCm !== null && comparison?.waistChangeCm !== undefined ? (
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                marginTop: "6px",
                color: comparison.waistChangeCm < 0 ? "#34d399" : "#fbbf24",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {comparison.waistChangeCm > 0 ? `+${comparison.waistChangeCm}` : comparison.waistChangeCm} cm since baseline ({baseline?.waistCm || "—"} cm)
            </div>
          ) : (
            <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginTop: "6px" }}>Baseline reading</div>
          )}
        </div>

        {/* Chest Card */}
        <div className="glass-panel" style={{ padding: "18px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "4px" }}>Chest</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-bright)" }}>
            {latest?.chestCm ? `${latest.chestCm} cm` : "—"}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginTop: "6px" }}>
            Baseline: {baseline?.chestCm ? `${baseline.chestCm} cm` : "—"}
          </div>
        </div>

        {/* Arms Card */}
        <div className="glass-panel" style={{ padding: "18px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "4px" }}>Arms</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-bright)" }}>
            {latest?.armsCm ? `${latest.armsCm} cm` : "—"}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginTop: "6px" }}>
            Baseline: {baseline?.armsCm ? `${baseline.armsCm} cm` : "—"}
          </div>
        </div>
      </div>

      {/* Measurement History Table */}
      <div className="glass-panel" style={{ padding: "24px", marginBottom: "32px" }}>
        <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "16px" }}>Measurement History Log</h3>

        {measurements.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-dim)" }}>
            <p style={{ margin: "0 0 12px" }}>Abhi tak koi progress reading record nahi hui.</p>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              Pehli (Baseline) Reading Record Karein
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "var(--text-dim)" }}>
                  <th style={{ padding: "10px", textAlign: "left" }}>Date</th>
                  <th style={{ padding: "10px", textAlign: "left" }}>Type</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>Weight</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>Waist</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>Chest</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>Arms</th>
                  <th style={{ padding: "10px", textAlign: "left" }}>Source</th>
                  <th style={{ padding: "10px", textAlign: "left" }}>Notes / Coach Feedback</th>
                </tr>
              </thead>
              <tbody>
                {measurements.map((m: any) => (
                  <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 10px", fontWeight: 600 }}>
                      {new Date(m.date).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "12px 10px" }}>
                      {m.isBaseline ? <span className="badge badge-accent">BASELINE</span> : <span className="badge">LOG</span>}
                    </td>
                    <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: 700 }}>
                      {m.weightKg ? `${m.weightKg} kg` : "—"}
                    </td>
                    <td style={{ padding: "12px 10px", textAlign: "right" }}>
                      {m.waistCm ? `${m.waistCm} cm` : "—"}
                    </td>
                    <td style={{ padding: "12px 10px", textAlign: "right" }}>
                      {m.chestCm ? `${m.chestCm} cm` : "—"}
                    </td>
                    <td style={{ padding: "12px 10px", textAlign: "right" }}>
                      {m.armsCm ? `${m.armsCm} cm` : "—"}
                    </td>
                    <td style={{ padding: "12px 10px", fontSize: "0.75rem", color: "var(--text-dim)" }}>
                      {m.source}
                    </td>
                    <td style={{ padding: "12px 10px", fontSize: "0.8rem", color: "var(--text-dim)" }}>
                      {m.trainerFeedback ? (
                        <span style={{ color: "var(--accent-primary)" }}>Coach: {m.trainerFeedback}</span>
                      ) : (
                        m.notes || "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProgressSharing />
      {/* Progress Photos Gallery (Spec: Default Member-Only with Privacy Opt-in) */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 600, margin: 0 }}>Progress Photos (Private & Protected)</h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", margin: "4px 0 0" }}>
              Photos default taur par sirf aapke liye private hain. Coach ke sath sharing mukammal taur par optional hai.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => setShowPhotoModal(true)}>
            <Camera size={15} /> Add Photo
          </button>
        </div>

        {photos.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-dim)" }}>
            <Camera size={36} style={{ margin: "0 auto 10px", opacity: 0.4 }} />
            <p style={{ fontSize: "0.85rem", margin: 0 }}>Koi progress photo upload nahi ki gayi.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 180px), 1fr))", gap: "16px" }}>
            {photos.map((p) => (
              <div
                key={p.id}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: "10px",
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ height: "180px", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img src={p.photoUrl} alt="Progress" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ padding: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span className="badge badge-accent" style={{ fontSize: "0.7rem" }}>{p.viewType}</span>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
                      {new Date(p.date).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <button
                      onClick={() => handleToggleShare(p.id, p.shareWithTrainer)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: p.shareWithTrainer ? "var(--accent-primary)" : "var(--text-dim)",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title={p.shareWithTrainer ? "Shared with Coach" : "Private (Coach cannot see)"}
                    >
                      {p.shareWithTrainer ? <Unlock size={13} /> : <Lock size={13} />}
                      {p.shareWithTrainer ? "Shared" : "Private"}
                    </button>

                    <button
                      onClick={() => handleDeletePhoto(p.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#f87171",
                        cursor: "pointer",
                        padding: "4px",
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: Add Measurement Entry                            */}
      {/* ========================================================= */}
      {showAddModal && (
        <ModalOverlay className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: "560px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Record Body Measurement</h3>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)} style={{ padding: "6px" }}>
                <X size={18} />
              </button>
            </div>

            {measurementMsg && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  marginBottom: "16px",
                  background: measurementMsg.includes("Masla") ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                  color: measurementMsg.includes("Masla") ? "#f87171" : "#34d399",
                }}
              >
                {measurementMsg}
              </div>
            )}

            <form onSubmit={handleSaveMeasurement} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <label className="field-label">If a reading already exists on this date<select className="input-field" value={sameDayChoice} onChange={e => setSameDayChoice(e.target.value)}><option value="">Ask before saving</option><option value="EDIT">Edit existing reading</option><option value="SEPARATE">Record separate reading</option></select></label>
              <label><input type="checkbox" checked={confirmUnusual} onChange={e => setConfirmUnusual(e.target.checked)} /> I checked any unusual measurement changes</label>
              <div>
                <label className="field-label">Measurement Date *</label>
                <input
                  type="date"
                  className="input-field"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  required
                />
              </div>

              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="field-label">Weight (Kilograms)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="input-field"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="e.g. 74.5"
                  />
                </div>
                <div>
                  <label className="field-label">Waist (Centimetres)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="input-field"
                    value={waistCm}
                    onChange={(e) => setWaistCm(e.target.value)}
                    placeholder="e.g. 88.0"
                  />
                </div>
              </div>

              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="field-label">Chest (Centimetres)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="input-field"
                    value={chestCm}
                    onChange={(e) => setChestCm(e.target.value)}
                    placeholder="e.g. 102.0"
                  />
                </div>
                <div>
                  <label className="field-label">Hips (Centimetres)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="input-field"
                    value={hipsCm}
                    onChange={(e) => setHipsCm(e.target.value)}
                    placeholder="e.g. 98.0"
                  />
                </div>
              </div>

              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="field-label">Arms (Centimetres)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="input-field"
                    value={armsCm}
                    onChange={(e) => setArmsCm(e.target.value)}
                    placeholder="e.g. 36.5"
                  />
                </div>
                <div>
                  <label className="field-label">Thighs (Centimetres)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="input-field"
                    value={thighsCm}
                    onChange={(e) => setThighsCm(e.target.value)}
                    placeholder="e.g. 56.0"
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Personal Notes (Context e.g. morning fasted)</label>
                <input
                  type="text"
                  className="input-field"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Morning empty stomach reading"
                />
              </div>

              <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", lineHeight: 1.4, margin: 0 }}>
                * Same date ki entry dobara enter karne par previous reading safely update ho jayegi taake duplicate entries na banein.
              </p>

              <button type="submit" className="btn btn-primary" disabled={submittingMeasurement} style={{ justifyContent: "center" }}>
                {submittingMeasurement ? "Saving..." : "Save Measurement"}
              </button>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: Set Target Goal                                  */}
      {/* ========================================================= */}
      {showGoalModal && (
        <ModalOverlay className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: "480px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Set Transformation Target</h3>
              <button className="btn btn-secondary" onClick={() => setShowGoalModal(false)} style={{ padding: "6px" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="field-label">Target Weight (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  className="input-field"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  placeholder="e.g. 70.0"
                />
              </div>
              <div>
                <label className="field-label">Target Waist (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  className="input-field"
                  value={targetWaist}
                  onChange={(e) => setTargetWaist(e.target.value)}
                  placeholder="e.g. 82.0"
                />
              </div>
              <div>
                <label className="field-label">Target Completion Date (Optional)</label>
                <input
                  type="date"
                  className="input-field"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={submittingGoal} style={{ justifyContent: "center" }}>
                {submittingGoal ? "Setting..." : "Set Target Goal"}
              </button>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: Add Progress Photo                               */}
      {/* ========================================================= */}
      {showPhotoModal && (
        <ModalOverlay className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: "480px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Upload Progress Photo</h3>
              <button className="btn btn-secondary" onClick={() => setShowPhotoModal(false)} style={{ padding: "6px" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePhoto} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="field-label">Photo View Type *</label>
                <select
                  className="input-field"
                  value={photoViewType}
                  onChange={(e: any) => setPhotoViewType(e.target.value)}
                >
                  <option value="FRONT">Front View</option>
                  <option value="SIDE">Side View</option>
                  <option value="BACK">Back View</option>
                </select>
              </div>

              <div>
                <label className="field-label">Progress Photo *</label>
                <div style={{ marginBottom: "8px" }}>
                  <CloudinaryUploadButton
                    folder="progress"
                    currentUrl={photoUrl}
                    onUploadSuccess={(data) => setPhotoUrl(data.url)}
                    label="Upload Progress Photo"
                  />
                </div>
                {!photoUrl && <p>Upload a photo before saving.</p>}
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={shareWithTrainer}
                    onChange={(e) => setShareWithTrainer(e.target.checked)}
                  />
                  Share this photo with my assigned Coach
                </label>
                <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", display: "block", marginTop: "4px" }}>
                  * Default taur par photos private hoti hain. Uncheck rakhne par coach access nahi kar sakega.
                </span>
              </div>

              <button type="submit" className="btn btn-primary" disabled={submittingPhoto} style={{ justifyContent: "center" }}>
                {submittingPhoto ? "Saving..." : "Save Progress Photo"}
              </button>
            </form>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
