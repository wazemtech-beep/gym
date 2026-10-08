"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Menu, X, Settings } from "lucide-react";
import MemberNavigation from "./MemberNavigation";
import styles from "./MemberShell.module.css";

type MemberUser = { name: string; memberId?: string | null };
const titles: Record<string, string> = { dashboard: "Home", membership: "Membership", payments: "Payments", workout: "Workout", diet: "Diet", progress: "Progress", profile: "Profile", notifications: "Updates", attendance: "Attendance", settings: "Settings" };

export default function MemberShell({ user, children }: { user: MemberUser; children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const title = titles[pathname.split("/")[1]] || "Member area";
  return <div className={styles.shell}>
    <aside id="member-sidebar" className={`${styles.sidebar} ${menuOpen ? styles.open : ""}`}>
      <Link href="/dashboard" className={styles.brand} onClick={() => setMenuOpen(false)}><span className="brand-mark"><Dumbbell size={22} /></span><span className="brand-name">OXGEN GYM</span></Link>
      <MemberNavigation onNavigate={() => setMenuOpen(false)} />
      <div className={styles.sidebarFooter}><span className={styles.avatar} aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.memberId || "Member"}</small></div></div>
    </aside>
    <header className={styles.header}>
      <div className={styles.headerTitle}><button type="button" className={styles.menuButton} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="member-sidebar" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button><span>{title}</span></div>
      <div className={styles.headerActions}><Link href="/settings" className={styles.settingsLink} aria-label="Account settings"><Settings size={18} /></Link><Link href="/profile" className={styles.profileLink}><span className={styles.avatar} aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span><span>{user.name}</span></Link></div>
    </header>
    <main className={styles.main}>{children}</main>
  </div>;
}
