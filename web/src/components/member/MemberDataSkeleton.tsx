import styles from "./MemberPages.module.css";

export default function MemberDataSkeleton({ rows = 3 }: { rows?: number }) {
  return <div className={styles.skeletonContent} aria-hidden="true">
    <span className={`${styles.skeleton} ${styles.skeletonTitle}`} />
    {Array.from({ length: rows }, (_, index) => <div key={index} className={styles.skeletonRow}><span className={styles.skeleton} /><span className={`${styles.skeleton} ${styles.skeletonShort}`} /></div>)}
  </div>;
}
