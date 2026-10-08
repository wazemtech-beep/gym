"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import ExerciseDetailsFields from "./ExerciseDetailsFields";
import React, { useState, useEffect } from "react";
import {
  Users,
  Dumbbell,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Edit3,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  X,
  Trash2,
  Save,
  Send,
  Eye,
  Flame,
  Utensils,
  Activity,
  Smartphone,
} from "lucide-react";
import TrainerDietBuilderModal from "./TrainerDietBuilderModal";
import TrainerProgressReviewModal from "./TrainerProgressReviewModal";
import TrainerFitnessViewModal from "./TrainerFitnessViewModal";
import TrainerActivityInsightsModal from "./TrainerActivityInsightsModal";

interface AssignedMemberItem {
  assignmentId: string;
  startDate: string;
  coachingFocus: string;
  consentMeasurements: boolean;
  consentHealthActivity: boolean;
  member: {
    id: string;
    memberId: string;
    fullName: string;
    phone: string;
    email: string | null;
    photoUrl: string | null;
    fitnessGoal: string | null;
    limitations: string | null;
    joiningDate: string;
    activePlan: {
      id: string;
      title: string;
      goal: string;
      version: number;
      weeklySchedule: string | null;
      status: string;
    } | null;
    recentSessions: Array<{
      id: string;
      sessionDate: string;
      status: string;
      durationMinutes: number | null;
      trainerFeedback: string | null;
      reviewedAt: string | null;
    }>;
  };
}

