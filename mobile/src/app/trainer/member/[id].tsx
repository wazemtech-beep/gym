import { useLocalSearchParams } from "expo-router";
import { CoachMember } from "../../../components/staff/CoachMember";
export default function Member() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CoachMember key={id} id={id} />;
}
