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
} from "lucide-react";

interface TrainerFitnessViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
}

export default function TrainerFitnessViewModal({
  isOpen,
  onClose,
  memberId,
  memberName,
}: TrainerFitnessViewModalProps) {
  const readCacheVersion = useReadCacheVersion();
  const [range, setRange] = useState<"week" | "month">("week");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharingDisabled, setSharingDisabled] = useState(false);
  const [coachReassigned, setCoachReassigned] = useState(false);

  const fetchFitnessData = async () => {
    setLoading(true);
    setError(null);
    setSharingDisabled(false);
    setCoachReassigned(false);
    try {
      const res = await apiFetch(`/api/v1/trainer/members/${memberId}/fitness?range=${range}`);
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
        setError(json.error || "Data load nahi ho saka.");
        setData(null);
      } else {
        setData(json.data);
      }
    } catch (err: any) {
      setData(null);
      setError(err.message || "Failed to load fitness data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && memberId) {
      fetchFitnessData();
    }
  }, [isOpen, memberId, range, readCacheVersion]);

  useEffect(() => {
    if (!isOpen || !memberId) return;
    const refresh = () => { if (document.visibilityState === "visible") fetchFitnessData(); else setData(null); };
    const interval = setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, [isOpen, memberId, readCacheVersion]);

  if (!isOpen) return null;

  const aggregates = data?.aggregates;
  const sharedCategories = data?.sharedCategories || [];
  const dailySummaries = data?.dailySummaries || [];
  const workoutSessions = data?.workoutSessions || [];

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
          maxWidth: "760px",
          maxHeight: "90vh",
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
                Synced Fitness Activity — {memberName}
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Member's permitted phone fitness summaries (Health Connect)
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
              <div>Member activity load ho rahi hai...</div>
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
                Trainer Sharing Off Hai
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "420px", margin: "0 auto" }}>
                Member ne apna synced fitness data trainer ke sath share nahi kiya. Jab member permissions screen se sharing enable karega, tab records yahan show honge.
              </p>
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
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "440px", margin: "0 auto" }}>
                Trainer assignment tabdeel hui hai. Naye coach ke sath data share karne ke liye member ko apni app se dobara confirmation deni hogi.
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
              {/* Category Badges Banner */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "20px",
                  padding: "12px 16px",
                  backgroundColor: "var(--bg-secondary)",
                  borderRadius: "10px",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>Shared Categories:</span>
                  {sharedCategories.map((c: string) => (
                    <span
                      key={c}
                      style={{
                        fontSize: "0.74rem",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        backgroundColor: "rgba(249, 115, 22, 0.15)",
                        color: "var(--accent-primary)",
                        fontWeight: 600,
                      }}
                    >
                      {c}
                    </span>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                  {(["week", "month"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: "none",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        backgroundColor: range === r ? "var(--accent-primary)" : "var(--border-medium)",
                        color: range === r ? "#ffffff" : "var(--text-secondary)",
                      }}
                    >
                      {r === "week" ? "Last 7 Days" : "Last 30 Days"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aggregates Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
                  gap: "12px",
                  marginBottom: "20px",
                }}
              >
                {/* Steps */}
                <div style={{ backgroundColor: "var(--bg-secondary)", padding: "14px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Total Steps</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>
                    {sharedCategories.includes("STEPS")
                      ? aggregates?.totalSteps
                        ? aggregates.totalSteps.toLocaleString()
                        : "No data"
                      : "Not shared"}
                  </div>
                  {sharedCategories.includes("STEPS") && aggregates?.availableDaysSteps ? (
                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                      Avg {aggregates.averageDailySteps?.toLocaleString()}/day ({aggregates.availableDaysSteps} days)
                    </div>
                  ) : null}
                </div>

                {/* Distance */}
                <div style={{ backgroundColor: "var(--bg-secondary)", padding: "14px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Distance</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>
                    {sharedCategories.includes("DISTANCE")
                      ? aggregates?.totalDistanceKm
                        ? `${aggregates.totalDistanceKm} km`
                        : "No data"
                      : "Not shared"}
                  </div>
                </div>

                {/* Calories */}
                <div style={{ backgroundColor: "var(--bg-secondary)", padding: "14px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Active Calories</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>
                    {sharedCategories.includes("ACTIVE_CALORIES")
                      ? aggregates?.totalActiveCalories
                        ? `${aggregates.totalActiveCalories.toLocaleString()} kcal`
                        : "No data"
                      : "Not shared"}
                  </div>
                </div>

                {/* Workouts */}
                <div style={{ backgroundColor: "var(--bg-secondary)", padding: "14px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Workouts</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>
                    {sharedCategories.includes("EXERCISE_SESSIONS")
                      ? `${aggregates?.totalWorkouts || 0} sessions`
                      : "Not shared"}
                  </div>
                  {sharedCategories.includes("EXERCISE_SESSIONS") && (
                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                      {aggregates?.totalWorkoutDurationMinutes || 0} mins total
                    </div>
                  )}
                </div>
              </div>

              {/* Workouts List if permitted */}
              {sharedCategories.includes("EXERCISE_SESSIONS") && (
                <div>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "12px" }}>
                    Exercise Sessions ({workoutSessions.length})
                  </h4>
                  {workoutSessions.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                      Is period mein koi workouts sync nahi hue.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                      {workoutSessions.map((w: any) => (
                        <div
                          key={w.id}
                          style={{
                            padding: "10px 14px",
                            backgroundColor: "var(--bg-secondary)",
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: "0.85rem",
                          }}
                        >
                          <div>
                            <strong>{w.title || w.exerciseType}</strong>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                              {new Date(w.startTime).toLocaleDateString()} · {w.durationMinutes} mins
                            </div>
                          </div>
                          <div style={{ color: "var(--blue-primary)", fontSize: "0.8rem" }}>
                            {w.distanceKm ? `${w.distanceKm} km` : ""}
                            {w.activeCalories ? ` · ${w.activeCalories} kcal` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
