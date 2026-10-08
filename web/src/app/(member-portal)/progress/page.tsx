import MemberPage from "@/components/member/MemberPage";
import { requireMemberSession } from "@/lib/portalSession";
import ProgressTrackingSection from "@/components/member/ProgressTrackingSection";
export default async function ProgressPage() { await requireMemberSession(); return <MemberPage title="Your progress"><ProgressTrackingSection /></MemberPage>; }
