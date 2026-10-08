"use client";
import MemberLoadingLayout from "./MemberLoadingLayout";
import layoutStyles from "./MemberPages.module.css";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import {
  Footprints,
  Compass,
  Flame,
  Dumbbell,
  RefreshCw,
  Settings,
  Shield,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Activity,
  UserCheck,
  PowerOff,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import FitnessPermissionsModal from "./FitnessPermissionsModal";

export default function FitnessActivitySection() {
  const readCacheVersion = useReadCacheVersion();
  const [range, setRange] = useState<"today" | "week" | "month" | "custom">("week");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activityData, setActivityData] = useState<any>(null);
  const [connectionData, setConnectionData] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConnection = async () => {
    try {
      const res = await apiFetch("/api/v1/member/fitness/connection");
      const json = await res.json();
      if (json.success) {
        setConnectionData(json.data);
      }
    } catch (err) {
      console.error("Connection load error:", err);
    }
  };

  const fetchActivity = async () => {
    setLoading(true);
    setError(null);
    try {
      if (range === "custom" && (!startDate || !endDate || startDate > endDate)) throw new Error("Choose a valid date range.");
      const res = await apiFetch(`/api/v1/member/fitness/activity?range=${range}${range === "custom" ? `&startDate=${startDate}&endDate=${endDate}` : ""}`);
      const json = await res.json();
      if (json.success) {
        setActivityData(json.data);
      } else {
        setError(json.error || "Activity data load nahi hua.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch activity.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnection();
  }, [readCacheVersion]);

  useEffect(() => {
    fetchActivity();
  }, [range, startDate, endDate, readCacheVersion]);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      // Refresh both connection state and activity data
      await fetchConnection();
      await fetchActivity();
    } finally {
      setSyncing(false);
    }
  };

  const connection = connectionData?.connection;
  const assignedTrainer = connectionData?.assignedTrainer;
  const aggregates = activityData?.aggregates;
  const dailySummaries = activityData?.dailySummaries || [];
  const workoutSessions = activityData?.workoutSessions || [];

  const formatLastSync = (dateStr?: string | null) => {
    if (!dateStr) return "Abhi tak sync nahi hua";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-PK", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  if (loading && !activityData && !error) return <MemberLoadingLayout variant="fitness" />;

  return (
    <div>
      <form className="section-toolbar" style={{ padding: 18, marginBottom: 20, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 12 }} onSubmit={e => { e.preventDefault(); setRange("custom"); }}><label>From<input className="input-field" type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} /></label><label>To<input className="input-field" type="date" min={startDate} required value={endDate} onChange={e => setEndDate(e.target.value)} /></label><button className="btn-secondary">Apply dates</button></form>
      {/* 1. CONNECTION STATUS & CONTROL CARD */}
      <div
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "14px",
          padding: "20px 24px",
          marginBottom: "24px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
          <div
            style={{
              padding: "12px",
              borderRadius: "12px",
              backgroundColor:
                connection?.status === "CONNECTED"
                  ? "rgba(34, 197, 94, 0.12)"
                  : connection?.status === "LIMITED_PERMISSIONS"
                  ? "rgba(245, 158, 11, 0.12)"
                  : "rgba(156, 163, 175, 0.12)",
              color:
                connection?.status === "CONNECTED"
                  ? "#22c55e"
                  : connection?.status === "LIMITED_PERMISSIONS"
                  ? "#f59e0b"
                  : "var(--text-secondary)",
            }}
          >
            <Smartphone size={24} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
                Fitness Data Connection
              </h3>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: "20px",
                  backgroundColor:
                    connection?.status === "CONNECTED"
                      ? "rgba(34, 197, 94, 0.2)"
                      : connection?.status === "LIMITED_PERMISSIONS"
                      ? "rgba(245, 158, 11, 0.2)"
                      : "rgba(107, 114, 128, 0.2)",
                  color:
                    connection?.status === "CONNECTED"
                      ? "var(--accent-primary)"
                      : connection?.status === "LIMITED_PERMISSIONS"
                      ? "var(--amber-primary)"
                      : "var(--text-secondary)",
                }}
              >
                {connection?.status === "CONNECTED"
                  ? "Connected (All Permitted)"
                  : connection?.status === "LIMITED_PERMISSIONS"
                  ? "Connected — Limited Permissions"
                  : "Not Connected / Disconnected"}
              </span>

              {connection?.backendUploadConsent && (
                <span
                  style={{
                    fontSize: "0.72rem",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    backgroundColor: "rgba(59, 130, 246, 0.2)",
                    color: "var(--blue-primary)",
                  }}
                >
                  Cloud Synced
                </span>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginTop: "6px",
                fontSize: "0.82rem",
                color: "var(--text-secondary)",
                flexWrap: "wrap",
              }}
            >
              <div>
                Source: <strong>Android Health Connect</strong>
              </div>
              <div>•</div>
              <div>
                Last synced: <strong>{formatLastSync(connection?.lastSyncedAt)}</strong>
              </div>
              <div>•</div>
              <div>
                Trainer sharing:{" "}
                <strong style={{ color: connection?.trainerSharingEnabled ? "var(--accent-primary)" : "var(--danger)" }}>
                  {connection?.trainerSharingEnabled
                    ? `Active (${assignedTrainer ? assignedTrainer.name : "Coach"})`
                    : "Off"}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            className="btn btn-secondary"
            onClick={handleSyncNow}
            disabled={syncing}
            style={{ fontSize: "0.85rem", padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Refreshing..." : "Refresh activity"}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setIsModalOpen(true)}
            style={{ fontSize: "0.85rem", padding: "8px 16px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Settings size={14} /> Manage Permissions
          </button>
        </div>
      </div>

      {/* 2. RANGE SELECTOR TABS */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h4 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>Activity History & Trends</h4>
          <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-dim)" }}>
            Karachi Timezone (PKT) summary · Missing days are not counted as zero
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            backgroundColor: "var(--bg-surface)",
            borderRadius: "10px",
            padding: "4px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {(["today", "week", "month"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                border: "none",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                backgroundColor: range === r ? "var(--accent-primary)" : "transparent",
                color: range === r ? "#ffffff" : "var(--text-secondary)",
                transition: "all 0.2s",
              }}
            >
              {r === "today" ? "Today" : r === "week" ? "Last 7 Days" : "Last 30 Days"}
            </button>
          ))}
        </div>
      </div>

      {loading && !activityData ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-secondary)" }}>
          <RefreshCw className="animate-spin" size={28} style={{ margin: "0 auto 12px" }} />
          <div>Activity summaries load ho rahi hain...</div>
        </div>
      ) : error ? (
        <div
          style={{
            padding: "16px",
            borderRadius: "10px",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "var(--danger)",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      ) : (
        <>
          {/* 3. AGGREGATES CARDS GRID */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            {/* Steps Card */}
            <div
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                padding: "16px 20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Total Steps</span>
                <Footprints size={18} className="text-orange-400" />
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#ffffff" }}>
                {aggregates?.totalSteps ? aggregates.totalSteps.toLocaleString() : "No data"}
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                {aggregates?.availableDaysSteps
                  ? `${aggregates.availableDaysSteps} of ${aggregates.periodTotalDays} days available · Avg ${aggregates.averageDailySteps?.toLocaleString()}/day`
                  : "No steps recorded in period"}
              </div>
            </div>

            {/* Distance Card */}
            <div
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                padding: "16px 20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Recorded Distance</span>
                <Compass size={18} className="text-blue-400" />
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#ffffff" }}>
                {aggregates?.totalDistanceKm !== undefined && aggregates?.totalDistanceKm > 0
                  ? `${aggregates.totalDistanceKm} km`
                  : "No data"}
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                {aggregates?.availableDaysDistance
                  ? `Avg ${aggregates.averageDailyDistanceKm} km per active day`
                  : "No distance recorded"}
              </div>
            </div>

            {/* Active Calories Card */}
            <div
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                padding: "16px 20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Active Calories</span>
                <Flame size={18} className="text-red-400" />
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#ffffff" }}>
                {aggregates?.totalActiveCalories
                  ? `${aggregates.totalActiveCalories.toLocaleString()} kcal`
                  : "No data"}
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                Activity-energy estimate
              </div>
            </div>

            {/* Workouts Card */}
            <div
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                padding: "16px 20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Exercise Sessions</span>
                <Dumbbell size={18} className="text-emerald-400" />
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#ffffff" }}>
                {aggregates?.totalWorkouts ? `${aggregates.totalWorkouts} sessions` : "0 sessions"}
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                Total duration: {aggregates?.totalWorkoutDurationMinutes || 0} minutes
              </div>
            </div>
          </div>

          {/* 4. DAILY TREND BARS VISUALIZATION */}
          <div
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "14px",
              padding: "20px 24px",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <TrendingUp size={18} className="text-orange-400" />
                <h4 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>
                  Daily Steps Overview
                </h4>
              </div>
              <span style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                Gray outline indicates missing/unrecorded days
              </span>
            </div>

            {dailySummaries.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                Is time period mein koi records mojud nahi hain.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "10px",
                  height: "160px",
                  paddingTop: "20px",
                  overflowX: "auto",
                }}
              >
                {(() => {
                  const maxSteps = Math.max(1, ...dailySummaries.map((s: any) => s.steps || 0));
                  return dailySummaries.map((day: any) => {
                    const hasSteps = day.hasData && typeof day.steps === "number";
                    const heightPercent = hasSteps ? Math.max(8, Math.round((day.steps / maxSteps) * 100)) : 4;
                    const dateFormatted = new Date(day.date + "T00:00:00Z").toLocaleDateString("en-PK", {
                      day: "numeric",
                      month: "short",
                    });

                    return (
                      <div
                        key={day.date}
                        style={{
                          flex: 1,
                          minWidth: "36px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          height: "100%",
                          justifyContent: "flex-end",
                        }}
                      >
                        {/* Bar */}
                        <div
                          style={{
                            width: "100%",
                            maxWidth: "28px",
                            height: `${heightPercent}%`,
                            borderRadius: "6px 6px 2px 2px",
                            backgroundColor: hasSteps
                              ? day.isToday
                                ? "#f97316"
                                : "#ea580c"
                              : "var(--bg-secondary)",
                            border: hasSteps ? "none" : "1px dashed #374151",
                            transition: "height 0.3s ease",
                            position: "relative",
                          }}
                          title={`${day.date}: ${hasSteps ? `${day.steps.toLocaleString()} steps` : "No data"}`}
                        />
                        {/* Day label */}
                        <span
                          style={{
                            marginTop: "8px",
                            fontSize: "0.7rem",
                            color: day.isToday ? "#f97316" : "var(--text-secondary)",
                            fontWeight: day.isToday ? 700 : 400,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {day.isToday ? "Today" : dateFormatted}
                        </span>
                        {/* Steps label under */}
                        <span
                          style={{
                            fontSize: "0.68rem",
                            color: hasSteps ? "var(--text-main)" : "var(--text-dim)",
                            fontWeight: 600,
                          }}
                        >
                          {hasSteps ? (day.steps > 1000 ? `${(day.steps / 1000).toFixed(1)}k` : day.steps) : "—"}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* 5. SYNCED WORKOUT SESSIONS LIST */}
          <div
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "14px",
              padding: "20px 24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Dumbbell size={18} className="text-orange-400" />
                <h4 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>
                  Recorded Exercise Sessions ({workoutSessions.length})
                </h4>
              </div>
            </div>

            {workoutSessions.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "36px 0",
                  color: "var(--text-secondary)",
                  fontSize: "0.85rem",
                  border: "1px dashed #1f2937",
                  borderRadius: "10px",
                }}
              >
                Is time period mein koi synced workouts nahi miley.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {workoutSessions.map((w: any) => {
                  const startTime = new Date(w.startTime).toLocaleTimeString("en-PK", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const dateStr = new Date(w.startTime).toLocaleDateString("en-PK", {
                    day: "numeric",
                    month: "short",
                  });

                  return (
                    <div
                      key={w.id}
                      style={{
                        padding: "14px 18px",
                        backgroundColor: "var(--bg-secondary)",
                        borderRadius: "10px",
                        border: "1px solid var(--border-medium)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div
                          style={{
                            padding: "10px",
                            borderRadius: "10px",
                            backgroundColor: "rgba(249, 115, 22, 0.12)",
                            color: "#f97316",
                          }}
                        >
                          <Dumbbell size={18} />
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--text-main)" }}>
                              {w.title || w.exerciseType}
                            </span>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                backgroundColor: "rgba(59, 130, 246, 0.15)",
                                color: "var(--blue-primary)",
                              }}
                            >
                              {w.source}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                            {dateStr} at {startTime} · {w.durationMinutes} mins duration
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "0.85rem" }}>
                        {w.distanceKm && (
                          <div style={{ color: "var(--blue-primary)" }}>
                            <strong>{w.distanceKm}</strong> km
                          </div>
                        )}
                        {w.activeCalories && (
                          <div style={{ color: "#fca5a5" }}>
                            <strong>{w.activeCalories}</strong> kcal
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Permissions Modal */}
      <FitnessPermissionsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        connection={connection}
        assignedTrainer={assignedTrainer}
        onRefresh={() => {
          fetchConnection();
          fetchActivity();
        }}
      />
    </div>
  );
}
