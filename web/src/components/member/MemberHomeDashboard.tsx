"use client";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Bell, CalendarDays, CheckCircle2, CreditCard, Dumbbell, RefreshCw, UserRound } from "lucide-react";
import NotificationInboxModal from "./NotificationInboxModal";
import styles from "./MemberHomeDashboard.module.css";
import MemberLoadingLayout from "./MemberLoadingLayout";

type DashboardData = {
  isSetupPending: boolean;
  member?: { fullName: string; memberId: string };
  membership: null | { planName: string; status: string; startDate: string; endDate: string; daysRemaining: number; isExpired: boolean; isExpiringSoon: boolean };
  feeSummary: { outstanding: number; overdue: number; upcomingInstallments: number; advanceBalance?: number };
  latestPayment: null | { id: string; receiptNumber: string; amount: number; paymentDate: string };
  pendingTransfer: null | { amount: number; status: string; rejectionReason?: string | null };
  todayWorkout: null | { planTitle: string; dayTitle: string; exercises: { id: string; name: string; sets?: number | null; reps?: string | null }[]; session?: { status: string } | null };
  trainer: null | { name: string; coachingFocus: string; isReassignmentPending: boolean };
  announcements: { id: string; title: string; content: string; pinned: boolean; createdAt: string }[];
  lastUpdated?: string;
};
const money = (value: number) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(value);
const date = (value: string) => new Date(value).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", day: "numeric", month: "short", year: "numeric" });
const statusLabels: Record<string, string> = { ACTIVE: "Active", FROZEN: "Frozen", EXPIRED: "Expired", UPCOMING: "Upcoming", CANCELLED: "Cancelled", NONE: "Not assigned" };

