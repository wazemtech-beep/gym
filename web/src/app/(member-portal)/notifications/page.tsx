import MemberPage from "@/components/member/MemberPage";
import { requireMemberSession } from "@/lib/portalSession";
import MemberNotificationCenter from "@/components/member/MemberNotificationCenter";
export default async function NotificationsPage() { await requireMemberSession(); return <MemberPage title="Your updates"><MemberNotificationCenter /></MemberPage>; }
