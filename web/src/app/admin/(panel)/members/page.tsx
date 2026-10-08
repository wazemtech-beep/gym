import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { Role } from "@prisma/client";
import Sidebar from "@/components/layout/Sidebar";
import TopHeader from "@/components/layout/TopHeader";
import MembersDirectoryClient from "@/components/members/MembersDirectoryClient";
import RenewalRequestsQueue from "@/components/members/RenewalRequestsQueue";
import RegistrationRequestsQueue from "@/components/members/RegistrationRequestsQueue";

export default async function OwnerMembersPage() {
  const current = await getCurrentSession();

  if (!current) {
    redirect("/admin/login");
  }

  // Access allowed for Owner & Receptionist (Point 11)
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
          {current.user.role === Role.OWNER && <RegistrationRequestsQueue />}
          <RenewalRequestsQueue />
          <MembersDirectoryClient />
        </main>
      </div>
    </div>
  );
}
