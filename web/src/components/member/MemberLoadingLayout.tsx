import MemberDataSkeleton from "./MemberDataSkeleton";
import styles from "./MemberPages.module.css";

type Variant = "home" | "payments" | "membership" | "diet" | "progress" | "privacy" | "fitness";
const headings: Record<Variant, string[]> = {
  home: ["Membership", "Fees", "Today's workout", "Your trainer"],
  payments: ["Fee Summary", "Latest Payment", "Pending Transfer"],
  membership: ["Your membership"],
  diet: ["Diet Routine", "Diet change request", "Assigned meals"],
  progress: ["Progress Tracking & Metrics", "Progress over time", "Trainer access", "Measurements", "Progress photos"],
  privacy: ["Phone Read", "Cloud Storage", "Trainer Sharing", "Trainer Sharing & Date Boundary Setup", "Disconnect & Scoped Deletion Controls"],
  fitness: ["Fitness Data Connection", "Activity History & Trends", "Daily Steps Overview", "Recorded Exercise Sessions"],
};
export default function MemberLoadingLayout({ variant }: { variant: Variant }) {
  const card = (title: string, index: number) => <section key={title} className={`glass-panel ${styles.loadingPanel}`}>
    <h3>{title}</h3><MemberDataSkeleton rows={(variant === "privacy" && index < 3) || (index === 0 && ["diet", "progress", "fitness"].includes(variant)) ? 1 : 3} />
  </section>;
  return <div className={styles.loadingStack} aria-busy="true"><span className={styles.srOnly} role="status">Loading {variant} details…</span>
    {variant === "privacy" ? <>
      <h2>Privacy &amp; Fitness Data Controls</h2>
      <div className={styles.loadingPrivacyGrid}>{headings.privacy.slice(0, 3).map(card)}</div>
      {headings.privacy.slice(3).map(card)}
    </> : variant === "home" ? <>
      <div className={styles.overviewGrid}>{headings.home.slice(0, 2).map(card)}</div>
      <div className={styles.overviewGrid}>{headings.home.slice(2).map(card)}</div>
    </> : variant === "payments" ? <>
      {card(headings.payments[0], 0)}
      <div className={styles.overviewGrid}>{headings.payments.slice(1).map(card)}</div>
    </> : variant === "fitness" ? <>
      {card(headings.fitness[0], 0)}<h2>Activity History &amp; Trends</h2>
      <div className={styles.loadingMetricGrid}>{["Total Steps", "Recorded Distance", "Active Calories", "Exercise Sessions"].map(title => <section key={title} className={`glass-panel ${styles.loadingMetric}`}><h3>{title}</h3><MemberDataSkeleton rows={0} /></section>)}</div>
      {headings.fitness.slice(2).map(card)}
    </> : <div className={styles.loadingStack}>{headings[variant].map(card)}</div>}
  </div>;
}
