"use client";
import styles from "./MemberPages.module.css";
import MemberDataSkeleton from "./MemberDataSkeleton";
import MemberLoadingLayout from "./MemberLoadingLayout";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect, useRef } from "react";
import {
  Calendar,
  CreditCard,
  Dumbbell,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  Send,
  Download,
  AlertTriangle,
  Play,
  Check,
  FileText,
  DollarSign,
  Info,
  X,
  UploadCloud,
  ChevronRight,
  Flame,
  Utensils,
  Activity,
  Bell,
  Smartphone,
  Shield,
} from "lucide-react";
import CloudinaryUploadButton from "@/components/common/CloudinaryUploadButton";
import useOfflineWorkout from "./useOfflineWorkout";
import DietPlanSection from "./DietPlanSection";
import ProgressTrackingSection from "./ProgressTrackingSection";
import NotificationInboxModal from "./NotificationInboxModal";
import FitnessActivitySection from "./FitnessActivitySection";
import MemberPrivacyFitnessSection from "./MemberPrivacyFitnessSection";
import { karachiDateInput } from "@/lib/businessDates";

interface MemberData {
  freezePolicy?: { maxDays: number };
  isSetupPending: boolean;
  member?: {
    id: string;
    memberId: string;
    fullName: string;
    phone: string;
    email: string | null;
    fitnessGoal: string | null;
    joiningDate: string;
  };
  membership?: {
    id: string;
    planName: string;
    status: string;
    startDate: string;
    endDate: string;
    daysRemaining: number;
    isExpired: boolean;
    isExpiringSoon: boolean;
    price: number;
  } | null;
  feeSummary: {
    outstanding: number;
    overdue: number;
    upcomingInstallments: number;
    advanceBalance?: number;
  };
  latestPayment?: {
    id: string;
    receiptNumber: string;
    amount: number;
    paymentDate: string;
    method: string;
    receiptUrl: string;
  } | null;
  pendingTransfer?: {
    id: string;
    amount: number;
    status: string;
    transactionReference: string | null;
    receivingAccountName: string;
    submittedAt: string;
    rejectionReason: string | null;
  } | null;
  todayWorkout?: {
    planId: string;
    planTitle: string;
    goal: string;
    dayId: string;
    dayTitle: string;
    dayOfWeek: string | null;
    exercises: Array<{
      id: string;
      name: string;
      type: string;
      sets: number | null;
      reps: string | null;
      targetLoad: string | null;
      restSeconds: number | null;
      instructions: string | null;
      alternativeExercise: string | null;
    }>;
    session?: {
      id: string;
      status: string;
      startedAt: string | null;
      completedAt: string | null;
      durationMinutes: number | null;
      skipReason: string | null;
      memberNotes: string | null;
      trainerFeedback: string | null;
      exerciseLogs: any[];
    } | null;
  } | null;
  trainer?: {
    id: string;
    name: string;
    phone: string | null;
    avatarUrl: string | null;
    coachingFocus: string;
    startDate: string;
    isReassignmentPending: boolean;
  } | null;
  announcements: Array<{
    id: string;
    title: string;
    content: string;
    category: string;
    pinned: boolean;
    createdAt: string;
  }>;
  availablePlans: Array<{
    id: string;
    name: string;
    description: string | null;
    durationValue: number;
    durationUnit: string;
    membershipFee: number;
  }>;
  receivingAccounts: Array<{
    id: string;
    displayName: string;
    accountTitle: string;
    accountNumber: string;
    type: string;
    instructions: string | null;
  }>;
  lastUpdated?: string;
}

