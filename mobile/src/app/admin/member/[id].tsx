import { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { Text } from "react-native";
import {
  Button,
  Card,
  ErrorNotice,
  Heading,
  LoadingCard,
  Screen,
  styles,
} from "../../../components/ui";
import { Back, Details, type Row } from "../../../components/staff/common";
import {
  ActionForm,
  type Operation,
} from "../../../components/staff/ActionForm";
import {
  memberFields,
  text,
  lookup,
  choice,
} from "../../../components/staff/adminConfig";
import { useStaffQuery } from "../../../hooks/staff";
import { useSession } from "../../../providers/session";

export default function MemberDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    base = `/api/v1/members/${encodeURIComponent(id)}`;
  const { user } = useSession(),
    owner = user?.role === "OWNER",
    query = useStaffQuery<Row>(base),
    [selected, setSelected] = useState<string | null>(null);
  const member: Row | undefined = query.data?.member;
  const operations: Operation[] = [
    { title: "Edit member", path: base, method: "PUT", fields: memberFields },
    {
      title: "Assign / renew membership",
      path: base + "/membership",
      fixed: { actionType: "ASSIGN", createInvoice: true },
      fields: [
        lookup(
          "feePlanId",
          "Fee plan",
          "/api/v1/fee-plans?activeOnly=true",
          "plans",
          "name",
        ),
        text("startDate", "Start date", true, "date"),
        choice("discountType", "Discount", ["NONE", "FIXED", "PERCENTAGE"]),
        text("discountValue", "Discount value", false, "number"),
        text("discountReason", "Discount reason"),
        text("applyAdmissionFee", "Apply admission fee", false, "boolean"),
        choice("paymentTerms", "Payment terms", ["FULL", "INSTALLMENTS"]),
        {
          key: "installments",
          label: "Installment schedule",
          kind: "installments",
          when: { key: "paymentTerms", value: "INSTALLMENTS" },
        },
      ],
      confirm: "Assign this plan and create its invoice?",
    },
    {
      title: "Create activation invite",
      path: base + "/app-access",
      fixed: { action: "ACTIVATE_INVITE" },
      confirm: "Create an activation code for this member?",
    },
    {
      title: "Issue password reset code",
      path: base + "/reset-code",
      confirm: "Issue a temporary reset code for this member?",
    },
    {
      title: "Suspend / restore app login",
      path: base + "/app-access",
      fixed: { action: "TOGGLE_SUSPEND" },
      confirm: "Change this member’s app access?",
    },
    {
      title:
        member?.status === "ARCHIVED" ? "Restore member" : "Archive member",
      path: base + "/archive",
      fixed: {
        action: member?.status === "ARCHIVED" ? "UNARCHIVE" : "ARCHIVE",
      },
      fields: [text("reason", "Reason", true)],
      confirm: "Change this member’s roster status?",
    },
    ...(owner
      ? [
          {
            title: "Assign trainer",
            path: base + "/trainer",
            fields: [
              lookup(
                "trainerId",
                "Trainer",
                "/api/v1/trainers",
                "data",
                "name",
              ),
              text("coachingFocus", "Coaching focus"),
              text("startDate", "Start date", true, "date"),
              text("notes", "Assignment notes"),
            ],
          },
          {
            title: "Remove trainer",
            path: base + "/trainer",
            method: "DELETE",
            confirm: "Remove this trainer assignment?",
          },
          {
            title: "Correct opening dues",
            path: base + "/opening-balance",
            fields: [
              text("amount", "Opening dues", true, "number"),
              text("reason", "Correction reason", true),
            ],
            confirm: "Correct the opening balance?",
          },
        ]
      : []),
  ];
  return (
    <Screen>
      <Back home="/admin" />
      <Heading>{member?.fullName || "Member details"}</Heading>
      <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      {!member ? (
        <LoadingCard title="Member profile" />
      ) : (
        <>
          <Card title="Contact & account">
            <Details
              data={member}
              fields={[
                "memberId",
                "phone",
                "email",
                "address",
                "dateOfBirth",
                "emergencyContactName",
                "emergencyContactPhone",
                "fitnessGoal",
                "limitations",
                "status",
                "totalDues",
                "advanceBalance",
              ]}
            />
          </Card>
          <Card title="Manage member">
            {operations.map((operation) => (
              <Button
                key={operation.title}
                secondary
                title={operation.title}
                onPress={() =>
                  setSelected(
                    selected === operation.title ? null : operation.title,
                  )
                }
              />
            ))}
            {owner && (
              <Button
                secondary
                title="Coaching plans & reviews"
                onPress={() =>
                  router.push({
                    pathname: "/admin/coaching/[id]",
                    params: { id },
                  })
                }
              />
            )}
          </Card>
          {operations
            .filter((operation) => selected === operation.title)
            .map((operation) => (
              <ActionForm
                key={operation.title}
                operation={operation}
                initial={operation.title === "Edit member" ? member : {}}
              />
            ))}
          <Card title="Membership history">
            {!member.memberships?.length && (
              <Text style={styles.muted}>No memberships yet.</Text>
            )}
            {member.memberships?.map((membership: Row) => (
              <Card key={membership.id}>
                <Details
                  data={membership}
                  fields={[
                    "planName",
                    "status",
                    "startDate",
                    "endDate",
                    "feeAmount",
                  ]}
                />
                {owner && (
                  <>
                    {membership.status === "ACTIVE" && (
                      <ActionForm
                        operation={{
                          title: "Freeze membership",
                          path: base + "/membership",
                          fixed: {
                            actionType: "FREEZE",
                            membershipId: membership.id,
                          },
                          fields: [
                            text("freezeReason", "Reason", true),
                            text("freezeDays", "Days", true, "number"),
                          ],
                          confirm: "Freeze this membership?",
                        }}
                      />
                    )}
                    {membership.status === "FROZEN" && (
                      <ActionForm
                        operation={{
                          title: "Resume membership",
                          path: base + "/membership",
                          fixed: {
                            actionType: "UNFREEZE",
                            membershipId: membership.id,
                          },
                          confirm:
                            "Resume this membership and extend its validity?",
                        }}
                      />
                    )}
                    {["ACTIVE", "FROZEN", "UPCOMING"].includes(
                      membership.status,
                    ) && (
                      <ActionForm
                        operation={{
                          title: "Cancel membership",
                          path: base + "/membership",
                          fixed: {
                            actionType: "CANCEL",
                            membershipId: membership.id,
                          },
                          fields: [
                            text("cancellationReason", "Reason", true),
                            choice(
                              "financialTreatment",
                              "Financial treatment",
                              ["NONE", "CREDIT_ADVANCE"],
                            ),
                          ],
                          confirm: "Cancel this membership?",
                        }}
                      />
                    )}
                  </>
                )}
              </Card>
            ))}
          </Card>
          <Card title="Invoices">
            {member.invoices?.map((invoice: Row) => (
              <Details
                key={invoice.id}
                data={invoice}
                fields={[
                  "invoiceNumber",
                  "title",
                  "status",
                  "totalAmount",
                  "balanceAmount",
                ]}
              />
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
