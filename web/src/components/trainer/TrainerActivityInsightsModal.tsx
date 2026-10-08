"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import {
  X,
  Smartphone,
  Shield,
  Footprints,
  Compass,
  Flame,
  Dumbbell,
  RefreshCw,
  Clock,
  AlertTriangle,
  Lock,
  ArrowRight,
  TrendingUp,
  Calendar,
  MessageSquare,
  CheckCircle2,
  FileText,
  AlertCircle,
  Eye,
  Send,
} from "lucide-react";

interface TrainerActivityInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  onOpenWorkoutPlan?: () => void;
  onOpenDietPlan?: () => void;
}

export default function TrainerActivityInsightsModal({
  isOpen,
  onClose,
  memberId,
  memberName,
  onOpenWorkoutPlan,
  onOpenDietPlan,
}: TrainerActivityInsightsModalProps) {
  const readCacheVersion = useReadCacheVersion();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharingDisabled, setSharingDisabled] = useState(false);
  const [coachReassigned, setCoachReassigned] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [requestSentMessage, setRequestSentMessage] = useState<string | null>(null);

  // Observation form state
  const [observationText, setObservationText] = useState("");
  const [memberFeedbackText, setMemberFeedbackText] = useState("");
  const [suggestedAction, setSuggestedAction] = useState("PLAN_ADJUSTMENT");
  const [memberFacingNote, setMemberFacingNote] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    setSharingDisabled(false);
    setCoachReassigned(false);
    try {
      const res = await apiFetch(`/api/v1/trainer/members/${memberId}/insights`);
      const json = await res.json();
      if (res.status === 403) {
        if (json.sharingDisabled) {
          setSharingDisabled(true);
        } else if (json.coachReassigned) {
          setCoachReassigned(true);
        } else {
          setError(json.error || "Access denied.");
        }
        setData(null);
      } else if (!json.success) {
        setError(json.error || "Insights load nahi huin.");
        setData(null);
      } else {
        setData(json.data);
      }
    } catch (err: any) {
      setData(null);
      setError(err.message || "Failed to load insights.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && memberId) {
      fetchInsights();
    }
  }, [isOpen, memberId, readCacheVersion]);

  useEffect(() => {
    if (!isOpen || !memberId) return;
    const refresh = () => { if (document.visibilityState === "visible") fetchInsights(); else setData(null); };
    const interval = setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, [isOpen, memberId, readCacheVersion]);

  if (!isOpen) return null;

  const handleRequestAccess = async () => {
    setRequestingAccess(true);
    try {
      const res = await apiFetch(`/api/v1/trainer/members/${memberId}/insights/request-access`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setRequestSentMessage(json.message);
      } else {
        alert(json.error || "Request fail ho gayi.");
      }
    } finally {
      setRequestingAccess(false);
    }
  };

  const handleSaveObservation = async () => {
    if (!observationText.trim()) {
      alert("Observation note likhna zaroori hai.");
      return;
    }
    setSavingReview(true);
    setReviewMessage(null);
    try {
      const res = await apiFetch(`/api/v1/trainer/members/${memberId}/insights/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observation: observationText,
          memberFeedback: memberFeedbackText || null,
          suggestedAction,
          memberFacingNote: memberFacingNote || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setReviewMessage("Observation kamyabi se save ho gayi.");
        setObservationText("");
        setMemberFacingNote("");
        fetchInsights();
      } else {
        alert(json.error || "Save fail ho gaya.");
      }
    } finally {
      setSavingReview(false);
    }
  };

  const comparison = data?.comparison;
  const currentWeek = comparison?.currentWeek;
  const previousWeek = comparison?.previousWeek;
  const assignedWorkouts = data?.assignedWorkoutSessions || [];
  const syncedWorkouts = currentWeek?.workouts || [];
  const pastReviews = data?.pastReviews || [];

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
          maxWidth: "840px",
          maxHeight: "92vh",
          overflowY: "auto",
          color: "var(--text-main)",
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
            <Smartphone className="text-orange-500" size={24} />
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>
                Activity Insights & Trends — {memberName}
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Comparative weekly trends, workout adherence & coaching observations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "24px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-secondary)" }}>
              <RefreshCw className="animate-spin" size={28} style={{ margin: "0 auto 12px" }} />
              <div>Member activity insights load ho rahi hain...</div>
            </div>
          ) : sharingDisabled ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                backgroundColor: "rgba(239, 68, 68, 0.05)",
                border: "1px dashed rgba(239, 68, 68, 0.3)",
                borderRadius: "12px",
              }}
            >
              <Lock size={36} className="text-red-400" style={{ margin: "0 auto 12px" }} />
              <h4 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "8px" }}>
                Fitness Sharing Off Hai
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "440px", margin: "0 auto 16px" }}>
                Member ne apna fitness data trainer ke sath share nahi kiya. Aap member se sharing request kar sakte hain. Member khud approve karega.
              </p>
              {requestSentMessage ? (
                <div style={{ color: "var(--accent-primary)", fontSize: "0.85rem", fontWeight: 600 }}>
                  <CheckCircle2 size={16} style={{ display: "inline", marginRight: "6px" }} />
                  {requestSentMessage}
                </div>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={handleRequestAccess}
                  disabled={requestingAccess}
                  style={{ padding: "8px 18px", fontSize: "0.85rem" }}
                >
                  <Send size={14} /> {requestingAccess ? "Sending Request..." : "Request Access From Member"}
                </button>
              )}
            </div>
          ) : coachReassigned ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                backgroundColor: "rgba(245, 158, 11, 0.05)",
                border: "1px dashed rgba(245, 158, 11, 0.3)",
                borderRadius: "12px",
              }}
            >
              <AlertTriangle size={36} className="text-amber-400" style={{ margin: "0 auto 12px" }} />
              <h4 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "8px" }}>
                Fresh Member Confirmation Darkaar Hai
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "460px", margin: "0 auto" }}>
                Trainer assignment tabdeel hui hai. Naye coach ke sath data share karne ke liye member ko apni OXGEN privacy screen se confirmation deni hogi.
              </p>
            </div>
          ) : error ? (
            <div
              style={{
                padding: "16px",
                borderRadius: "10px",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                color: "var(--danger)",
              }}
            >
              {error}
            </div>
          ) : (
            <div>
              {/* SECTION 1: WEEKLY COMPARISON TABLE (Point 3) */}
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <h4 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                    <TrendingUp size={18} className="text-orange-400" />
                    Weekly Comparative Trends
                  </h4>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    Last 7 Days vs Prior 7 Days
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: "1px solid var(--border-medium)",
                  }}
                >
                  <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                    <thead>
                      <tr style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border-medium)", textAlign: "left" }}>
                        <th style={{ padding: "10px 16px", color: "var(--text-secondary)" }}>Metric</th>
                        <th style={{ padding: "10px 16px", color: "var(--text-secondary)" }}>Previous Week</th>
                        <th style={{ padding: "10px 16px", color: "var(--text-secondary)" }}>Current Week</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid var(--border-medium)" }}>
                        <td style={{ padding: "10px 16px", fontWeight: 600 }}>Steps per available day</td>
                        <td style={{ padding: "10px 16px" }}>
                          {previousWeek?.aggregates?.stepsPerAvailableDay
                            ? `${previousWeek.aggregates.stepsPerAvailableDay.toLocaleString()} steps`
                            : "No data"}
                        </td>
                        <td style={{ padding: "10px 16px", color: "var(--accent-primary)", fontWeight: 700 }}>
                          {currentWeek?.aggregates?.stepsPerAvailableDay
                            ? `${currentWeek.aggregates.stepsPerAvailableDay.toLocaleString()} steps`
                            : "No data"}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid var(--border-medium)" }}>
                        <td style={{ padding: "10px 16px", fontWeight: 600 }}>Days with steps data</td>
                        <td style={{ padding: "10px 16px" }}>{previousWeek?.aggregates?.daysWithStepsData || "0/7"}</td>
                        <td style={{ padding: "10px 16px", fontWeight: 600 }}>{currentWeek?.aggregates?.daysWithStepsData || "0/7"}</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid var(--border-medium)" }}>
                        <td style={{ padding: "10px 16px", fontWeight: 600 }}>Recorded workouts</td>
                        <td style={{ padding: "10px 16px" }}>{previousWeek?.aggregates?.recordedWorkoutsCount || 0}</td>
                        <td style={{ padding: "10px 16px", fontWeight: 600 }}>{currentWeek?.aggregates?.recordedWorkoutsCount || 0}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "10px 16px", fontWeight: 600 }}>Recorded workout duration</td>
                        <td style={{ padding: "10px 16px" }}>{previousWeek?.aggregates?.recordedWorkoutDurationMinutes || 0} min</td>
                        <td style={{ padding: "10px 16px", fontWeight: 600 }}>{currentWeek?.aggregates?.recordedWorkoutDurationMinutes || 0} min</td>
                      </tr>
                    </tbody>
                  </table></div>
                </div>

                <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                  * Trainer Note: Coverage saath dikhayi gayi hai. Kam dinon ke data ko pura 7-day record samajh kar conclusion na nikaalein. Missing records par “No data” dikhta hai; member inactive tha ya lazy tha yeh assume nahi kiya gaya.
                </p>
              </div>

              {/* SECTION 2: SYNCED EXERCISES VS ASSIGNED GYM WORKOUTS (Point 1) */}
              <div className="responsive-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "14px",
                  marginBottom: "24px",
                }}
              >
                {/* Synced Exercise Sessions */}
                <div
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderRadius: "10px",
                    padding: "16px",
                    border: "1px solid var(--border-medium)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <Smartphone size={16} className="text-orange-400" />
                    <h5 style={{ fontSize: "0.9rem", fontWeight: 600, margin: 0 }}>
                      Synced Exercises ({syncedWorkouts.length})
                    </h5>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "8px" }}>
                    Device / Health Connect records (smartwatch / phone)
                  </div>
                  {syncedWorkouts.length === 0 ? (
                    <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Koi synced exercise nahi mili.</div>
                  ) : (
                    <div style={{ display: "grid", gap: "6px", maxHeight: "140px", overflowY: "auto" }}>
                      {syncedWorkouts.map((w: any) => (
                        <div
                          key={w.id}
                          style={{
                            padding: "6px 10px",
                            backgroundColor: "var(--bg-surface)",
                            borderRadius: "6px",
                            fontSize: "0.78rem",
                          }}
                        >
                          <strong>{w.title || w.exerciseType}</strong> · {w.durationMinutes}m
                          <span style={{ float: "right", color: "var(--text-secondary)" }}>
                            {new Date(w.startTime).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Assigned Gym Workouts */}
                <div
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderRadius: "10px",
                    padding: "16px",
                    border: "1px solid var(--border-medium)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <Dumbbell size={16} className="text-emerald-400" />
                    <h5 style={{ fontSize: "0.9rem", fontWeight: 600, margin: 0 }}>
                      Assigned Gym Sessions ({assignedWorkouts.length})
                    </h5>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "8px" }}>
                    Member-reported gym plan completion (separate from device)
                  </div>
                  {assignedWorkouts.length === 0 ? (
                    <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Koi gym session log nahi hua.</div>
                  ) : (
                    <div style={{ display: "grid", gap: "6px", maxHeight: "140px", overflowY: "auto" }}>
                      {assignedWorkouts.map((s: any) => (
                        <div
                          key={s.id}
                          style={{
                            padding: "6px 10px",
                            backgroundColor: "var(--bg-surface)",
                            borderRadius: "6px",
                            fontSize: "0.78rem",
                          }}
                        >
                          <strong>{s.title}</strong> · Status: <span style={{ color: "var(--accent-primary)" }}>{s.status}</span>
                          <span style={{ float: "right", color: "var(--text-secondary)" }}>
                            {new Date(s.sessionDate).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 3: COACHING OBSERVATION & PLAN ADJUSTMENT FORM (Point 4 & 5) */}
              <div
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  borderRadius: "12px",
                  padding: "20px",
                  border: "1px solid var(--border-medium)",
                  marginBottom: "20px",
                }}
              >
                <h4 style={{ fontSize: "0.98rem", fontWeight: 700, margin: "0 0 14px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <FileText size={18} className="text-blue-400" />
                  Trainer Observation & Plan Adjustments
                </h4>

                {reviewMessage && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(34, 197, 94, 0.15)",
                      color: "var(--accent-primary)",
                      fontSize: "0.82rem",
                      marginBottom: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <CheckCircle2 size={16} /> {reviewMessage}
                  </div>
                )}

                <div style={{ display: "grid", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                      Internal Coaching Observation / Written Assessment *
                    </label>
                    <textarea
                      value={observationText}
                      onChange={(e) => setObservationText(e.target.value)}
                      rows={3}
                      placeholder="e.g. Member daily walking step target achhe se achieve kar raha hai, par recovery check darkaar hai..."
                      style={{
                        width: "100%",
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-medium)",
                        borderRadius: "8px",
                        color: "var(--text-main)",
                        padding: "10px",
                        fontSize: "0.85rem",
                      }}
                    />
                  </div>

                  <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                        Member Feedback Context
                      </label>
                      <input
                        type="text"
                        value={memberFeedbackText}
                        onChange={(e) => setMemberFeedbackText(e.target.value)}
                        placeholder="e.g. Member reported fatigue on Wednesday"
                        style={{
                          width: "100%",
                          backgroundColor: "var(--bg-surface)",
                          border: "1px solid var(--border-medium)",
                          borderRadius: "8px",
                          color: "var(--text-main)",
                          padding: "8px 12px",
                          fontSize: "0.82rem",
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                        Suggested Action
                      </label>
                      <select
                        value={suggestedAction}
                        onChange={(e) => setSuggestedAction(e.target.value)}
                        style={{
                          width: "100%",
                          backgroundColor: "var(--bg-surface)",
                          border: "1px solid var(--border-medium)",
                          borderRadius: "8px",
                          color: "var(--text-main)",
                          padding: "8px 12px",
                          fontSize: "0.82rem",
                        }}
                      >
                        <option value="PLAN_ADJUSTMENT">Update Workout / Diet Plan Version</option>
                        <option value="FOLLOW_UP">Follow Up in Next Session</option>
                        <option value="REST_DAY">Recommend Extra Rest / Deload</option>
                        <option value="CONSISTENCY_CHECK">Consistency Monitoring</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                      Member-Facing Guidance Note (Optional — visible to member in app)
                    </label>
                    <input
                      type="text"
                      value={memberFacingNote}
                      onChange={(e) => setMemberFacingNote(e.target.value)}
                      placeholder="e.g. Great daily activity this week! Hydration maintain karein aur Friday session light rakhein."
                      style={{
                        width: "100%",
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-medium)",
                        borderRadius: "8px",
                        color: "var(--text-main)",
                        padding: "8px 12px",
                        fontSize: "0.82rem",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "10px", marginTop: "6px", flexWrap: "wrap" }}>
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveObservation}
                      disabled={savingReview}
                      style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                    >
                      {savingReview ? "Saving..." : "Save Coaching Observation"}
                    </button>
                    {onOpenWorkoutPlan && (
                      <button
                        className="btn btn-secondary"
                        onClick={onOpenWorkoutPlan}
                        style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                      >
                        <Dumbbell size={14} /> Adjust Workout Plan
                      </button>
                    )}
                    {onOpenDietPlan && (
                      <button
                        className="btn btn-secondary"
                        onClick={onOpenDietPlan}
                        style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                      >
                        Adjust Diet Plan
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 4: PAST COACHING REVIEWS HISTORY */}
              {pastReviews.length > 0 && (
                <div>
                  <h5 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "8px", color: "var(--text-secondary)" }}>
                    Past Coaching Reviews ({pastReviews.length})
                  </h5>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {pastReviews.map((r: any) => (
                      <div
                        key={r.id}
                        style={{
                          padding: "10px 14px",
                          backgroundColor: "var(--bg-secondary)",
                          borderRadius: "8px",
                          fontSize: "0.8rem",
                          border: "1px solid var(--border-medium)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <strong>{r.observation}</strong>
                          <span style={{ color: "var(--text-secondary)" }}>
                            {new Date(r.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                        {r.memberFacingNote && (
                          <div style={{ color: "var(--blue-primary)", fontSize: "0.76rem" }}>
                            Guidance to member: “{r.memberFacingNote}”
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
