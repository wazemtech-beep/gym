import { Text, View, RefreshControl } from "react-native";
import {
  Card,
  ErrorNotice,
  Heading,
  LoadingCard,
  Screen,
  styles,
} from "../../components/ui";
import { Details, Nav, type Row } from "../../components/staff/common";
import { useStaffQuery } from "../../hooks/staff";
import { useSession } from "../../providers/session";
import {
  sections,
  sectionPermissions,
} from "../../components/staff/adminConfig";

export default function AdminHome() {
  const { user } = useSession(),
    owner = user?.role === "OWNER";
  const query = useStaffQuery<Row>(
    owner
      ? "/api/v1/dashboard/collection?period=today"
      : "/api/v1/reception/dashboard",
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
        <Heading>{owner ? "Gym dashboard" : "Reception"}</Heading>
        <Nav href="/staff-account" title="Account" />
      </View>
      <Text style={styles.muted}>{user?.name}</Text>
      <Nav href="/admin/updates" title="Updates" />
      <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      {!query.data ? (
        <LoadingCard title="Today’s overview" />
      ) : (
        <Card title="Today’s overview">
          <Details
            data={query.data.metrics || query.data.stats}
            fields={
              owner
                ? [
                    "activeMembersCount",
                    "netCollection",
                    "totalOutstandingDues",
                    "totalOverdue",
                    "pendingTransfersCount",
                    "expiringMembershipsCount",
                  ]
                : [
                    "todayMyCash",
                    "todayMyTotal",
                    "todayMyReceiptsCount",
                    "todayTotalCheckIns",
                    "pendingTransfersCount",
                    "drawerExpectedCash",
                  ]
            }
          />
        </Card>
      )}
      <Card title="Manage gym">
        {Object.entries(sections)
          .filter(
            ([key, config]) =>
              (!config.owner || owner) &&
              (owner ||
                !sectionPermissions[key] ||
                user?.permissions?.[sectionPermissions[key]] !== false),
          )
          .map(([key, config]) => (
            <Nav
              key={key}
              href={{ pathname: "/admin/[section]", params: { section: key } }}
              title={config.title}
            />
          ))}
        {owner && (
          <>
            <Nav href="/admin/reports" title="Reports" />
            <Nav href="/admin/settings" title="Gym settings" />
          </>
        )}
        <Nav href="/admin/cash" title="Cash session" />
      </Card>
    </Screen>
  );
}