export default function MemberDashboardClient({ initialData, section }: { initialData?: MemberData; section?: "dashboard" | "membership" | "payments" | "workout" }) {
  const readCacheVersion = useReadCacheVersion();
  const [data, setData] = useState<MemberData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "diet" | "progress" | "fitness" | "privacy">("overview");

  // Modals state
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Renewal form state
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [preferredStartDate, setPreferredStartDate] = useState(
    karachiDateInput()
  );
  const [renewalNotes, setRenewalNotes] = useState("");
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);
  const [renewalMessage, setRenewalMessage] = useState<string | null>(null);
  const [myRenewals, setMyRenewals] = useState<any[]>([]);

  // Transfer form state
  const [transferAmount, setTransferAmount] = useState("");
  const [transferAccountId, setTransferAccountId] = useState("");
  const [transferRef, setTransferRef] = useState("");
  const [transferProofUrl, setTransferProofUrl] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);

  // Freeze request state
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [freezeDays, setFreezeDays] = useState("7");
  const [freezeReason, setFreezeReason] = useState("");
  const [freezeSubmitting, setFreezeSubmitting] = useState(false);
  const [freezeMessage, setFreezeMessage] = useState<string | null>(null);
  const [myFreezeRequests, setMyFreezeRequests] = useState<any[]>([]);

  // Workout logging state
  const workoutId = useRef<{ day: string; id: string } | null>(null);
  const workoutQueue = useOfflineWorkout(data?.member?.id);
  const [workoutLogs, setWorkoutLogs] = useState<Record<string, { reps: string; load: string; skipped: boolean; reason: string }>>({});
  const [workoutNotes, setWorkoutNotes] = useState("");
  const [workoutDuration, setWorkoutDuration] = useState("45");
  const [workoutSubmitting, setWorkoutSubmitting] = useState(false);
  const [workoutMessage, setWorkoutMessage] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch unread notification count
      apiFetch("/api/v1/member/notifications?unreadOnly=true&limit=1")
        .then((r) => r.json())
        .then((j) => {
          if (j.success && typeof j.data?.unreadCount === "number") {
            setUnreadNotifCount(j.data.unreadCount);
          }
        })
        .catch(() => {});
      const res = await apiFetch("/api/v1/member/dashboard", { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        if (json.data.todayWorkout?.exercises) {
          // prefill logs
          const initialLogs: Record<string, any> = {};
          json.data.todayWorkout.exercises.forEach((ex: any) => {
            initialLogs[ex.id] = {
              reps: ex.reps || "10",
              load: ex.targetLoad ? ex.targetLoad.replace(/[^0-9.]/g, "") : "0",
              skipped: false,
              reason: "Equipment unavailable",
            };
          });
          setWorkoutLogs(initialLogs);
        }
      } else {
        setError(json.error || "Dashboard data load nahi ho saka.");
      }
    } catch (err: any) {
      setError("Network masla aya. Dobara koshish karein.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      fetchDashboard();
    }
  }, [readCacheVersion]);

  const fetchRenewals = async () => {
    try {
      const res = await apiFetch("/api/v1/member/renewal-request");
      const json = await res.json();
      if (json.success) {
        setMyRenewals(json.data);
      }
    } catch (err) {}
  };

  const handleOpenRenewal = () => {
    setShowRenewalModal(true);
    setRenewalMessage(null);
    fetchRenewals();
  };

  const handleSubmitRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) return;
    setRenewalSubmitting(true);
    setRenewalMessage(null);
    try {
      const res = await apiFetch("/api/v1/member/renewal-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feePlanId: selectedPlanId,
          preferredStartDate,
          notes: renewalNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setRenewalMessage("Aapki renewal request kamyabi se submit ho gayi hai.");
        fetchRenewals();
        fetchDashboard();
      } else {
        setRenewalMessage(`Masla: ${json.error}`);
      }
    } catch (err) {
      setRenewalMessage("Server se rabta nahi ho saka.");
    } finally {
      setRenewalSubmitting(false);
    }
  };

  const handleWithdrawRenewal = async (id: string) => {
    try {
      const res = await apiFetch(`/api/v1/member/renewal-request/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        fetchRenewals();
        fetchDashboard();
      }
    } catch (err) {}
  };

  const fetchFreezeRequests = async () => {
    try {
      const res = await apiFetch("/api/v1/member/freeze-request");
      const json = await res.json();
      if (json.success) setMyFreezeRequests(json.data || []);
    } catch {}
  };

  const handleFreezeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFreezeSubmitting(true);
    setFreezeMessage(null);
    try {
      const res = await apiFetch("/api/v1/member/freeze-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedDays: freezeDays,
          reason: freezeReason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFreezeMessage(json.message);
        fetchFreezeRequests();
        fetchDashboard();
        setTimeout(() => {
          setShowFreezeModal(false);
          setFreezeMessage(null);
          setFreezeReason("");
        }, 1500);
      } else {
        setFreezeMessage(`Masla: ${json.error}`);
      }
    } catch {
      setFreezeMessage("Server connection error.");
    } finally {
      setFreezeSubmitting(false);
    }
  };

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferAmount || !transferAccountId) return;
    if (!transferRef.trim() || !transferProofUrl) { setTransferMessage("Masla: transfer reference aur receipt upload karein."); return; }
    setTransferSubmitting(true);
    setTransferMessage(null);
    try {
      const res = await apiFetch("/api/v1/member/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(transferAmount),
          receivingAccountId: transferAccountId,
          transactionReference: transferRef,
          proofImageUrl: transferProofUrl || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setTransferMessage("Transfer proof submit ho gaya! Staff verification ke baad status update hoga.");
        fetchDashboard();
      } else {
        setTransferMessage(`Masla: ${json.error}`);
      }
    } catch (err) {
      setTransferMessage("Server connection error.");
    } finally {
      setTransferSubmitting(false);
    }
  };

  const handleFinishWorkout = async () => {
    if (!data?.todayWorkout) return;
    setWorkoutSubmitting(true);
    setWorkoutMessage(null);
    try {
      const logsArray = data.todayWorkout.exercises.map((ex, idx) => {
        const item = workoutLogs[ex.id] || { reps: "10", load: "0", skipped: false, reason: "" };
        return {
          workoutExerciseId: ex.id,
          exerciseName: ex.name,
          exerciseType: ex.type,
          setNumber: idx + 1,
          plannedReps: ex.reps,
          plannedWeight: ex.targetLoad ? parseFloat(ex.targetLoad) : null,
          actualReps: item.skipped ? null : parseInt(item.reps) || 0,
          actualWeight: item.skipped ? null : parseFloat(item.load) || 0,
          isSkipped: item.skipped,
          skipReason: item.skipped ? item.reason : null,
        };
      });

      const hasSkipped = logsArray.some((l) => l.isSkipped);
      const isAllSkipped = logsArray.every((l) => l.isSkipped);
      const status = isAllSkipped ? "SKIPPED" : hasSkipped ? "PARTIALLY_COMPLETED" : "COMPLETED";

      const localDay = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
      const day = data.todayWorkout.dayId + ":" + localDay;
      if (workoutId.current?.day !== day) workoutId.current = { day, id: data.todayWorkout.session?.id || crypto.randomUUID() };
      const json = await workoutQueue.save({
        sessionId: workoutId.current.id,
        planId: data.todayWorkout.planId,
        workoutDayId: data.todayWorkout.dayId,
        sessionDate: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        status,
        durationMinutes: parseInt(workoutDuration) || 45,
        memberNotes: workoutNotes,
        exerciseLogs: logsArray,
      });
      if (json.success) {
        setWorkoutMessage(json.queued ? "Workout saved on this device. It will upload when your connection returns." : "Workout saved.");
        if (!json.queued) fetchDashboard();
      } else {
        setWorkoutMessage(`Masla: ${json.error}`);
      }
    } catch (err: any) {
      setWorkoutMessage(err.message || "Could not save workout.");
    } finally {
      setWorkoutSubmitting(false);
    }
  };

  if (loading && !data && section === "workout") {
    return <div className={styles.client} aria-busy="true">
      <span className={styles.srOnly} role="status">Loading your workout and trainer details…</span>
      <button className="btn btn-secondary" disabled style={{ marginBottom: 20 }}><Bell size={16} /> Updates</button>
      <div className={styles.overviewGrid}>
        <section className={`glass-panel ${styles.workoutCard}`} style={{ padding: 24 }}>
          <div className={styles.loadingCardHeading}><span className={styles.loadingIcon}><Dumbbell size={20} /></span><h3>Today's Workout</h3></div>
          <MemberDataSkeleton />
        </section>
        <section className={`glass-panel ${styles.workoutCard}`} style={{ padding: 24 }}>
          <div className={styles.loadingCardHeading}><span className={styles.loadingIcon}><UserCheck size={20} /></span><h3>Assigned Trainer</h3></div>
          <MemberDataSkeleton rows={2} />
        </section>
      </div>
    </div>;
  }

  if (loading && !data) {
    return <MemberLoadingLayout variant={section === "membership" ? "membership" : section === "payments" ? "payments" : "home"} />;
  }

  if (error || !data) {
    return (
      <div className="glass-panel" style={{ padding: "40px", textAlign: "center", maxWidth: "600px", margin: "40px auto" }}>
        <AlertTriangle size={40} color="var(--amber-primary)" style={{ margin: "0 auto 16px" }} />
        <h3 style={{ fontSize: "1.3rem", marginBottom: "8px" }}>Data Load Nahi Hua</h3>
        <p style={{ color: "var(--text-dim)", marginBottom: "20px" }}>{error || "Server se response nahi mila."}</p>
        <button className="btn btn-primary" onClick={fetchDashboard}>
          <RefreshCw size={16} /> Dobara Koshish Karein
        </button>
      </div>
    );
  }

  const { member, membership, feeSummary, latestPayment, pendingTransfer, todayWorkout, trainer, announcements } = data;

  return (
    <div className={styles.client} aria-busy={loading}>
      {!section && (<>
      {/* Top Tab Navigation */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-subtle)",
          marginBottom: "24px",
          gap: "8px",
          overflowX: "auto",
        }}
      >
        <button
          onClick={() => setActiveTab("overview")}
          className={activeTab === "overview" ? "btn btn-primary" : "btn btn-secondary"}
          style={{ padding: "8px 18px", borderRadius: "8px 8px 0 0", borderBottom: activeTab === "overview" ? "2px solid var(--accent-primary)" : "none" }}
        >
          <Calendar size={15} /> Dashboard Overview
        </button>
        <button
          onClick={() => setActiveTab("diet")}
          className={activeTab === "diet" ? "btn btn-primary" : "btn btn-secondary"}
          style={{ padding: "8px 18px", borderRadius: "8px 8px 0 0", borderBottom: activeTab === "diet" ? "2px solid var(--accent-primary)" : "none" }}
        >
          <Utensils size={15} /> Diet & Nutrition Plans
        </button>
        <button
          onClick={() => setActiveTab("progress")}
          className={activeTab === "progress" ? "btn btn-primary" : "btn btn-secondary"}
          style={{ padding: "8px 18px", borderRadius: "8px 8px 0 0", borderBottom: activeTab === "progress" ? "2px solid var(--accent-primary)" : "none" }}
        >
          <Activity size={15} /> Progress Tracking
        </button>
        <button
          onClick={() => setActiveTab("fitness")}
          className={activeTab === "fitness" ? "btn btn-primary" : "btn btn-secondary"}
          style={{ padding: "8px 18px", borderRadius: "8px 8px 0 0", borderBottom: activeTab === "fitness" ? "2px solid var(--accent-primary)" : "none" }}
        >
          <Smartphone size={15} /> Fitness Activity
        </button>
        <button
          onClick={() => setActiveTab("privacy")}
          className={activeTab === "privacy" ? "btn btn-primary" : "btn btn-secondary"}
          style={{ padding: "8px 18px", borderRadius: "8px 8px 0 0", borderBottom: activeTab === "privacy" ? "2px solid var(--accent-primary)" : "none" }}
        >
          <Shield size={15} /> Privacy & Fitness Data
        </button>

        {/* Notification Bell Button */}
        <button
          onClick={() => setShowNotificationModal(true)}
          className="btn btn-secondary"
          style={{
            marginLeft: "auto",
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderRadius: "8px 8px 0 0",
          }}
          title="Notification Inbox"
        >
          <Bell size={16} />
          <span style={{ fontSize: "0.85rem" }}>Updates</span>
          {unreadNotifCount > 0 && (
            <span
              style={{
                background: "#ef4444",
                color: "#ffffff",
                fontSize: "0.7rem",
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: "10px",
                lineHeight: "1.2",
              }}
            >
              {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
            </span>
          )}
        </button>
      </div>

      </>)}
      {section && <button className="btn btn-secondary" style={{ marginBottom: 20 }} onClick={() => setShowNotificationModal(true)}><Bell size={16} /> Updates {unreadNotifCount > 0 ? `(${unreadNotifCount})` : ""}</button>}
      {activeTab === "diet" && <DietPlanSection />}
      {activeTab === "progress" && <ProgressTrackingSection />}
      {activeTab === "fitness" && <FitnessActivitySection />}
      {activeTab === "privacy" && <MemberPrivacyFitnessSection />}

      {activeTab === "overview" && (
        <>
      {/* Top Banner if Expired or Expiring soon */}
      {membership?.isExpired && (
        <div className={styles.flexRow}
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <AlertCircle size={24} color="#ef4444" />
            <div>
              <div style={{ fontWeight: 600, color: "var(--danger)" }}>Membership Khatam Ho Chuki Hai</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
                Aapka plan {new Date(membership.endDate).toLocaleDateString()} ko expire ho chuka hai. Continuous training ke liye renewal request bhejein.
              </div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleOpenRenewal} style={{ whiteSpace: "nowrap" }}>
            Renew Request Karein
          </button>
        </div>
      )}

      {membership?.isExpiringSoon && (
        <div className={styles.flexRow}
          style={{
            background: "rgba(245, 158, 11, 0.15)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Clock size={24} color="#f59e0b" />
            <div>
              <div style={{ fontWeight: 600, color: "var(--amber-primary)" }}>Expiry Alert: Sirf {membership.daysRemaining} Din Baqi Hain</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
                Aapka {membership.planName} plan {new Date(membership.endDate).toLocaleDateString()} ko expire ho raha hai.
              </div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleOpenRenewal} style={{ whiteSpace: "nowrap" }}>
            Renew Request Karein
          </button>
        </div>
      )}

      {(!section || ["dashboard", "membership", "payments"].includes(section)) && (<>
      {/* Main 2-Column Grid */}
      <div className={styles.overviewGrid}>
        
        {section !== "payments" && (<>
        {/* SECTION 1: Membership Card */}
        <div className="glass-panel" style={{ padding: "24px", position: "relative" }}>
          <div className={styles.flexRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <span className="badge badge-accent" style={{ marginBottom: "8px" }}>Active Subscription</span>
              <h3 style={{ fontSize: "1.4rem", fontWeight: 700 }}>
                {membership ? membership.planName : "Membership Setup Pending"}
              </h3>
            </div>
            {membership && (
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  background: membership.isExpired
                    ? "rgba(239, 68, 68, 0.2)"
                    : membership.isExpiringSoon
                    ? "rgba(245, 158, 11, 0.2)"
                    : "rgba(16, 185, 129, 0.2)",
                  color: membership.isExpired ? "var(--danger)" : membership.isExpiringSoon ? "var(--amber-primary)" : "#34d399",
                }}
              >
                {membership.status}
              </span>
            )}
          </div>

          {membership ? (
            <div>
              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div style={{ background: "var(--bg-secondary)", padding: "12px", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Start Date</div>
                  <div style={{ fontWeight: 600, marginTop: "2px" }}>
                    {new Date(membership.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
                <div style={{ background: "var(--bg-secondary)", padding: "12px", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Last Valid Day</div>
                  <div style={{ fontWeight: 600, marginTop: "2px" }}>
                    {new Date(membership.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
              </div>

              <div className={styles.flexRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
                  {membership.isExpired ? "Plan expire ho chuka hai" : `${membership.daysRemaining} din baqi hain`}
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  {!membership.isExpired && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowFreezeModal(true);
                        fetchFreezeRequests();
                      }}
                      style={{ fontSize: "0.85rem", padding: "6px 14px" }}
                    >
                      Request Freeze
                    </button>
                  )}
                  <button className="btn btn-primary" onClick={handleOpenRenewal} style={{ fontSize: "0.85rem", padding: "6px 14px" }}>
                    Request Renewal
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: "20px 0", color: "var(--text-dim)", fontSize: "0.9rem" }}>
              Aapki membership abhi staff verification ya activation ke intazar mein hai.
            </div>
          )}
        </div>

        </>)}
        {section !== "membership" && (<>
        {/* SECTION 2: Fee Summary (Separated: Outstanding, Overdue, Upcoming) */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <div className={styles.flexRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 600 }}>Fee Summary</h3>
            <span>Advance credit: Rs. {(feeSummary.advanceBalance || 0).toLocaleString()}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Pakistani Rupee (PKR)</span>
          </div>

          <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "18px" }}>
            {/* Total Outstanding */}
            <div style={{ background: "var(--bg-secondary)", padding: "14px", borderRadius: "10px" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "4px" }}>Total Outstanding</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-bright)" }}>
                Rs. {feeSummary.outstanding.toLocaleString()}
              </div>
            </div>

            {/* Overdue */}
            <div
              style={{
                background: feeSummary.overdue > 0 ? "rgba(239, 68, 68, 0.1)" : "var(--bg-secondary)",
                padding: "14px",
                borderRadius: "10px",
                border: feeSummary.overdue > 0 ? "1px solid rgba(239, 68, 68, 0.25)" : "none",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: feeSummary.overdue > 0 ? "var(--danger)" : "var(--text-dim)", marginBottom: "4px" }}>
                Overdue Late Dues
              </div>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: feeSummary.overdue > 0 ? "var(--danger)" : "var(--text-bright)" }}>
                Rs. {feeSummary.overdue.toLocaleString()}
              </div>
            </div>

            {/* Upcoming Installment */}
            <div style={{ background: "var(--bg-secondary)", padding: "14px", borderRadius: "10px" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "4px" }}>Upcoming Installment</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--accent-primary)" }}>
                Rs. {feeSummary.upcomingInstallments.toLocaleString()}
              </div>
            </div>
          </div>

          <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "16px", lineHeight: 1.4 }}>
            * Aainda installments ko late fee ya overdue tasawwur nahi kiya gaya. Overdue sirf guzri hui tareekh ki baqaya raqam hai.
          </p>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                setShowTransferModal(true);
                setTransferMessage(null);
                setTransferAmount(feeSummary.overdue > 0 ? String(feeSummary.overdue) : String(feeSummary.outstanding));
                if (data.receivingAccounts && data.receivingAccounts.length > 0) {
                  setTransferAccountId(data.receivingAccounts[0].id);
                }
              }}
              style={{ flex: 1, justifyContent: "center" }}
            >
              <UploadCloud size={16} /> Submit Transfer Proof
            </button>
          </div>
        </div>

        </>)}
      </div>

      </>)}
      {(!section || section === "dashboard" || section === "payments") && (<>
      {/* SECTION 3 & 4: Latest Payment & Pending Transfer */}
      <div className={styles.overviewGrid}>
        
        {/* Latest Confirmed Payment */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div className={styles.flexRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <h4 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Latest Confirmed Payment</h4>
            <CreditCard size={18} color="var(--accent-primary)" />
          </div>

          {latestPayment ? (
            <div>
              <div className={styles.flexRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                <span style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-bright)" }}>
                  Rs. {latestPayment.amount.toLocaleString()}
                </span>
                <span className="badge badge-success">Confirmed</span>
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: "12px" }}>
                Date: {new Date(latestPayment.paymentDate).toLocaleDateString()} • Method: {latestPayment.method}
              </div>
              <a
                href={`/api/v1/receipts/${encodeURIComponent(latestPayment.id)}/download`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ fontSize: "0.85rem", padding: "6px 12px", width: "100%", justifyContent: "center" }}
              >
                <Download size={14} /> Download Receipt ({latestPayment.receiptNumber})
              </a>
            </div>
          ) : (
            <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>Abhi tak koi verified payment record nahi mila.</p>
          )}
        </div>

        {/* Pending Transfer Verification */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div className={styles.flexRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <h4 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Submitted Transfer Status</h4>
            <Clock size={18} color="var(--amber-primary)" />
          </div>

          {pendingTransfer ? (
            <div>
              <div className={styles.flexRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                  Rs. {pendingTransfer.amount.toLocaleString()}
                </span>
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: "12px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    background:
                      pendingTransfer.status === "APPROVED"
                        ? "rgba(16, 185, 129, 0.2)"
                        : pendingTransfer.status === "REJECTED"
                        ? "rgba(239, 68, 68, 0.2)"
                        : "rgba(245, 158, 11, 0.2)",
                    color:
                      pendingTransfer.status === "APPROVED"
                        ? "#34d399"
                        : pendingTransfer.status === "REJECTED"
                        ? "var(--danger)"
                        : "var(--amber-primary)",
                  }}
                >
                  {pendingTransfer.status}
                </span>
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: "6px" }}>
                Account: {pendingTransfer.receivingAccountName}
              </div>
              {pendingTransfer.transactionReference && (
                <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "6px" }}>
                  TRX Ref: {pendingTransfer.transactionReference}
                </div>
              )}
              {pendingTransfer.rejectionReason && (
                <div style={{ fontSize: "0.8rem", color: "var(--danger)", background: "rgba(239,68,68,0.1)", padding: "6px 8px", borderRadius: "6px" }}>
                  Rejection Reason: {pendingTransfer.rejectionReason}
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
              Koi pending transfer submission nahi hai. Bank transfer ke baad proof yahan submit karein.
            </p>
          )}
        </div>

      </div>

      </>)}
      {(!section || section === "dashboard" || section === "workout") && (<>
      {workoutQueue.pending > 0 && <p role="status">{workoutQueue.pending} workout session(s) waiting to upload.</p>}
      {/* SECTION 5 & 6: Today's Workout & Assigned Trainer */}
      <div className={styles.overviewGrid}>
        
        {/* Today's Workout */}
        <div className={`glass-panel ${styles.workoutCard}`} style={{ padding: "24px" }}>
          <div className={styles.flexRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ padding: "8px", borderRadius: "8px", background: "var(--accent-soft)", color: "var(--accent-primary)" }}>
                <Dumbbell size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 600 }}>Today's Workout</h3>
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  {todayWorkout?.dayTitle || "Daily Training"}
                </span>
              </div>
            </div>

            {todayWorkout?.session && (
              <span className="badge badge-accent">
                {todayWorkout.session.status}
              </span>
            )}
          </div>

          {todayWorkout && todayWorkout.exercises.length > 0 ? (
            <div>
              <div style={{ marginBottom: "16px", maxHeight: "200px", overflowY: "auto" }}>
                {todayWorkout.exercises.map((ex, i) => (
                  <div className={styles.flexRow}
                    key={ex.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border-subtle)",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600 }}>{i + 1}. {ex.name}</span>
                      {ex.alternativeExercise && (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", display: "block" }}>
                          Alt: {ex.alternativeExercise}
                        </span>
                      )}
                    </div>
                    <div style={{ color: "var(--text-dim)", textAlign: "right" }}>
                      {ex.sets ? `${ex.sets} sets × ` : ""}
                      {ex.reps ? `${ex.reps} reps` : ""}
                      {ex.targetLoad ? ` @ ${ex.targetLoad}` : ""}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowWorkoutModal(true)}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  <Play size={16} /> {todayWorkout.session ? "Workout Results Edit Karein" : "Start / Log Workout"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-dim)" }}>
              <p style={{ fontSize: "0.9rem", marginBottom: "8px" }}>Workout plan abhi available nahi</p>
              <p style={{ fontSize: "0.75rem" }}>Aapke coach plan create aur publish karenge toh yahan aayega.</p>
            </div>
          )}
        </div>

        {/* Assigned Trainer */}
        <div className={`glass-panel ${styles.workoutCard}`} style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{ padding: "8px", borderRadius: "8px", background: "var(--purple-soft)", color: "var(--purple-primary)" }}>
              <UserCheck size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 600 }}>Assigned Trainer</h3>
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Personal Coaching</span>
            </div>
          </div>

          {trainer ? (
            <div>
              {trainer.isReassignmentPending && (
                <div style={{ background: "rgba(245,158,11,0.15)", color: "var(--amber-primary)", padding: "8px 12px", borderRadius: "8px", fontSize: "0.8rem", marginBottom: "12px" }}>
                  Trainer reassignment pending (Coach filhal inactive hain).
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "var(--purple-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.2rem",
                    fontWeight: 700,
                    color: "var(--purple-primary)",
                  }}
                >
                  {trainer.name.charAt(0)}
                </div>
                <div>
                  <h4 style={{ fontSize: "1.1rem", fontWeight: 600 }}>{trainer.name}</h4>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
                    Focus: {trainer.coachingFocus}
                  </div>
                </div>
              </div>

              <div style={{ background: "var(--bg-secondary)", padding: "12px", borderRadius: "8px", fontSize: "0.85rem" }}>
                <div style={{ color: "var(--text-dim)", marginBottom: "4px" }}>Assignment Start Date</div>
                <div style={{ fontWeight: 600 }}>
                  {new Date(trainer.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-dim)" }}>
              <p style={{ fontSize: "0.9rem", marginBottom: "8px" }}>Trainer not assigned</p>
              <p style={{ fontSize: "0.75rem" }}>Gym management se rabta karein taake trainer assign ho sake.</p>
            </div>
          )}
        </div>

      </div>

      </>)}
      {/* SECTION 7: Gym Announcements */}
      {(!section || section === "dashboard") && announcements && announcements.length > 0 && (
        <div className="glass-panel" style={{ padding: "24px", marginBottom: "32px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "16px" }}>Gym Announcements</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {announcements.map((a) => (
              <div
                key={a.id}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  padding: "14px 18px",
                  borderRadius: "10px",
                  borderLeft: a.pinned ? "4px solid var(--accent-primary)" : "1px solid var(--border-subtle)",
                }}
              >
                <div className={styles.flexRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {a.pinned && <span className="badge badge-accent">PINNED</span>}
                    <h4 style={{ fontWeight: 600 }}>{a.title}</h4>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                    {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", margin: 0 }}>{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      </>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: Request Renewal Modal                           */}
      {/* ========================================================= */}
      {showRenewalModal && (
        <ModalOverlay className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: "560px", padding: "28px" }}>
            <div className={styles.flexRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Request Membership Renewal</h3>
              <button className="btn btn-secondary" onClick={() => setShowRenewalModal(false)} style={{ padding: "6px" }}>
                <X size={18} />
              </button>
            </div>

            {renewalMessage && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  marginBottom: "16px",
                  background: renewalMessage.includes("Masla") ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                  color: renewalMessage.includes("Masla") ? "var(--danger)" : "#34d399",
                }}
              >
                {renewalMessage}
              </div>
            )}

            <form onSubmit={handleSubmitRenewal} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label className="field-label">Available Published Fee Plan *</label>
                <select
                  className="input-field"
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  required
                >
                  <option value="">Plan select karein...</option>
                  {data.availablePlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.durationValue} {p.durationUnit.toLowerCase()}) — Rs. {p.membershipFee.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label">Preferred Start Date *</label>
                <input
                  type="date"
                  className="input-field"
                  value={preferredStartDate}
                  onChange={(e) => setPreferredStartDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="field-label">Notes (Optional)</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={renewalNotes}
                  onChange={(e) => setRenewalNotes(e.target.value)}
                  placeholder="Koi khas request ya timing preference..."
                />
              </div>

              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", lineHeight: 1.4 }}>
                * Note: Request bhejne se membership fauran extend nahi hogi. Staff verification ke baad new period confirm hoga.
              </div>

              <button type="submit" className="btn btn-primary" disabled={renewalSubmitting} style={{ justifyContent: "center" }}>
                {renewalSubmitting ? "Submitting..." : "Submit Renewal Request"}
              </button>
            </form>

            {/* List of existing requests */}
            {myRenewals.length > 0 && (
              <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border-subtle)" }}>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "10px" }}>Previous Renewal Requests</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {myRenewals.map((r) => (
                    <div className={styles.flexRow}
                      key={r.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: "var(--bg-secondary)",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.feePlan?.name}</div>
                        <div style={{ color: "var(--text-dim)" }}>
                          Preferred: {new Date(r.preferredStartDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="badge badge-accent">{r.status}</span>
                        {r.status === "PENDING" && (
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleWithdrawRenewal(r.id)}
                            style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                          >
                            Withdraw
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* ========================================================= */}
      {/* MODAL 1B: Freeze Request Modal                            */}
      {/* ========================================================= */}
      {showFreezeModal && (
        <ModalOverlay className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: "520px", padding: "28px" }}>
            <div className={styles.flexRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Request Membership Freeze</h3>
                <p style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginTop: "2px" }}>
                  Bimari, travel ya kisi zaroori waja se membership temporary pause karein.
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowFreezeModal(false)} style={{ padding: "6px" }}>
                <X size={18} />
              </button>
            </div>

            {freezeMessage && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  marginBottom: "16px",
                  background: freezeMessage.includes("Masla") ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                  color: freezeMessage.includes("Masla") ? "var(--danger)" : "#34d399",
                }}
              >
                {freezeMessage}
              </div>
            )}

            <form onSubmit={handleFreezeSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label className="field-label">Requested Freeze Days * (1 - {data.freezePolicy?.maxDays ?? 30})</label>
                <input
                  type="number"
                  min="1"
                  max={data.freezePolicy?.maxDays ?? 30}
                  className="input-field"
                  value={freezeDays}
                  onChange={(e) => setFreezeDays(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="field-label">Reason for Freeze *</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  placeholder="e.g. Exam leave, Medical bed rest, Official travel..."
                  required
                />
              </div>

              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", lineHeight: 1.4 }}>
                * Policy: Management approval ke baad membership freeze hogi aur unfreeze hone par valid din barh jayenge.
              </div>

              <button type="submit" className="btn btn-primary" disabled={freezeSubmitting} style={{ justifyContent: "center" }}>
                {freezeSubmitting ? "Submitting..." : "Submit Freeze Request"}
              </button>
            </form>

            {myFreezeRequests.length > 0 && (
              <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border-subtle)" }}>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "10px" }}>Previous Freeze Requests</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "160px", overflowY: "auto" }}>
                  {myFreezeRequests.map((fr) => (
                    <div className={styles.flexRow}
                      key={fr.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: "var(--bg-secondary)",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{fr.requestedDays} Din Freeze ({fr.reason})</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                          {new Date(fr.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span
                        className={`badge ${
                          fr.status === "APPROVED"
                            ? "badge-success"
                            : fr.status === "REJECTED"
                            ? "badge-danger"
                            : "badge-warning"
                        }`}
                      >
                        {fr.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: Transfer Proof Submission Modal                 */}
      {/* ========================================================= */}
      {showTransferModal && (
        <ModalOverlay className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: "520px", padding: "28px" }}>
            <div className={styles.flexRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Submit Bank Transfer Proof</h3>
              <button className="btn btn-secondary" onClick={() => setShowTransferModal(false)} style={{ padding: "6px" }}>
                <X size={18} />
              </button>
            </div>

            {transferMessage && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  marginBottom: "16px",
                  background: transferMessage.includes("Masla") ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                  color: transferMessage.includes("Masla") ? "var(--danger)" : "#34d399",
                }}
              >
                {transferMessage}
              </div>
            )}

            <form onSubmit={handleSubmitTransfer} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label className="field-label">Gym Receiving Account *</label>
                <select
                  className="input-field"
                  value={transferAccountId}
                  onChange={(e) => setTransferAccountId(e.target.value)}
                  required
                >
                  <option value="">Account muntakhib karein...</option>
                  {data.receivingAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.displayName} ({acc.accountTitle} - {acc.accountNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label">Transfer Amount (PKR) *</label>
                <input
                  type="number"
                  className="input-field"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="field-label">Bank Transaction / TRX Reference</label>
                <input
                  type="text"
                  className="input-field"
                  value={transferRef}
                  onChange={(e) => setTransferRef(e.target.value)}
                  placeholder="e.g. TRX982736152 or Meezan Ref ID"
                />
              </div>

              <div>
                <label className="field-label">Transfer receipt / screenshot *</label>
                <CloudinaryUploadButton
                  folder="transfers"
                  currentUrl={transferProofUrl}
                  label="Upload transfer receipt"
                  onUploadSuccess={(data) => setTransferProofUrl(data.url)}
                />
              </div>

              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", lineHeight: 1.4 }}>
                * Transfer proof submit karne par status PENDING ho jayega. Reception staff verification ke baad dues update hongi.
              </div>

              <button type="submit" className="btn btn-primary" disabled={transferSubmitting} style={{ justifyContent: "center" }}>
                {transferSubmitting ? "Submitting..." : "Submit Proof for Verification"}
              </button>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: Start / Log Workout Session Modal               */}
      {/* ========================================================= */}
      {showWorkoutModal && todayWorkout && (
        <ModalOverlay className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: "680px", padding: "28px" }}>
            <div className={styles.flexRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Log Workout Execution</h3>
                <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>{todayWorkout.dayTitle}</span>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowWorkoutModal(false)} style={{ padding: "6px" }}>
                <X size={18} />
              </button>
            </div>

            {workoutMessage && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  marginBottom: "16px",
                  background: workoutMessage.includes("Masla") ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                  color: workoutMessage.includes("Masla") ? "var(--danger)" : "#34d399",
                }}
              >
                {workoutMessage}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "360px", overflowY: "auto", marginBottom: "16px" }}>
              {todayWorkout.exercises.map((ex, i) => {
                const log = workoutLogs[ex.id] || { reps: "10", load: "0", skipped: false, reason: "Equipment unavailable" };
                return (
                  <div
                    key={ex.id}
                    style={{
                      background: log.skipped ? "rgba(239,68,68,0.05)" : "var(--bg-secondary)",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: log.skipped ? "1px solid rgba(239,68,68,0.2)" : "1px solid var(--border-subtle)",
                    }}
                  >
                    <div className={styles.flexRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontWeight: 600 }}>{i + 1}. {ex.name}</span>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={log.skipped}
                          onChange={(e) => {
                            setWorkoutLogs((prev) => ({
                              ...prev,
                              [ex.id]: { ...log, skipped: e.target.checked },
                            }));
                          }}
                        />
                        Skip Exercise
                      </label>
                    </div>

                    {log.skipped ? (
                      <div>
                        <label className="field-label" style={{ fontSize: "0.75rem" }}>Skip Reason</label>
                        <select
                          className="input-field"
                          value={log.reason}
                          onChange={(e) => {
                            setWorkoutLogs((prev) => ({
                              ...prev,
                              [ex.id]: { ...log, reason: e.target.value },
                            }));
                          }}
                          style={{ padding: "6px", fontSize: "0.8rem" }}
                        >
                          <option value="Equipment unavailable">Equipment unavailable</option>
                          <option value="Discomfort">Discomfort / Pain</option>
                          <option value="Time shortage">Time shortage</option>
                        </select>
                      </div>
                    ) : (
                      <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div>
                          <label className="field-label" style={{ fontSize: "0.75rem" }}>
                            Actual Reps (Target: {ex.reps || "10"})
                          </label>
                          <input
                            type="number"
                            className="input-field"
                            value={log.reps}
                            onChange={(e) => {
                              setWorkoutLogs((prev) => ({
                                ...prev,
                                [ex.id]: { ...log, reps: e.target.value },
                              }));
                            }}
                            style={{ padding: "6px" }}
                          />
                        </div>
                        <div>
                          <label className="field-label" style={{ fontSize: "0.75rem" }}>
                            Actual Weight / Load (Target: {ex.targetLoad || "0 kg"})
                          </label>
                          <input
                            type="number"
                            className="input-field"
                            value={log.load}
                            onChange={(e) => {
                              setWorkoutLogs((prev) => ({
                                ...prev,
                                [ex.id]: { ...log, load: e.target.value },
                              }));
                            }}
                            style={{ padding: "6px" }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label className="field-label">Duration (Minutes)</label>
                <input
                  type="number"
                  className="input-field"
                  value={workoutDuration}
                  onChange={(e) => setWorkoutDuration(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Member Notes / How it felt</label>
                <input
                  type="text"
                  className="input-field"
                  value={workoutNotes}
                  onChange={(e) => setWorkoutNotes(e.target.value)}
                  placeholder="Energy level, form, soreness..."
                />
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleFinishWorkout}
              disabled={workoutSubmitting}
              style={{ width: "100%", justifyContent: "center" }}
            >
              <Check size={16} /> {workoutSubmitting ? "Saving..." : "Finish Workout & Save Session"}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* Feature 20: Notification Inbox Modal */}
      {showNotificationModal && (
        <NotificationInboxModal
          onClose={() => {
            setShowNotificationModal(false);
            // Refresh count
            apiFetch("/api/v1/member/notifications?unreadOnly=true&limit=1")
              .then((r) => r.json())
              .then((j) => {
                if (j.success && typeof j.data?.unreadCount === "number") {
                  setUnreadNotifCount(j.data.unreadCount);
                }
              })
              .catch(() => {});
          }}
          onNavigateTab={(tab: string) => setActiveTab(tab as any)}
        />
      )}
    </div>
  );
}
