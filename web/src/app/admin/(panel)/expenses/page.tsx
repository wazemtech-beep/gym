import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { Role } from "@prisma/client";
import Sidebar from "@/components/layout/Sidebar";
import TopHeader from "@/components/layout/TopHeader";
import ExpensesDirectoryClient from "@/components/expenses/ExpensesDirectoryClient";

export default async function OwnerExpensesPage() {
  const current = await getCurrentSession();

  if (!current) {
    redirect("/admin/login");
  }

  // Access allowed for Owner & Receptionist (Point 11.9)
  if (current.user.role !== Role.OWNER && current.user.role !== Role.RECEPTIONIST) {
    redirect("/");
  }

  if (current.user.mustChangePassword) {
    redirect("/auth/change-password");
  }

  return (
    <div className="app-shell">
      <Sidebar user={current.user} />
      <div className="app-content">
        <TopHeader userName={current.user.name} />
        <main className="app-main">
          <ExpensesDirectoryClient
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
