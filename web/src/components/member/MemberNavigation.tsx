"use client";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, CreditCard, Wallet, Dumbbell, Utensils, TrendingUp, UserRound, Bell, CalendarCheck, Settings } from "lucide-react";
import styles from "./MemberShell.module.css";

const links = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/membership", label: "Membership", icon: CreditCard },
  { href: "/payments", label: "Payments", icon: Wallet },
  { href: "/workout", label: "Workout", icon: Dumbbell },
  { href: "/diet", label: "Diet", icon: Utensils },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/notifications", label: "Updates", icon: Bell },
];
export default function MemberNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const readCacheVersion = useReadCacheVersion();
  const pathname = usePathname();
  const [attendanceEnabled, setAttendanceEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    apiFetch("/api/v1/settings").then(response => response.json()).then(json => { if (alive && json.success) setAttendanceEnabled(Boolean(json.settings?.attendanceEnabled)); }).catch(() => {});
    return () => { alive = false; };
  }, [readCacheVersion]);
  const items = [...links, ...(attendanceEnabled ? [{ href: "/attendance", label: "Attendance", icon: CalendarCheck }] : []), { href: "/settings", label: "Settings", icon: Settings }];
  return <nav className={styles.nav} aria-label="Member navigation">{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={onNavigate} aria-current={pathname === href || pathname.startsWith(href + "/") ? "page" : undefined} className={styles.navLink}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></Link>)}</nav>;
}
