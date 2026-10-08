import { requireMemberSession } from "@/lib/portalSession";
import MemberHomeDashboard from "@/components/member/MemberHomeDashboard";

export default async function DashboardPage() {
  const current = await requireMemberSession();
  return <MemberHomeDashboard name={current.user.name} />;
}
