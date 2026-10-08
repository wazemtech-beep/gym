import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { Role } from "@prisma/client";
import TopNav from "@/components/layout/TopNav";
import TrainerDashboardClient from "@/components/trainer/TrainerDashboardClient";

export default async function TrainerDashboardPage() {
  const current = await getCurrentSession();

  if (!current) {
    redirect("/admin/login");
  }

  // Only TRAINER and OWNER can access trainer portal
  if (current.user.role !== Role.TRAINER && current.user.role !== Role.OWNER) {
    redirect("/");
  }

  if (current.user.mustChangePassword) {
    redirect("/auth/change-password");
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopNav user={current.user} />

      <main className="portal-main">
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span className="badge badge-trainer">Certified Trainer</span>
            <span style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
              Personal Training & Coaching
            </span>
          </div>
          <h1 style={{ fontSize: "2rem" }}>Khush Amdeed Coach, {current.user.name}</h1>
          <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
            Aapke assigned members ki fitness progression, workout programmes aur execution logs.
          </p>
        </div>

        {/* Trainer Portal Client */}
        <TrainerDashboardClient />
      </main>
    </div>
  );
}
