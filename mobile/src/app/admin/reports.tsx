import { useState } from "react";
import { Text } from "react-native";
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
import { Choices } from "../../components/controls";
import { Back, Details, human, type Row } from "../../components/staff/common";
import { useStaffQuery } from "../../hooks/staff";
import { useSession } from "../../providers/session";
import { downloadDocument } from "../../lib/assets";
const reports = ["collection", "dues", "memberships", "expenses"];
export default function Reports() {
  const { user, token } = useSession(),
    [report, setReport] = useState("collection"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [range, setRange] = useState("dateRange=this_month"),
    [error, setError] = useState(""),
    [exporting, setExporting] = useState(false);
  async function exportReport(format: "pdf" | "csv") {
    if (exporting) return;
    setExporting(true);
    setError("");
    try {
      await downloadDocument(
        `/api/v1/reports/export?type=${report}&format=${format}&${range}`,
        `gym-${report}`,
        token,
        format,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }
  const query = useStaffQuery<Row>(
    `/api/v1/reports/${report}?${range}`,
    user?.role === "OWNER",
  );
  const result = query.data,
    rows: Row[] =
      result?.payments ||
      result?.duesList ||
      result?.expiringMemberships ||
      result?.recordedExpenses ||
      [];
  return (
    <Screen>
      <Back home="/admin" />
      <Heading>Reports</Heading>
      <ErrorNotice
        error={
          user?.role !== "OWNER"
            ? "Owner access required."
            : error || query.error
        }
      />
      {user?.role === "OWNER" && (
        <>
          <Button
            secondary
            title="Export PDF"
            busy={exporting}
            disabled={!query.data}
            onPress={() => void exportReport("pdf")}
          />
          <Button
            secondary
            title="Export CSV"
            busy={exporting}
            disabled={!query.data}
            onPress={() => void exportReport("csv")}
          />
          <Card>
            <Choices
              label="Report"
              value={report}
              options={reports.map((value) => ({ label: human(value), value }))}
              onChange={setReport}
            />
            <Field
              label="From (YYYY-MM-DD)"
              value={start}
              onChangeText={setStart}
            />
            <Field label="To (YYYY-MM-DD)" value={end} onChangeText={setEnd} />
            <Button
              secondary
              title="Apply dates"
              onPress={() => {
                if (
                  !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
                  !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
                  start > end
                ) {
                  setError("Enter a valid date range.");
                  return;
                }
                setError("");
                setRange(
                  `startDate=${start}&endDate=${end}&asOfDate=${end}&dateRange=custom`,
                );
              }}
            />
          </Card>
          {!result ? (
            <LoadingCard title="Report summary" />
          ) : (
            <>
              <Card title="Summary">
                <Details
                  data={result.summary}
                  fields={Object.keys(result.summary || {})}
                />
              </Card>
              <Card title="Records">
                {rows.length ? (
                  rows.map((row, index) => (
                    <Card key={row.id || index}>
                      <Details
                        data={row}
                        fields={[
                          "gymMember.fullName",
                          "fullName",
                          "memberId",
                          "invoiceNumber",
                          "receiptNumber",
                          "expenseNumber",
                          "title",
                          "planName",
                          "amount",
                          "balanceAmount",
                          "totalAmount",
                          "totalOutstanding",
                          "status",
                          "paymentDate",
                          "endDate",
                        ]}
                      />
                    </Card>
                  ))
                ) : (
                  <Text style={styles.muted}>No records for this period.</Text>
                )}
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
