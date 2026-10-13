import { useState } from "react";
import { Text } from "react-native";
import {
  Button,
  Card,
  ErrorNotice,
  Heading,
  LoadingCard,
  Screen,
  styles,
} from "../ui";
import { Back, Details, type Row } from "./common";
import { useStaffAction, useStaffQuery } from "../../hooks/staff";

export function StaffUpdates({ admin = false }: { admin?: boolean }) {
  const query = useStaffQuery<{
      data: { notifications: Row[]; unreadCount: number };
    }>("/api/v1/member/notifications?limit=50"),
    send = useStaffAction();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function read(id?: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await send(
        id
          ? `/api/v1/member/notifications/${id}/read`
          : "/api/v1/member/notifications/read-all",
        {},
        id ? "PATCH" : "POST",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Back home={admin ? "/admin" : "/trainer"} />
      <Heading>Updates</Heading>
      <ErrorNotice
        error={error || query.error}
        retry={() => void query.refetch()}
      />
      <Button
        secondary
        title="Mark all as read"
        busy={busy}
        disabled={!query.data?.data.unreadCount}
        onPress={() => void read()}
      />
      {!query.data ? (
        <LoadingCard title="Updates" />
      ) : query.data.data.notifications.length ? (
        query.data.data.notifications.map((row) => (
          <Card key={row.id} title={row.title}>
            <Details data={row} fields={["message", "createdAt", "category"]} />
            {!row.isRead && (
              <Button
                secondary
                title="Mark read"
                busy={busy}
                onPress={() => void read(row.id)}
              />
            )}
          </Card>
        ))
      ) : (
        <Card>
          <Text style={styles.muted}>No updates yet.</Text>
        </Card>
      )}
    </Screen>
  );
}
