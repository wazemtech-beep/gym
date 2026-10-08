import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { dashboardForRole } from "@/lib/portalRoutes";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

export async function requireMemberSession() {
  const current = await getCurrentSession();
  if (!current) {
    const hadSession = (await cookies()).has(SESSION_COOKIE_NAME);
    redirect(hadSession ? "/login?reason=session" : "/login");
  }
  if (current.user.role !== "MEMBER") redirect(dashboardForRole(current.user.role));
  if (current.user.mustChangePassword) redirect("/auth/change-password");
  return current;
}