export default function MemberHomeDashboard({ name }: { name: string }) {
  const readCacheVersion = useReadCacheVersion();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [unread, setUnread] = useState(0);
  const [showInbox, setShowInbox] = useState(false);
  const request = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/v1/member/dashboard", { cache: "no-store" });
      if (controller.signal.aborted) return;
      if (response.status === 401 || response.status === 403) {
        setData(null);
        router.replace(response.status === 401 ? "/login?reason=session" : "/");
        return;
      }
      const json = await response.json();
      if (!response.ok || !json.success || !json.data) throw new Error(json.error || "Dashboard load nahi ho saka.");
      if (controller.signal.aborted) return;
      setData(json.data);
      // Inbox availability does not prevent the member's dashboard from loading.
      try {
        const notifications = await apiFetch("/api/v1/member/notifications?unreadOnly=true&limit=1", { cache: "no-store" });
        if (controller.signal.aborted) return;
        if (notifications.status === 401) { setData(null); router.replace("/login?reason=session"); return; }
        const inbox = await notifications.json();
        if (!controller.signal.aborted && notifications.ok && inbox.success) setUnread(inbox.data?.unreadCount || 0);
      } catch { /* The dashboard remains usable while inbox delivery is unavailable. */ }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof TypeError ? "Connection nahi ho saka. Dobara koshish karein." : cause instanceof Error ? cause.message : "Dashboard load nahi ho saka.");
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }, [router]);

  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === "visible" && navigator.onLine) void load(); };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { request.current?.abort(); window.clearInterval(timer); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load, readCacheVersion]);

  const membership = data?.membership;
  const workout = data?.todayWorkout;
  const completed = workout?.session?.status === "COMPLETED";
  const firstName = (data?.member?.fullName || name).split(" ")[0];
  const today = new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", weekday: "long", day: "numeric", month: "long" });

  return <div className={styles.dashboard}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>{today}</p><h1>Hi, {firstName}</h1>{data?.member && <p className={styles.subtle}>{data.member.memberId}</p>}</div>
      <div className={styles.actions}>
        <button className="btn btn-secondary" onClick={() => void load()} disabled={busy} aria-label="Refresh dashboard"><RefreshCw size={16} className={busy ? styles.spinning : undefined} /></button>
        <button className="btn btn-secondary" onClick={() => setShowInbox(true)}><Bell size={16} /> Updates{unread > 0 && <span className={styles.count}>{unread > 99 ? "99+" : unread}</span>}</button>
      </div>
    </header>
    {error && <div className={styles.notice} role="alert"><span>{error}</span><button className="btn btn-secondary" disabled={busy} onClick={() => void load()}>Retry</button></div>}
    {!data && busy && <MemberLoadingLayout variant="home" />}
    {data?.isSetupPending && <section className={styles.card}><h2>Your profile is being set up</h2><p className={styles.subtle}>Gym reception se member profile complete karwa lein.</p><Link href="/profile" className={styles.link}>View account <ArrowUpRight size={16} /></Link></section>}
    {data && !data.isSetupPending && <>
      {(membership?.isExpired || membership?.isExpiringSoon) && <div className={styles.notice}><span>{membership.isExpired ? "Your membership has expired." : `Your membership ends on ${date(membership.endDate)}.`}</span><Link href="/membership" className={styles.link}>Request renewal <ArrowUpRight size={16} /></Link></div>}
      <div className={styles.summary}>
        <section className={`${styles.card} ${styles.membership}`}>
          <div className={styles.cardHeading}><span className={styles.eyebrow}><CalendarDays size={16} /> Membership</span><span className={styles.badge}>{membership ? statusLabels[membership.status] || "Not assigned" : "Not assigned"}</span></div>
          <h2>{membership?.planName || "No package assigned"}</h2>
          {membership ? <><p className={styles.membershipValue}>{membership.status === "FROZEN" ? "On hold" : membership.status === "UPCOMING" ? `Starts ${date(membership.startDate)}` : membership.isExpired || membership.status === "CANCELLED" ? "Renew when you're ready" : <>{membership.daysRemaining}<small>days remaining</small></>}</p><p className={styles.subtle}>{membership.status === "FROZEN" ? "Validity resumes when your freeze ends." : `${membership.status === "UPCOMING" ? "Valid until" : "Expiry"}: ${date(membership.endDate)}`}</p></> : <p className={styles.subtle}>Reception can assign your gym package.</p>}
          <Link href="/membership" className={styles.link}>Membership details <ArrowUpRight size={16} /></Link>
        </section>
        <section className={styles.card}>
          <div className={styles.cardHeading}><span className={styles.eyebrow}><CreditCard size={16} /> Fees</span>{data.feeSummary.overdue > 0 && <span className={styles.warning}>Overdue</span>}</div>
          <p className={styles.metric}>{money(data.feeSummary.outstanding)}</p><p className={styles.subtle}>Outstanding balance</p>
          <dl className={styles.feeBreakdown}><div><dt>Overdue</dt><dd>{money(data.feeSummary.overdue)}</dd></div><div><dt>Upcoming dues</dt><dd>{money(data.feeSummary.upcomingInstallments)}</dd></div><div><dt>Advance credit</dt><dd>{money(data.feeSummary.advanceBalance || 0)}</dd></div></dl>
          <Link href="/payments" className={styles.link}>Payments & receipts <ArrowUpRight size={16} /></Link>
        </section>
      </div>
      <div className={styles.details}>
        <section className={styles.card}>
          <div className={styles.cardHeading}><span className={styles.eyebrow}><Dumbbell size={16} /> Today's workout</span>{completed && <span className={styles.badge}><CheckCircle2 size={14} /> Complete</span>}</div>
          <h2>{workout?.dayTitle || "No workout scheduled"}</h2>
          {workout ? <><p className={styles.subtle}>{workout.planTitle} · {workout.exercises.length} exercises</p><ul className={styles.exercises}>{workout.exercises.slice(0, 3).map(exercise => <li key={exercise.id}><span>{exercise.name}</span><small>{exercise.sets ? `${exercise.sets} sets` : ""}{exercise.reps ? ` · ${exercise.reps} reps` : ""}</small></li>)}</ul>{workout.exercises.length > 3 && <p className={styles.subtle}>+{workout.exercises.length - 3} more in your plan</p>}</> : <p className={styles.subtle}>Check your workout page for the assigned plan.</p>}
          <Link href="/workout" className="btn btn-primary">{completed ? "View workout" : workout ? "Open workout" : "View training"}<ArrowUpRight size={16} /></Link>
        </section>
        <section className={styles.card}>
          <p className={styles.eyebrow}><UserRound size={16} /> Your trainer</p>
          <h2>{data.trainer?.name || "Trainer not assigned"}</h2><p className={styles.subtle}>{data.trainer?.isReassignmentPending ? "Reception is arranging your next trainer." : data.trainer?.coachingFocus || "Contact reception for trainer assignment."}</p>
          
          {data.latestPayment && <div className={styles.receipt}><p className={styles.eyebrow}>Latest payment</p><strong>{money(data.latestPayment.amount)}</strong><p className={styles.subtle}>{date(data.latestPayment.paymentDate)} · {data.latestPayment.receiptNumber}</p><a href={`/api/v1/receipts/${encodeURIComponent(data.latestPayment.id)}/download`} className={styles.link}>Download receipt <ArrowUpRight size={16} /></a></div>}
        </section>
      </div>
      {data.pendingTransfer?.status === "PENDING" && <div className={styles.notice}><span>Transfer of {money(data.pendingTransfer.amount)} is awaiting verification.</span><Link href="/payments" className={styles.link}>View payment <ArrowUpRight size={16} /></Link></div>}
      {data.pendingTransfer?.status === "REJECTED" && <div className={styles.notice}><span>Transfer needs attention{data.pendingTransfer.rejectionReason ? `: ${data.pendingTransfer.rejectionReason}` : "."}</span><Link href="/payments" className={styles.link}>Review transfer <ArrowUpRight size={16} /></Link></div>}
      {data.announcements.length > 0 && <section className={styles.card}><h2>Gym updates</h2><div className={styles.updates}>{data.announcements.map(update => <article key={update.id}><div className={styles.cardHeading}><h3>{update.title}</h3>{update.pinned && <span className={styles.badge}>Pinned</span>}</div><p>{update.content}</p><time className={styles.subtle} dateTime={update.createdAt}>{date(update.createdAt)}</time></article>)}</div></section>}
      {data.lastUpdated && <p className={styles.updated}>Updated {new Date(data.lastUpdated).toLocaleTimeString("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" })}</p>}
    </>}
    {showInbox && <NotificationInboxModal onClose={() => { setShowInbox(false); void load(); }} />}
  </div>;
}
