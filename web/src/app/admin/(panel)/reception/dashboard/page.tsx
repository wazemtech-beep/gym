import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { Role } from "@prisma/client";
import TopNav from "@/components/layout/TopNav";
import ReceptionDashboardClient from "@/components/reception/ReceptionDashboardClient";

export default async function ReceptionDashboardPage() {
  const current = await getCurrentSession();

  if (!current) {
    redirect("/admin/login");
  }

  // Only RECEPTIONIST and OWNER can access reception portal
  if (current.user.role !== Role.RECEPTIONIST && current.user.role !== Role.OWNER) {
    redirect("/");
  }

  if (current.user.mustChangePassword) {
    redirect("/auth/change-password");
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopNav user={current.user} />
      <main className="portal-main">
        <ReceptionDashboardClient user={current.user} />
      </main>
    </div>
  );
}
