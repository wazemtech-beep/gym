import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Image, RefreshControl, Text, View } from "react-native";
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
import { Back, Details, type Row } from "../../components/staff/common";
import { ActionForm } from "../../components/staff/ActionForm";
import {
  sections,
  recordActions,
  sectionPermissions,
} from "../../components/staff/adminConfig";
import { useStaffQuery } from "../../hooks/staff";
import { useSession } from "../../providers/session";
import { downloadReceipt, privateImage } from "../../lib/assets";

export default function AdminSection() {
  const { section: param } = useLocalSearchParams<{ section: string }>(),
    section = String(param),
    config = sections[section];
  const { user, token } = useSession(),
    owner = user?.role === "OWNER",
    allowed =
      !!config &&
      (!config.owner || owner) &&
      (owner ||
        !sectionPermissions[section] ||
        user?.permissions?.[sectionPermissions[section]] !== false);
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [term, setTerm] = useState(""),
    [creating, setCreating] = useState(false),
    [expanded, setExpanded] = useState<string | null>(null),
    [downloadError, setDownloadError] = useState(""),
    [downloading, setDownloading] = useState(false);
  const path = config
    ? config.path +
      (config.path.includes("?") ? "&" : "?") +
      `page=${page}&search=${encodeURIComponent(term)}`
    : "";
  const query = useStaffQuery<Row>(path, allowed);
  if (!allowed)
    return (
      <Screen>
        <Back home="/admin" />
        <ErrorNotice error="This section is unavailable for your role." />
      </Screen>
    );
  const rows: Row[] = query.data?.[config.list] || [],
    totalPages =
      query.data?.pagination?.totalPages ?? query.data?.totalPages ?? 1;
  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
        />
      }
    >
      <Back home="/admin" />
      <Heading>{config.title}</Heading>
      {section === "accounts" && (
        <ActionForm
          operation={{
            title: "Verify owner password",
            path: "/api/v1/settings/reauth",
            fields: [
              {
                key: "password",
                label: "Password",
                kind: "password",
                required: true,
              },
            ],
          }}
        />
      )}
      <ErrorNotice
        error={query.error || downloadError}
        retry={query.error ? () => void query.refetch() : undefined}
      />
      {config.search && (
        <Card>
          <Field label="Search" value={search} onChangeText={setSearch} />
          <Button
            secondary
            title="Search"
            onPress={() => {
              setTerm(search.trim());
              setPage(1);
            }}
          />
        </Card>
      )}
      {config.create && (
        <>
          <Button
            secondary
            title={creating ? "Close form" : config.create.title}
            onPress={() => setCreating(!creating)}
          />
          {creating && <ActionForm operation={config.create} />}
        </>
      )}
      {!query.data ? (
        <LoadingCard title={config.title} />
      ) : !rows.length ? (
        <Card>
          <Text style={styles.muted}>No records found.</Text>
        </Card>
      ) : (
        rows.map((row) => (
          <Card key={row.id}>
            <Details data={row} fields={config.fields} />
            {section === "members" ? (
              <Button
                secondary
                title="Open member"
                onPress={() =>
                  router.push({
                    pathname: "/admin/member/[id]",
                    params: { id: row.id },
                  })
                }
              />
            ) : (
              <>
                {!!recordActions(section, row, owner).length && (
                  <Button
                    secondary
                    title={expanded === row.id ? "Close actions" : "Manage"}
                    onPress={() =>
                      setExpanded(expanded === row.id ? null : row.id)
                    }
                  />
                )}
                {expanded === row.id && (
                  <>
                    {section === "transfers" && row.proofImageUrl && (
                      <Image
                        source={privateImage(row.proofImageUrl, token)}
                        style={{ height: 220, width: "100%", borderRadius: 12 }}
                        resizeMode="contain"
                      />
                    )}
                    {recordActions(section, row, owner).map((operation) => (
                      <ActionForm
                        key={row.id + operation.title}
                        operation={operation}
                        initial={row}
                      />
                    ))}
                  </>
                )}
                {section === "receipts" && (
                  <Button
                    secondary
                    title="Download / share receipt"
                    busy={downloading}
                    onPress={() => {
                      setDownloading(true);
                      setDownloadError("");
                      void downloadReceipt(row.id, token)
                        .catch((cause) => setDownloadError(cause.message))
                        .finally(() => setDownloading(false));
                    }}
                  />
                )}
              </>
            )}
          </Card>
        ))
      )}
      {totalPages > 1 && (
        <View style={{ gap: 8 }}>
          <Text style={styles.muted}>
            Page {page} of {totalPages}
          </Text>
          <Button
            secondary
            title="Previous"
            disabled={page <= 1}
            onPress={() => setPage(page - 1)}
          />
          <Button
            secondary
            title="Next"
            disabled={page >= totalPages}
            onPress={() => setPage(page + 1)}
          />
        </View>
      )}
    </Screen>
  );
}
