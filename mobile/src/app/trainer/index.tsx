import { useState } from "react";
import { router } from "expo-router";
import { RefreshControl, Text, View } from "react-native";
import {
  Button,
  Card,
  ErrorNotice,
  Field,
  Heading,
  LoadingCard,
  Screen,
  styles,
} from "../../components/ui";
import { Details, Nav, type Row } from "../../components/staff/common";
import { useStaffQuery } from "../../hooks/staff";
import { useSession } from "../../providers/session";

export default function TrainerHome() {
  const { user } = useSession(),
    query = useStaffQuery<{ data: Row[] }>("/api/v1/trainer/members"),
    [search, setSearch] = useState("");
  const members = query.data?.data || [],
    filtered = members.filter((row) =>
      `${row.member.fullName} ${row.member.memberId}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
        />
      }
    >
      <View style={styles.row}>
        <Heading>Coach dashboard</Heading>
        <Nav href="/staff-account" title="Account" />
      </View>
      <Text style={styles.muted}>{user?.name}</Text>
      <Card title="Your team">
        <Text style={styles.text}>
          {query.data ? members.length : "…"} assigned members
        </Text>
        <Text style={styles.muted}>
          {query.data
            ? members.filter((row) => !row.member.activePlan).length
            : "…"}{" "}
          need a workout plan
        </Text>
      </Card>
      <Nav href="/trainer/updates" title="Updates" />
      <Field label="Find member" value={search} onChangeText={setSearch} />
      <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      {!query.data ? (
        <LoadingCard title="Assigned members" />
      ) : filtered.length ? (
        filtered.map((row) => (
          <Card key={row.assignmentId} title={row.member.fullName}>
            <Details
              data={row.member}
              fields={["memberId", "fitnessGoal", "limitations"]}
            />
            <Text style={styles.muted}>
              {row.member.activePlan?.title || "No published workout plan"}
            </Text>
            <Button
              secondary
              title="Open coaching profile"
              onPress={() =>
                router.push({
                  pathname: "/trainer/member/[id]",
                  params: { id: row.member.id },
                })
              }
            />
          </Card>
        ))
      ) : (
        <Card>
          <Text style={styles.muted}>No assigned members found.</Text>
        </Card>
      )}
    </Screen>
  );
}
