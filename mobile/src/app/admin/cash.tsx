import { Text } from "react-native";
import {
  Card,
  ErrorNotice,
  Heading,
  LoadingCard,
  Screen,
  styles,
} from "../../components/ui";
import { ActionForm } from "../../components/staff/ActionForm";
import { text } from "../../components/staff/adminConfig";
import { Back, Details, type Row } from "../../components/staff/common";
import { useStaffQuery } from "../../hooks/staff";

export default function Cash() {
  const query = useStaffQuery<Row>("/api/v1/reception/dashboard"),
    session = query.data?.activeCashSession;
  return (
    <Screen>
      <Back home="/admin" />
      <Heading>Cash session</Heading>
      <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      {!query.data ? (
        <LoadingCard title="Your cash drawer" />
      ) : session ? (
        <>
          <Card title="Open drawer">
            <Details
              data={session}
              fields={[
                "sessionNumber",
                "openedAt",
                "openingCash",
                "expectedCash",
              ]}
            />
            <Text style={styles.muted}>
              Count the actual cash before closing.
            </Text>
          </Card>
          <ActionForm
            key={session.id}
            operation={{
              title: "Close cash session",
              path: "/api/v1/cash-session/close",
              fixed: { sessionId: session.id },
              fields: [
                text("countedCash", "Counted cash", true, "number"),
                text("differenceReason", "Difference reason"),
              ],
              confirm: "Close this cash session with the entered count?",
            }}
          />
        </>
      ) : (
        <ActionForm
          operation={{
            title: "Open cash session",
            path: "/api/v1/cash-session/open",
            fields: [text("openingCash", "Opening cash", true, "number")],
          }}
        />
      )}
    </Screen>
  );
}
