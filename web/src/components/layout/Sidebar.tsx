"use client";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  DollarSign,
  Receipt,
  TrendingDown,
  BarChart3,
  CalendarCheck,
  Settings,
  LogOut,
  Dumbbell,
} from "lucide-react";
import { Role } from "@prisma/client";
import { dashboardForRole } from "@/lib/portalRoutes";

interface SidebarProps {
  user: {
    id: string;
    name: string;
    email: string | null;
    role: Role;
  };
}

export default function Sidebar({ user }: SidebarProps) {
  const readCacheVersion = useReadCacheVersion();
  const pathname = usePathname();
  const [attendanceEnabled, setAttendanceEnabled] = useState(false);
  useEffect(() => { let alive = true; apiFetch("/api/v1/settings").then(res => res.json()).then(data => { if (alive) setAttendanceEnabled(Boolean(data.settings?.attendanceEnabled)); }).catch(() => { if (alive) setAttendanceEnabled(false); }); return () => { alive = false; }; }, [pathname, readCacheVersion]);
  const router = useRouter();

  const handleLogout = async (allDevices = false) => {
    try {
      await apiFetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allDevices }),
      });
      router.push("/admin/login");
      router.refresh();
    } catch {
      router.push("/admin/login");
    }
  };

  const navItems = [
    { label: "Dashboard", href: dashboardForRole(user.role), icon: LayoutDashboard },
    { label: "Members", href: "/admin/members", icon: Users },
    { label: "Fee plans", href: "/admin/fee-plans", icon: CreditCard },
    { label: "Invoices & dues", href: "/admin/invoices", icon: FileText },
    { label: "Payments", href: "/admin/payments", icon: DollarSign },
    { label: "Receipts", href: "/admin/receipts", icon: Receipt },
    { label: "Expenses", href: "/admin/expenses", icon: TrendingDown },
    { label: "Reports", href: "/admin/reports", icon: BarChart3 },
    { label: "Attendance", href: "/admin/attendance", icon: CalendarCheck },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ];

  return (
    <aside className="sidebar">
      <Link href={dashboardForRole(user.role)} className="sidebar-brand">
        <span className="brand-mark"><Dumbbell size={22} strokeWidth={1.8} /></span>
        <span className="brand-name">OXGEN GYM</span>
      </Link>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navItems.filter(item => (user.role !== Role.TRAINER || item.label === "Dashboard") && (user.role === Role.OWNER || item.label !== "Settings") && (item.href !== "/admin/attendance" || attendanceEnabled)).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} className={"sidebar-link" + (isActive ? " is-active" : "")} aria-current={isActive ? "page" : undefined}>
              <Icon size={17} strokeWidth={1.7} /><span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <button className="btn-secondary" onClick={() => handleLogout(true)}>Sign out all devices</button>
      <div className="sidebar-footer">
        <span className="user-avatar">{user.name.charAt(0)}</span>
        <div className="sidebar-user"><strong>{user.name}</strong><small>{user.role.toLowerCase()}</small></div>
        <button onClick={() => handleLogout(false)} className="icon-button" title="Sign out" aria-label="Sign out"><LogOut size={16} /></button>
      </div>
    </aside>
  );
}
