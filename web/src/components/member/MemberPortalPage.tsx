import { requireMemberSession } from "@/lib/portalSession";
import MemberDashboardClient from "./MemberDashboardClient";
import MemberHistory from "./MemberHistory";
import styles from "./MemberPages.module.css";
import MemberPage from "./MemberPage";

export default async function MemberPortalPage({ section, title }: { section: "dashboard" | "membership" | "payments" | "workout"; title: string }) {
  await requireMemberSession();
  return <MemberPage title={title}><div className={styles.layout}><MemberDashboardClient key={section} section={section} />{section !== "dashboard" && <MemberHistory section={section} />}</div></MemberPage>;
}
