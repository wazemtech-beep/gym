"use client";
import { apiFetch } from "@/lib/apiFetch";

import { useRouter } from "next/navigation";
import { Dumbbell, LogOut } from "lucide-react";
import { Role } from "@prisma/client";
import AccountEmailChange from "@/components/common/AccountEmailChange";
import { loginForRole } from "@/lib/portalRoutes";

interface TopNavProps {
  user: {
    id: string;
    name: string;
    email: string | null;
    memberId?: string | null;
    role: Role;
  };
}

export default function TopNav({ user }: TopNavProps) {
  const router = useRouter();

  const handleLogout = async (allDevices = false) => {
    try {
      await apiFetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allDevices }),
      });
      router.push(loginForRole(user.role));
      router.refresh();
    } catch {
      router.push(loginForRole(user.role));
    }
  };

  const getRoleBadgeClass = (role: Role) => {
    switch (role) {
      case Role.OWNER:
        return "badge badge-owner";
      case Role.RECEPTIONIST:
        return "badge badge-receptionist";
      case Role.TRAINER:
        return "badge badge-trainer";
      case Role.MEMBER:
        return "badge badge-member";
      default:
        return "badge";
    }
  };

  return (
    <header className="top-nav">
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}><span className="brand-mark"><Dumbbell size={22} /></span><div><h2 className="brand-name">OXGEN GYM</h2><span className="brand-caption">Your gym workspace</span></div></div>
      <div style={{ display: "flex", alignItems: "center", gap: 15, flexWrap: "wrap" }}>
        <div style={{ textAlign: "right" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><strong style={{ fontSize: ".84rem" }}>{user.name}</strong><span className={getRoleBadgeClass(user.role)}>{user.role}</span></div><span style={{ fontSize: ".73rem", color: "var(--text-muted)" }}>{user.memberId ? `ID: ${user.memberId}` : user.email}</span></div>
        <button id="logout-button" onClick={() => handleLogout(false)} className="btn-secondary" title="Logout Current Session"><LogOut size={16} /><span>Logout</span></button>
        <button onClick={() => handleLogout(true)} className="btn-secondary">Logout all devices</button>
        <AccountEmailChange />
      </div>
    </header>
  );
}
