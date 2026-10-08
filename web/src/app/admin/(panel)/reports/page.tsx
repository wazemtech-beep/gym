import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { Role } from "@prisma/client";
import Sidebar from "@/components/layout/Sidebar";
import TopHeader from "@/components/layout/TopHeader";
import ReportsDirectoryClient from "@/components/reports/ReportsDirectoryClient";

export default async function OwnerReportsPage() {
  const current = await getCurrentSession();

  if (!current) {
    redirect("/admin/login");
  }

  // Access allowed for Owner & Receptionist
  if (current.user.role !== Role.OWNER && current.user.role !== Role.RECEPTIONIST) {
    redirect("/");
  }

  if (current.user.mustChangePassword) {
    redirect("/auth/change-password");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-main)" }}>
      <Sidebar user={current.user} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <TopHeader userName={current.user.name} />
        <main style={{ padding: "32px", maxWidth: "1600px", margin: "0 auto", width: "100%" }}>
          <ReportsDirectoryClient
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
