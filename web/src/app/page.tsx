import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { Role } from "@prisma/client";

export default async function HomePage() {
  const current = await getCurrentSession();

  if (!current) {
    redirect("/login");
  }

  if (current.user.mustChangePassword) {
    redirect("/auth/change-password");
  }

  switch (current.user.role) {
    case Role.OWNER:
      redirect("/admin/dashboard");
    case Role.RECEPTIONIST:
      redirect("/admin/reception/dashboard");
    case Role.TRAINER:
      redirect("/admin/trainer/dashboard");
    case Role.MEMBER:
      redirect("/dashboard");
    default:
      redirect("/login");
  }
}