export default function TrainerDashboardClient() {
  const readCacheVersion = useReadCacheVersion();
  const [members, setMembers] = useState<AssignedMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [selectedMember, setSelectedMember] = useState<AssignedMemberItem | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showDietModal, setShowDietModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showFitnessModal, setShowFitnessModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeSessionReview, setActiveSessionReview] = useState<any | null>(null);

  // Plan builder state
  const [planTitle, setPlanTitle] = useState("Beginner Strength & Conditioning");
  const [planGoal, setPlanGoal] = useState("General strength & hypertrophy");
  const [weeklySchedule, setWeeklySchedule] = useState("Monday, Wednesday, Friday");
  const [planNotes, setPlanNotes] = useState("");
  const [workoutDays, setWorkoutDays] = useState<any[]>([
    {
      title: "Upper Body Day",
      dayOfWeek: "MONDAY",
      exercises: [
        {
          name: "Dumbbell Bench Press",
          type: "STRENGTH",
          sets: 3,
          reps: "10-12",
          targetLoad: "15 kg",
          restSeconds: 60,
          instructions: "Keep elbows at 45 degree angle. Controlled eccentric.",
          alternativeExercise: "Push-ups",
        },
        {
          name: "Lat Pulldown",
          type: "STRENGTH",
          sets: 3,
          reps: "10",
          targetLoad: "35 kg",
          restSeconds: 60,
          instructions: "Pull to upper chest, squeeze scapula.",
          alternativeExercise: "Band Assisted Pull-ups",
        },
      ],
    },
    {
      title: "Lower Body Day",
      dayOfWeek: "WEDNESDAY",
      exercises: [
        {
          name: "Goblet Squats",
          type: "STRENGTH",
          sets: 3,
          reps: "12",
          targetLoad: "20 kg",
          restSeconds: 60,
          instructions: "Drive through heels, keep chest proud.",
          alternativeExercise: "Bodyweight Air Squats",
        },
      ],
    },
  ]);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planStatusMessage, setPlanStatusMessage] = useState<string | null>(null);

  // Session feedback state
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const fetchAssignedMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/v1/trainer/members");
      const json = await res.json();
      if (json.success) {
        setMembers(json.data || []);
      } else {
        setError(json.error || "Assigned members load nahi huay.");
      }
    } catch (err) {
      setError("Server connection masla.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedMembers();
  }, [readCacheVersion]);

  const handleOpenPlanBuilder = (item: AssignedMemberItem) => {
    setSelectedMember(item);
    setPlanTitle(item.member.activePlan ? `${item.member.activePlan.title} (Updated)` : "Custom Workout Programme");
    setPlanGoal(item.coachingFocus || item.member.fitnessGoal || "Strength & Fitness");
    setShowPlanModal(true);
    setPlanStatusMessage(null);
  };

  const handleSavePlan = async (status: "DRAFT" | "PUBLISHED") => {
    if (!selectedMember) return;
    setSavingPlan(true);
    setPlanStatusMessage(null);
    try {
      const res = await apiFetch(`/api/v1/trainer/members/${selectedMember.member.id}/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: planTitle,
          goal: planGoal,
          weeklySchedule,
          notes: planNotes,
          status,
          workoutDays,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setPlanStatusMessage(
          status === "PUBLISHED"
            ? "Workout plan kamyabi se publish ho gaya aur member dashboard par live hai!"
            : "Workout plan draft save ho gaya."
        );
        fetchAssignedMembers();
      } else {
        setPlanStatusMessage(`Masla: ${json.error}`);
      }
    } catch (err) {
      setPlanStatusMessage("Plan save karne mein server error.");
    } finally {
      setSavingPlan(false);
    }
  };

  const handleOpenReview = async (session: any, memberItem: AssignedMemberItem) => {
    setSelectedMember(memberItem);
    setActiveSessionReview(session);
    setFeedbackText(session.trainerFeedback || "");
    setShowReviewModal(true);
    setFeedbackMessage(null);
  };

  const handleSubmitFeedback = async () => {
    if (!activeSessionReview || !feedbackText.trim()) return;
    setSubmittingFeedback(true);
    setFeedbackMessage(null);
    try {
      const res = await apiFetch(`/api/v1/trainer/workouts/${activeSessionReview.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: feedbackText,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackMessage("Feedback submit ho gaya aur member ke dashboard par live hai.");
        fetchAssignedMembers();
      } else {
        setFeedbackMessage(`Masla: ${json.error}`);
      }
    } catch (err) {
      setFeedbackMessage("Server error.");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-dim)" }}>
        <RefreshCw className="animate-spin" size={32} style={{ margin: "0 auto 16px" }} />
        <p>Trainer panel load ho raha hai...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Top Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginBottom: "6px" }}>Total Assigned Members</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--purple-primary)" }}>{members.length}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "4px" }}>Active personal coaching</div>
        </div>

        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginBottom: "6px" }}>Active Published Plans</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--accent-primary)" }}>
            {members.filter((m) => m.member.activePlan).length}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "4px" }}>Members with active routines</div>
        </div>

        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginBottom: "6px" }}>Privacy Shield</div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
            <span className="badge badge-accent">Enforced</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "8px" }}>
            Financial & unauthorized records strictly protected
          </div>
        </div>
      </div>

      {/* Assigned Members Grid */}
      <div className="glass-panel" style={{ padding: "24px", marginBottom: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 600 }}>My Assigned Members</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", margin: "4px 0 0" }}>
              Aapke zer-e-nigraani members, unki fitness goals aur workout routines.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={fetchAssignedMembers}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {members.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-dim)" }}>
            <Users size={40} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
            <p style={{ fontSize: "1rem" }}>Filhal koi member assigned nahi hai.</p>
            <p style={{ fontSize: "0.8rem" }}>Owner ya receptionist jab aapko member assign karenge toh yahan aayega.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "20px" }}>
            {members.map((item) => (
              <div
                key={item.assignmentId}
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  borderRadius: "12px",
                  padding: "18px",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          background: "var(--purple-soft)",
                          color: "var(--purple-primary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "1.1rem",
                        }}
                      >
                        {item.member.fullName.charAt(0)}
                      </div>
                      <div>
                        <h4 style={{ fontWeight: 600, margin: 0 }}>{item.member.fullName}</h4>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                          {item.member.memberId} • {item.member.phone}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: "0.8rem", marginBottom: "12px", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px" }}>
                    <div style={{ color: "var(--text-dim)", marginBottom: "2px" }}>Coaching Focus:</div>
                    <div style={{ fontWeight: 600, color: "var(--accent-primary)" }}>{item.coachingFocus || "General Fitness"}</div>
                    {item.member.limitations && (
                      <div style={{ marginTop: "4px", color: "#f87171", fontSize: "0.75rem" }}>
                        Limitation: {item.member.limitations}
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: "0.8rem", marginBottom: "14px" }}>
                    <span style={{ color: "var(--text-dim)" }}>Active Plan: </span>
                    <span style={{ fontWeight: 600 }}>
                      {item.member.activePlan ? item.member.activePlan.title : "No Plan Published"}
                    </span>
                  </div>

                  {/* Recent Sessions queue */}
                  {item.member.recentSessions && item.member.recentSessions.length > 0 && (
                    <div style={{ marginBottom: "14px" }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "6px" }}>Recent Activity:</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {item.member.recentSessions.map((s) => (
                          <div
                            key={s.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "0.75rem",
                              background: "rgba(255,255,255,0.02)",
                              padding: "4px 8px",
                              borderRadius: "4px",
                            }}
                          >
                            <span>{new Date(s.sessionDate).toLocaleDateString()}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span className="badge badge-accent">{s.status}</span>
                              <button
                                className="btn btn-secondary"
                                onClick={() => handleOpenReview(s, item)}
                                style={{ padding: "2px 6px", fontSize: "0.7rem" }}
                              >
                                Review
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "6px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleOpenPlanBuilder(item)}
                    style={{ justifyContent: "center", fontSize: "0.75rem", padding: "6px 2px" }}
                  >
                    <Dumbbell size={13} /> Workout
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setSelectedMember(item);
                      setShowDietModal(true);
                    }}
                    style={{ justifyContent: "center", fontSize: "0.75rem", padding: "6px 2px" }}
                  >
                    <Utensils size={13} /> Diet
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setSelectedMember(item);
                      setShowProgressModal(true);
                    }}
                    style={{ justifyContent: "center", fontSize: "0.75rem", padding: "6px 2px" }}
                  >
                    <Activity size={13} /> Progress
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setSelectedMember(item);
                      setShowFitnessModal(true);
                    }}
                    style={{ justifyContent: "center", fontSize: "0.75rem", padding: "6px 2px" }}
                    title="Activity Insights & Weekly Trends"
                  >
                    <Smartphone size={13} /> Insights
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* WORKOUT PLAN BUILDER MODAL                                */}
      {/* ========================================================= */}
      {showPlanModal && selectedMember && (
        <ModalOverlay className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: "780px", maxHeight: "90vh", overflowY: "auto", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Workout Plan Builder</h3>
                <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
                  Member: {selectedMember.member.fullName} ({selectedMember.member.memberId})
                </span>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowPlanModal(false)} style={{ padding: "6px" }}>
                <X size={18} />
              </button>
            </div>

            {planStatusMessage && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  marginBottom: "16px",
                  background: planStatusMessage.includes("Masla") ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                  color: planStatusMessage.includes("Masla") ? "#f87171" : "#34d399",
                }}
              >
                {planStatusMessage}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="field-label">Plan Title *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={planTitle}
                    onChange={(e) => setPlanTitle(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="field-label">Coaching Goal *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={planGoal}
                    onChange={(e) => setPlanGoal(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Weekly Schedule (e.g. Days)</label>
                <input
                  type="text"
                  className="input-field"
                  value={weeklySchedule}
                  onChange={(e) => setWeeklySchedule(e.target.value)}
                />
              </div>

              {/* Workout Days & Exercises Builder */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <label className="field-label" style={{ margin: 0 }}>Workout Days & Exercises</label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setWorkoutDays([
                        ...workoutDays,
                        {
                          title: `Day ${workoutDays.length + 1}`,
                          dayOfWeek: "FRIDAY",
                          exercises: [
                            {
                              name: "Exercise Name",
                              type: "STRENGTH",
                              sets: 3,
                              reps: "10",
                              targetLoad: "10 kg",
                              restSeconds: 60,
                            },
                          ],
                        },
                      ]);
                    }}
                    style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                  >
                    <Plus size={14} /> Add Workout Day
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {workoutDays.map((day, dayIdx) => (
                    <div
                      key={dayIdx}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: "10px",
                        padding: "14px",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: "10px", marginBottom: "12px" }}>
                        <input
                          type="text"
                          className="input-field"
                          value={day.title}
                          onChange={(e) => {
                            const updated = [...workoutDays];
                            updated[dayIdx].title = e.target.value;
                            setWorkoutDays(updated);
                          }}
                          placeholder="Day Title (e.g. Upper Body)"
                        />
                        <select
                          className="input-field"
                          value={day.dayOfWeek}
                          onChange={(e) => {
                            const updated = [...workoutDays];
                            updated[dayIdx].dayOfWeek = e.target.value;
                            setWorkoutDays(updated);
                          }}
                        >
                          <option value="MONDAY">MONDAY</option>
                          <option value="TUESDAY">TUESDAY</option>
                          <option value="WEDNESDAY">WEDNESDAY</option>
                          <option value="THURSDAY">THURSDAY</option>
                          <option value="FRIDAY">FRIDAY</option>
                          <option value="SATURDAY">SATURDAY</option>
                          <option value="SUNDAY">SUNDAY</option>
                        </select>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            const updated = workoutDays.filter((_, idx) => idx !== dayIdx);
                            setWorkoutDays(updated);
                          }}
                          style={{ padding: "8px" }}
                        >
                          <Trash2 size={16} color="#f87171" />
                        </button>
                      </div>

                      {/* Exercises in Day */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {day.exercises.map((ex: any, exIdx: number) => (
                          <div className="responsive-grid"
                            key={exIdx}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                              gap: "8px",
                              alignItems: "center",
                              background: "rgba(0,0,0,0.2)",
                              padding: "8px 10px",
                              borderRadius: "6px",
                            }}
                          >
                            <ExerciseDetailsFields exercise={ex} onChange={value => { const updated = [...workoutDays]; updated[dayIdx].exercises[exIdx] = value; setWorkoutDays(updated); }} />
                            <input
                              type="text"
                              className="input-field"
                              value={ex.name}
                              onChange={(e) => {
                                const updated = [...workoutDays];
                                updated[dayIdx].exercises[exIdx].name = e.target.value;
                                setWorkoutDays(updated);
                              }}
                              placeholder="Exercise Name"
                              style={{ padding: "6px" }}
                            />
                            <input
                              type="number"
                              className="input-field"
                              value={ex.sets || ""}
                              onChange={(e) => {
                                const updated = [...workoutDays];
                                updated[dayIdx].exercises[exIdx].sets = parseInt(e.target.value);
                                setWorkoutDays(updated);
                              }}
                              placeholder="Sets"
                              style={{ padding: "6px" }}
                            />
                            <input
                              type="text"
                              className="input-field"
                              value={ex.reps || ""}
                              onChange={(e) => {
                                const updated = [...workoutDays];
                                updated[dayIdx].exercises[exIdx].reps = e.target.value;
                                setWorkoutDays(updated);
                              }}
                              placeholder="Reps"
                              style={{ padding: "6px" }}
                            />
                            <input
                              type="text"
                              className="input-field"
                              value={ex.targetLoad || ""}
                              onChange={(e) => {
                                const updated = [...workoutDays];
                                updated[dayIdx].exercises[exIdx].targetLoad = e.target.value;
                                setWorkoutDays(updated);
                              }}
                              placeholder="Load / Weight"
                              style={{ padding: "6px" }}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => {
                                const updated = [...workoutDays];
                                updated[dayIdx].exercises = updated[dayIdx].exercises.filter((_: any, i: number) => i !== exIdx);
                                setWorkoutDays(updated);
                              }}
                              style={{ padding: "6px" }}
                            >
                              <X size={14} color="#f87171" />
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            const updated = [...workoutDays];
                            updated[dayIdx].exercises.push({
                              name: "New Exercise",
                              type: "STRENGTH",
                              sets: 3,
                              reps: "10",
                              targetLoad: "10 kg",
                              restSeconds: 60,
                            });
                            setWorkoutDays(updated);
                          }}
                          style={{ alignSelf: "flex-start", fontSize: "0.75rem", padding: "4px 8px", marginTop: "4px" }}
                        >
                          <Plus size={12} /> Add Exercise
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={savingPlan}
                onClick={() => handleSavePlan("DRAFT")}
              >
                <Save size={16} /> Save as Draft
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingPlan}
                onClick={() => handleSavePlan("PUBLISHED")}
              >
                <Send size={16} /> {savingPlan ? "Publishing..." : "Publish to Member"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ========================================================= */}
      {/* SESSION REVIEW & FEEDBACK MODAL                           */}
      {/* ========================================================= */}
      {showReviewModal && activeSessionReview && (
        <ModalOverlay className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: "600px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Review Workout Execution</h3>
                <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
                  Date: {new Date(activeSessionReview.sessionDate).toLocaleDateString()} • Status: {activeSessionReview.status}
                </span>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowReviewModal(false)} style={{ padding: "6px" }}>
                <X size={18} />
              </button>
            </div>

            {feedbackMessage && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  marginBottom: "16px",
                  background: feedbackMessage.includes("Masla") ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                  color: feedbackMessage.includes("Masla") ? "#f87171" : "#34d399",
                }}
              >
                {feedbackMessage}
              </div>
            )}

            <div style={{ marginBottom: "18px" }}>
              <label className="field-label">Trainer Coaching Feedback *</label>
              <textarea
                className="input-field"
                rows={4}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Member ke results par coaching feedback darj karein (e.g. Good progression, focus on squat depth next session)..."
                required
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", display: "block", marginTop: "4px" }}>
                * Spec Rule: Feedback add karne par member ko notification milegi. Member ke actual recorded results overwrite nahi honge.
              </span>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSubmitFeedback}
              disabled={submittingFeedback}
              style={{ width: "100%", justifyContent: "center" }}
            >
              <MessageSquare size={16} /> {submittingFeedback ? "Submitting..." : "Submit Coaching Feedback"}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* DIET PLAN BUILDER MODAL */}
      {showDietModal && selectedMember && (
        <TrainerDietBuilderModal
          memberItem={selectedMember}
          onClose={() => setShowDietModal(false)}
          onSuccess={() => {
            fetchAssignedMembers();
            setShowDietModal(false);
          }}
        />
      )}

      {/* PROGRESS TRACKING REVIEW MODAL */}
      {showProgressModal && selectedMember && (
        <TrainerProgressReviewModal
          memberItem={selectedMember}
          onClose={() => setShowProgressModal(false)}
          onSuccess={() => {
            fetchAssignedMembers();
            setShowProgressModal(false);
          }}
        />
      )}

      {/* FITNESS ACTIVITY INSIGHTS & PLAN ADJUSTMENT MODAL */}
      {showFitnessModal && selectedMember && (
        <TrainerActivityInsightsModal
          isOpen={showFitnessModal}
          onClose={() => setShowFitnessModal(false)}
          memberId={selectedMember.member.id}
          memberName={selectedMember.member.fullName}
          onOpenWorkoutPlan={() => {
            setShowFitnessModal(false);
            handleOpenPlanBuilder(selectedMember);
          }}
          onOpenDietPlan={() => {
            setShowFitnessModal(false);
            setShowDietModal(true);
          }}
        />
      )}
    </div>
  );
}
