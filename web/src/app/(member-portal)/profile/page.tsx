import { requireMemberSession } from "@/lib/portalSession";
import MemberPage from "@/components/member/MemberPage";
import MemberProfileSections from "@/components/member/MemberProfileSections";

export default async function ProfilePage() {
  await requireMemberSession();
  return <MemberPage title="Your profile"><MemberProfileSections /></MemberPage>;
}
