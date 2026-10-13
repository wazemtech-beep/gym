import { ErrorNotice, Heading, LoadingCard, Screen } from "../../components/ui";
import { ActionForm } from "../../components/staff/ActionForm";
import { text } from "../../components/staff/adminConfig";
import { Back, type Row } from "../../components/staff/common";
import { useStaffQuery } from "../../hooks/staff";
import { useSession } from "../../providers/session";
export default function Reminders() {
  const { user } = useSession(),
    query = useStaffQuery<Row>(
      "/api/v1/owner/settings/reminders",
      user?.role === "OWNER",
    );
  return (
    <Screen>
      <Back home="/admin" />
      <Heading>Reminder schedule</Heading>
      <ErrorNotice
        error={user?.role !== "OWNER" ? "Owner access required." : query.error}
      />
      {user?.role === "OWNER" &&
        (query.data ? (
          <ActionForm
            initial={query.data.data}
            operation={{
              title: "Save reminder schedule",
              path: "/api/v1/owner/settings/reminders",
              fixed: { timezone: "Asia/Karachi" },
              fields: [
                text(
                  "membershipExpiryDays",
                  "Expiry reminder days (comma separated)",
                  true,
                  "number-list",
                ),
                text(
                  "installmentDueNotice",
                  "Installment due notices",
                  false,
                  "boolean",
                ),
                text(
                  "membershipExpiredNotice",
                  "Expired membership notices",
                  false,
                  "boolean",
                ),
                text("overdueGraceDays", "Overdue grace days", true, "number"),
              ],
            }}
          />
        ) : (
          <LoadingCard title="Reminders" />
        ))}
    </Screen>
  );
}
