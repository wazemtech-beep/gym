import type { ReactNode } from "react";
import styles from "./MemberPage.module.css";

export default function MemberPage({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return <div className={styles.page}><header className={styles.heading}><h1>{title}</h1>{actions && <div className={styles.actions}>{actions}</div>}</header><div className={styles.content}>{children}</div></div>;
}
