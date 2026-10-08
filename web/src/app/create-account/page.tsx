import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { dashboardForRole } from "@/lib/portalRoutes";
import MemberRegistrationForm from "@/components/member/MemberRegistrationForm";
export default async function CreateAccountPage() {
  const current = await getCurrentSession();
  if (current) redirect(current.user.mustChangePassword ? "/auth/change-password" : dashboardForRole(current.user.role));
  return <MemberRegistrationForm />;
}
