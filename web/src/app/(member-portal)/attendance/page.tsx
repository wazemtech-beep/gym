import MemberPage from "@/components/member/MemberPage";
import { requireMemberSession } from "@/lib/portalSession";
import MemberHistory from "@/components/member/MemberHistory";
export default async function AttendancePage() { await requireMemberSession(); return <MemberPage title="Your attendance"><MemberHistory section="attendance" /></MemberPage>; }
