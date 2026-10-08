import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { dashboardForRole } from "@/lib/portalRoutes";

export default async function AdminHomePage() {
  const current = await getCurrentSession();
  if (!current) redirect("/admin/login");
  redirect(dashboardForRole(current.user.role));
}
