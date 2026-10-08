import { cachedServerRead, readCacheScope } from "@/lib/serverReadCache";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getGymSettings } from "@/lib/settings";
import Sidebar from "@/components/layout/Sidebar";
import TopHeader from "@/components/layout/TopHeader";
import SettingsClient from "@/components/settings/SettingsClient";

export const metadata = {
  title: "Settings & Audit History | OXGEN GYM",
  description: "Configure gym details, payment accounts, staff permissions, and review the audit history.",
};

export default async function OwnerSettingsPage() {
  const current = await getCurrentSession();

  if (!current) {
    redirect("/admin/login");
  }

  // Settings & System Governance is strictly restricted to Owner
  if (current.user.role !== Role.OWNER) {
    redirect("/");
  }

  if (current.user.mustChangePassword) {
    redirect("/auth/change-password");
  }

  // Load initial settings and related data
  const settings = await getGymSettings();

  const paymentAccounts = await cachedServerRead("app/admin/(panel)/settings/page.tsx:prisma.receivingAccount.findMany:1067", () => prisma.receivingAccount.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  }), readCacheScope(current), {
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  const staffList = await prisma.user.findMany({
    where: { role: { in: [Role.RECEPTIONIST, Role.TRAINER] } },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      permissionGrants: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="app-shell">
      <Sidebar user={current.user} />
      <div className="app-content">
        <TopHeader userName={current.user.name} />
        <main className="app-main">
          <SettingsClient
            initialSettings={JSON.parse(JSON.stringify(settings))}
            initialPaymentAccounts={JSON.parse(JSON.stringify(paymentAccounts))}
            initialStaffList={JSON.parse(JSON.stringify(staffList))}
            currentUser={{
              id: current.user.id,
              name: current.user.name,
              role: current.user.role,
            }}
          />
        </main>
      </div>
    </div>
  );
}
