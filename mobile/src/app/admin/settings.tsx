import {
  Card,
  ErrorNotice,
  Heading,
  LoadingCard,
  Screen,
} from "../../components/ui";
import { ActionForm } from "../../components/staff/ActionForm";
import { text, choice } from "../../components/staff/adminConfig";
import { Back, Nav, type Row } from "../../components/staff/common";
import { useStaffQuery } from "../../hooks/staff";
import { useSession } from "../../providers/session";

export default function Settings() {
  const { user } = useSession(),
    query = useStaffQuery<Row>("/api/v1/settings", user?.role === "OWNER"),
    settings = query.data?.settings;
  return (
    <Screen>
      <Back home="/admin" />
      <Heading>Gym settings</Heading>
      <ErrorNotice
        error={user?.role !== "OWNER" ? "Owner access required." : query.error}
        retry={() => void query.refetch()}
      />
      {user?.role === "OWNER" && (
        <>
          {!settings ? (
            <LoadingCard title="Gym preferences" />
          ) : (
            <ActionForm
              key={settings.version}
              initial={settings}
              operation={{
                title: "Save gym settings",
                path: "/api/v1/settings",
                method: "PATCH",
                fixed: { expectedVersion: settings.version },
                fields: [
                  text("gymName", "Gym name", true),
                  text("tagline", "Tagline"),
                  text("contactPhone", "Phone"),
                  text("contactEmail", "Contact email", false, "email"),
                  text("address", "Address", false, "multiline"),
                  text("receiptPrefix", "Receipt prefix", true),
                  text("invoiceDueDays", "Invoice due days", true, "number"),
                  text("maxFreezeDays", "Maximum freeze days", true, "number"),
                  text(
                    "attendanceEnabled",
                    "Enable attendance",
                    false,
                    "boolean",
                  ),
                  text(
                    "dueDateReminderEnabled",
                    "Due date reminders",
                    false,
                    "boolean",
                  ),
                  text(
                    "emailReceiptsAutomatically",
                    "Email receipts automatically",
                    false,
                    "boolean",
                  ),
                  text("receiptFooter", "Receipt footer"),
                  choice("receiptPrintFormat", "Receipt format", [
                    "A4",
                    "THERMAL_80MM",
                  ]),
                ],
              }}
            />
          )}
          <ActionForm
            operation={{
              title: "Verify owner password",
              path: "/api/v1/settings/reauth",
              fields: [text("password", "Password", true, "password")],
            }}
          />
          <Card title="Administration">
            <Nav
              href={{
                pathname: "/admin/[section]",
                params: { section: "accounts" },
              }}
              title="Receiving accounts"
            />
            <Nav
              href={{
                pathname: "/admin/[section]",
                params: { section: "staff" },
              }}
              title="Staff & roles"
            />
            <Nav
              href={{
                pathname: "/admin/[section]",
                params: { section: "categories" },
              }}
              title="Expense categories"
            />
            <Nav href="/admin/reminders" title="Reminder schedule" />
            <Nav href="/staff-account" title="Your account & sessions" />
          </Card>
        </>
      )}
    </Screen>
  );
}
