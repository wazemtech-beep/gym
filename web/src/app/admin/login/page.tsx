import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { getCurrentSession } from "@/lib/session";
import { dashboardForRole } from "@/lib/portalRoutes";

export default async function AdminLoginPage() {
  const current = await getCurrentSession();
  if (current) redirect(current.user.mustChangePassword ? "/auth/change-password" : dashboardForRole(current.user.role));
  return <LoginForm portal="admin" />;
}
