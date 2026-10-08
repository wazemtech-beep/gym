import MemberPage from "@/components/member/MemberPage";
import { requireMemberSession } from "@/lib/portalSession";
import DietPlanSection from "@/components/member/DietPlanSection";
export default async function DietPage() { await requireMemberSession(); return <MemberPage title="Your diet"><DietPlanSection /></MemberPage>; }
