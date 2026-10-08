import { requireMemberSession } from "@/lib/portalSession";
import MemberShell from "@/components/member/MemberShell";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const current = await requireMemberSession();
  return <MemberShell user={current.user}>{children}</MemberShell>;
}
