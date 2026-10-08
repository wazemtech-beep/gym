import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentSession();
  if (!current) redirect("/admin/login");
  if (!["OWNER", "RECEPTIONIST", "TRAINER"].includes(current.user.role)) redirect("/dashboard");
  if (current.user.mustChangePassword) redirect("/auth/change-password");
  return children;
}
