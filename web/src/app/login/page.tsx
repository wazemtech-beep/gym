import { redirect } from "next/navigation";
import MemberLoginForm from "@/components/member/MemberLoginForm";
import { getCurrentSession } from "@/lib/session";
import { dashboardForRole } from "@/lib/portalRoutes";

export default async function MemberLoginPage({ searchParams }: { searchParams: Promise<{ reason?: string; emailVerified?: string }> }) {
  const current = await getCurrentSession();
  if (current) redirect(current.user.mustChangePassword ? "/auth/change-password" : dashboardForRole(current.user.role));
  const query = await searchParams;
  const notice = query.emailVerified === "1" ? "Email verify ho gaya. Naye email se sign in karein." : query.reason === "session" ? "Session expire ya revoke ho gaya. Dobara sign in karein." : undefined;
  return <MemberLoginForm notice={notice} />;
}
