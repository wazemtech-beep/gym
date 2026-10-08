"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Calendar,
  Camera,
  X,
  MessageSquare,
  Shield,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Lock,
} from "lucide-react";

interface TrainerProgressReviewModalProps {
  memberItem: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TrainerProgressReviewModal({
  memberItem,
  onClose,
  onSuccess,
}: TrainerProgressReviewModalProps) {
  const readCacheVersion = useReadCacheVersion();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchProgress = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/v1/trainer/members/${memberItem.member.id}/progress`);
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json.data);
      } else { setData(null); setMsg(json.error || "Progress sharing is unavailable."); }
    } catch (err) {
      setData(null);
      setMsg("Progress access could not be confirmed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProgress();
    const refresh = () => { if (document.visibilityState === "visible") void fetchProgress(); else setData(null); };
    const timer = window.setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [memberItem.member.id, readCacheVersion]);

  const handleSubmitFeedback = async () => {
    if (!selectedMeasurementId || !feedbackText.trim()) return;
    setSubmittingFeedback(true);
    setMsg(null);
    try {
      const res = await apiFetch(`/api/v1/trainer/members/${memberItem.member.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          measurementId: selectedMeasurementId,
          feedback: feedbackText,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMsg("Coaching feedback submit ho gaya!");
        fetchProgress();
        setFeedbackText("");
      } else {
        setMsg(`Masla: ${json.error}`);
      }
    } catch (err) {
      setMsg("Feedback submit karne mein error.");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return (
      <ModalOverlay className="modal-overlay">
        <div className="modal-content glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>
          <RefreshCw className="animate-spin" size={24} style={{ margin: "0 auto 12px" }} />
          <p>Member progress load ho rahi hai...</p>
        </div>
      </ModalOverlay>
    );
  }

  const { consentGranted, baseline, latest, comparison, goal, measurements = [], photos = [] } = data || {};

  return (
    <ModalOverlay className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: "780px", maxHeight: "90vh", overflowY: "auto", padding: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Member Progress Review</h3>
            <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
              {memberItem.member.fullName} ({memberItem.member.memberId})
            </span>
          </div>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: "6px" }}>
            <X size={18} />
          </button>
        </div>

        {/* Privacy Consent Check */}
        {!consentGranted ? (
          <div style={{ padding: "32px", textAlign: "center", background: "rgba(239,68,68,0.1)", borderRadius: "10px", color: "#f87171" }}>
            <Lock size={36} style={{ margin: "0 auto 12px" }} />
            <h4 style={{ margin: "0 0 6px" }}>Measurement Sharing Consent Required</h4>
            <p style={{ fontSize: "0.85rem", margin: 0, color: "var(--text-dim)" }}>
              Member ne trainer ke sath private measurements aur photos share karne ka consent nahi diya hai.
            </p>
          </div>
        ) : (
          <div>
            {/* Metric Comparisons */}
            <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "14px", borderRadius: "10px" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Current Weight</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
                  {latest?.weightKg ? `${latest.weightKg} kg` : "—"}
                </div>
                {comparison?.weightChangeKg !== null && comparison?.weightChangeKg !== undefined && (
                  <div style={{ fontSize: "0.75rem", color: comparison.weightChangeKg < 0 ? "#34d399" : "#fbbf24", marginTop: "4px" }}>
                    {comparison.weightChangeKg > 0 ? `+${comparison.weightChangeKg}` : comparison.weightChangeKg} kg since baseline ({baseline?.weightKg || "—"} kg)
                  </div>
                )}
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "14px", borderRadius: "10px" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Current Waist</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
                  {latest?.waistCm ? `${latest.waistCm} cm` : "—"}
                </div>
                {comparison?.waistChangeCm !== null && comparison?.waistChangeCm !== undefined && (
                  <div style={{ fontSize: "0.75rem", color: comparison.waistChangeCm < 0 ? "#34d399" : "#fbbf24", marginTop: "4px" }}>
                    {comparison.waistChangeCm > 0 ? `+${comparison.waistChangeCm}` : comparison.waistChangeCm} cm since baseline ({baseline?.waistCm || "—"} cm)
                  </div>
                )}
              </div>
            </div>

            {/* Measurements Table */}
            <div style={{ marginBottom: "20px" }}>
              <label className="field-label">Dated Measurement Entries</label>
              <div style={{ overflowX: "auto", maxHeight: "200px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "var(--text-dim)" }}>
                      <th style={{ padding: "8px", textAlign: "left" }}>Date</th>
                      <th style={{ padding: "8px", textAlign: "right" }}>Weight</th>
                      <th style={{ padding: "8px", textAlign: "right" }}>Waist</th>
                      <th style={{ padding: "8px", textAlign: "right" }}>Chest</th>
                      <th style={{ padding: "8px", textAlign: "left" }}>Feedback</th>
                      <th style={{ padding: "8px", textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {measurements.map((m: any) => (
                      <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "8px" }}>{new Date(m.date).toLocaleDateString()}</td>
                        <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>{m.weightKg ? `${m.weightKg} kg` : "—"}</td>
                        <td style={{ padding: "8px", textAlign: "right" }}>{m.waistCm ? `${m.waistCm} cm` : "—"}</td>
                        <td style={{ padding: "8px", textAlign: "right" }}>{m.chestCm ? `${m.chestCm} cm` : "—"}</td>
                        <td style={{ padding: "8px", color: "var(--accent-primary)" }}>{m.trainerFeedback || "—"}</td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              setSelectedMeasurementId(m.id);
                              setFeedbackText(m.trainerFeedback || "");
                            }}
                            style={{ padding: "2px 8px", fontSize: "0.7rem" }}
                          >
                            Feedback
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Feedback Input Box */}
            {selectedMeasurementId && (
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "14px", borderRadius: "10px", marginBottom: "20px" }}>
                <label className="field-label">Coaching Feedback for Selected Reading</label>
                {msg && (
                  <div style={{ padding: "6px 10px", borderRadius: "6px", fontSize: "0.8rem", marginBottom: "8px", background: "rgba(16,185,129,0.2)", color: "#34d399" }}>
                    {msg}
                  </div>
                )}
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    type="text"
                    className="input-field"
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="e.g. Great waist reduction! Keep deficit steady."
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleSubmitFeedback}
                    disabled={submittingFeedback}
                  >
                    Submit
                  </button>
                </div>
              </div>
            )}

            {/* Shared Progress Photos Gallery */}
            {photos.length > 0 && (
              <div>
                <label className="field-label">Shared Progress Photos ({photos.length})</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))", gap: "12px" }}>
                  {photos.map((p: any) => (
                    <div key={p.id} style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <img src={p.photoUrl} alt="Progress" style={{ width: "100%", height: "140px", objectFit: "cover" }} />
                      <div style={{ padding: "6px", fontSize: "0.7rem", textAlign: "center", background: "rgba(0,0,0,0.5)" }}>
                        {p.viewType} • {new Date(p.date).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}
