import MemberPage from "@/components/member/MemberPage";
import { requireMemberSession } from "@/lib/portalSession";
import MemberSettings from "@/components/member/MemberSettings";

export default async function SettingsPage() {
  const current = await requireMemberSession();
  return <MemberPage title="Settings"><MemberSettings email={current.user.email} /></MemberPage>;
}
