import { useLocalSearchParams } from "expo-router";
import { CoachMember } from "../../../components/staff/CoachMember";
import { useSession } from "../../../providers/session";
import { ErrorNotice, Screen } from "../../../components/ui";
export default function Coaching() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { user } = useSession();
  return user?.role === "OWNER" ? (
    <CoachMember key={id} id={id} admin />
  ) : (
    <Screen>
      <ErrorNotice error="Owner access required." />
    </Screen>
  );
}
