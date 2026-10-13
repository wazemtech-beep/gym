import { useLocalSearchParams } from "expo-router";
import { PlanEditor } from "../../../components/staff/PlanEditor";
export default function Plan() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind: string }>();
  return <PlanEditor key={id + kind} id={id} kind={kind} />;
}
