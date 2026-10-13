import { useLocalSearchParams } from "expo-router";
import { PlanEditor } from "../../../components/staff/PlanEditor";
import { useSession } from "../../../providers/session";
import { ErrorNotice, Screen } from "../../../components/ui";
export default function Plan() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind: string }>(),
    { user } = useSession();
  return user?.role === "OWNER" ? (
    <PlanEditor key={id + kind} id={id} kind={kind} admin />
  ) : (
    <Screen>
      <ErrorNotice error="Owner access required." />
    </Screen>
  );
}
