import type { Input, Operation } from "./ActionForm";
import type { Row } from "./common";

export const text = (
  key: string,
  label: string,
  required = false,
  kind?: Input["kind"],
): Input => ({ key, label, required, kind });
export const choice = (
  key: string,
  label: string,
  options: string[],
  initial?: string,
): Input => ({ key, label, options, initial: initial ?? options[0] });
export const lookup = (
  key: string,
  label: string,
  path: string,
  list: string,
  display: string,
  required = true,
): Input => ({ key, label, required, lookup: { path, list, label: display } });
export const memberChoice = lookup(
  "gymMemberId",
  "Member",
  "/api/v1/members?status=ALL&limit=50",
  "members",
  "fullName",
);
export const accountChoice = lookup(
  "receivingAccountId",
  "Receiving account",
  "/api/v1/settings/accounts",
  "accounts",
  "displayName",
  false,
);
export const methods = ["CASH", "BANK_TRANSFER", "EASYPAISA", "JAZZCASH"];
export const memberFields: Input[] = [
  text("fullName", "Full name", true),
  text("phone", "Mobile number", true),
  text("email", "Email", false, "email"),
  text("dateOfBirth", "Date of birth", false, "date"),
  text("address", "Address", false, "multiline"),
  text("emergencyContactName", "Emergency contact name"),
  text("emergencyContactPhone", "Emergency contact mobile"),
  text("fitnessGoal", "Fitness goal"),
  text("limitations", "Limitations / injuries", false, "multiline"),
  text("staffNote", "Staff note", false, "multiline"),
];
export const planFields: Input[] = [
  text("name", "Plan name", true),
  text("description", "Description"),
  text("durationValue", "Duration", true, "number"),
  choice("durationUnit", "Duration unit", ["CALENDAR_MONTHS", "DAYS", "YEARS"]),
  text("membershipFee", "Membership fee", true, "number"),
  text("admissionFee", "Admission fee", false, "number"),
  text("includedServices", "Included services"),
  text("eligibility", "Eligibility"),
  choice("paymentTerms", "Payment terms", [
    "FULL_PAYMENT_ONLY",
    "INSTALLMENTS_ALLOWED",
  ]),
  { key: "isActive", label: "Active", kind: "boolean", initial: true },
];
export const expenseFields: Input[] = [
  text("title", "Expense title", true),
  lookup(
    "categoryId",
    "Category",
    "/api/v1/expenses/categories",
    "categories",
    "name",
  ),
  text("payee", "Payee", true),
  text("totalAmount", "Total amount", true, "number"),
  text("expenseDate", "Expense date", false, "date"),
  text("dueDate", "Due date", false, "date"),
  text("notes", "Notes", false, "multiline"),
  {
    key: "attachmentUrl",
    label: "Attach expense photo",
    kind: "photo",
    uploadFolder: "expenses",
  },
];
export type Section = {
  title: string;
  path: string;
  list: string;
  fields: string[];
  owner?: boolean;
  create?: Operation;
  search?: boolean;
};
export const sectionPermissions: Record<string, string> = {
  members: "MEMBER_REGISTER_UPDATE",
  registrations: "MEMBER_REGISTER_UPDATE",
  renewals: "MEMBERSHIP_ASSIGN_RENEW",
  payments: "PAYMENT_RECORD_VERIFY",
  transfers: "PAYMENT_RECORD_VERIFY",
  attendance: "ATTENDANCE_MANAGE",
};
export const permissionActions = [
  "STAFF_CREATE_ROLE_CHANGE",
  "MEMBER_REGISTER_UPDATE",
  "MEMBERSHIP_ASSIGN_RENEW",
  "PAYMENT_RECORD_VERIFY",
  "PAYMENT_REVERSAL_REFUND",
  "FINANCIAL_REPORTS",
  "WORKOUT_DIET_ASSIGN",
  "PROGRESS_ACTIVITY_VIEW",
  "GYM_SETTINGS",
  "EXPENSES_MANAGE",
  "ATTENDANCE_MANAGE",
];
export const sections: Record<string, Section> = {
  members: {
    title: "Members",
    path: "/api/v1/members?status=ALL&limit=20",
    list: "members",
    search: true,
    fields: ["fullName", "memberId", "phone", "status", "totalDues"],
    create: {
      title: "Add member",
      path: "/api/v1/members",
      fields: [
        ...memberFields,
        {
          key: "photoUrl",
          label: "Add member photo",
          kind: "photo",
          uploadFolder: "members",
        },
        text("joiningDate", "Joining date", false, "date"),
        text("openingDues", "Opening dues", false, "number"),
        text("allowFamilyDuplicate", "Shared family contact", false, "boolean"),
        text("familyContactReason", "Shared contact reason"),
        text(
          "admissionFeePreviouslyPaid",
          "Admission fee previously paid",
          false,
          "boolean",
        ),
        text("admissionHistoryNote", "Admission history note"),
      ],
    },
  },
  "fee-plans": {
    title: "Fee plans",
    path: "/api/v1/fee-plans",
    list: "plans",
    fields: [
      "name",
      "membershipFee",
      "admissionFee",
      "durationValue",
      "durationUnit",
      "isActive",
    ],
    owner: true,
    create: {
      title: "Create fee plan",
      path: "/api/v1/fee-plans",
      fields: planFields,
    },
  },
  invoices: {
    title: "Invoices & dues",
    path: "/api/v1/invoices?limit=20",
    list: "invoices",
    search: true,
    fields: [
      "invoiceNumber",
      "gymMember.fullName",
      "title",
      "totalAmount",
      "paidAmount",
      "balanceAmount",
      "dueDate",
      "status",
    ],
  },
  payments: {
    title: "Payments",
    path: "/api/v1/payments?limit=20",
    list: "payments",
    search: true,
    fields: [
      "receiptNumber",
      "gymMember.fullName",
      "amount",
      "method",
      "paymentDate",
      "status",
    ],
    create: {
      title: "Record payment",
      path: "/api/v1/payments",
      idempotent: true,
      confirm: "Record this payment and issue a receipt?",
      fields: [
        memberChoice,
        text("amount", "Amount", true, "number"),
        choice("method", "Method", [...methods, "ADVANCE_CREDIT"]),
        accountChoice,
        text("referenceNumber", "Transaction reference"),
        text("paymentDate", "Payment date", false, "date"),
        text("backdateReason", "Backdate reason"),
        text("notes", "Notes"),
      ],
    },
  },
  receipts: {
    title: "Receipts",
    path: "/api/v1/receipts?limit=20",
    list: "receipts",
    search: true,
    fields: [
      "receiptNumber",
      "gymMember.fullName",
      "amount",
      "method",
      "paymentDate",
      "status",
    ],
  },
  expenses: {
    title: "Expenses",
    path: "/api/v1/expenses?dateRange=all&limit=20",
    list: "expenses",
    search: true,
    owner: true,
    fields: [
      "expenseNumber",
      "title",
      "payee",
      "totalAmount",
      "paidAmount",
      "balanceAmount",
      "status",
    ],
    create: {
      title: "Add expense",
      path: "/api/v1/expenses",
      fields: expenseFields,
    },
  },
  attendance: {
    title: "Attendance",
    path: "/api/v1/attendance?dateRange=this_month&limit=20",
    list: "records",
    search: true,
    fields: [
      "gymMember.fullName",
      "gymMember.memberId",
      "checkIn",
      "method",
      "isVoid",
      "overrideReason",
    ],
    create: {
      title: "Check in member",
      path: "/api/v1/attendance/check-in",
      fields: [
        { ...memberChoice, key: "memberId" },
        text("isOverride", "Override eligibility", false, "boolean"),
        text("overrideReason", "Override reason"),
        text(
          "confirmAnotherVisit",
          "Confirm another visit today",
          false,
          "boolean",
        ),
      ],
      confirm: "Record this member’s visit?",
    },
  },
  registrations: {
    title: "Account requests",
    owner: true,
    path: "/api/v1/member-registrations?status=PENDING",
    list: "requests",
    fields: [
      "fullName",
      "phone",
      "email",
      "address",
      "emergencyContactName",
      "emergencyContactPhone",
      "fitnessGoal",
      "limitations",
      "createdAt",
      "status",
    ],
  },
  renewals: {
    title: "Renewal requests",
    path: "/api/v1/members/renewals?status=PENDING",
    list: "data",
    fields: [
      "gymMember.fullName",
      "feePlan.name",
      "requestedStartDate",
      "status",
      "notes",
    ],
  },
  freezes: {
    title: "Freeze requests",
    path: "/api/v1/membership/freeze-requests?status=PENDING",
    list: "data",
    owner: true,
    fields: [
      "gymMember.fullName",
      "membership.planName",
      "requestedDays",
      "reason",
      "status",
    ],
  },
  transfers: {
    title: "Transfer review",
    path: "/api/v1/reception/dashboard",
    list: "pendingTransfers",
    fields: [
      "gymMember.fullName",
      "amount",
      "receivingAccount.displayName",
      "transactionReference",
      "transferDate",
      "status",
    ],
  },
  announcements: {
    title: "Announcements",
    path: "/api/v1/announcements",
    list: "data",
    fields: [
      "title",
      "content",
      "audience",
      "priority",
      "isPublished",
      "publishAt",
    ],
    create: {
      title: "Save announcement",
      path: "/api/v1/announcements",
      fixed: { channels: ["IN_APP"] },
      confirm:
        "Save this announcement? Published announcements are sent to the selected audience.",
      fields: [
        text("title", "Title", true),
        text("content", "Message", true, "multiline"),
        choice("audience", "Audience", [
          "ALL_MEMBERS",
          "ACTIVE_MEMBERS",
          "STAFF",
        ]),
        choice("priority", "Priority", ["NORMAL", "IMPORTANT"]),
        text("pinned", "Pin announcement", false, "boolean"),
        text("isDraft", "Save as draft", false, "boolean"),
        text("publishAt", "Publish date", false, "date"),
        text("expiresAt", "Expiry date", false, "date"),
      ],
    },
  },
  staff: {
    title: "Staff & roles",
    path: "/api/v1/settings/permissions",
    list: "staff",
    owner: true,
    fields: ["name", "email", "role", "status"],
    create: {
      title: "Invite staff",
      path: "/api/staff/invite",
      confirm: "Create this staff invitation?",
      fields: [
        text("name", "Name", true),
        text("email", "Email", true, "email"),
        text("phone", "Mobile"),
        choice("role", "Role", ["TRAINER", "RECEPTIONIST"]),
      ],
    },
  },
  accounts: {
    title: "Receiving accounts",
    path: "/api/v1/settings/accounts",
    list: "accounts",
    owner: true,
    fields: [
      "displayName",
      "type",
      "accountTitle",
      "accountNumber",
      "isActive",
      "isDefault",
    ],
    create: {
      title: "Add receiving account",
      path: "/api/v1/settings/accounts",
      fields: [
        choice("type", "Type", methods),
        text("displayName", "Display name", true),
        text("accountTitle", "Account title", true),
        text("accountNumber", "Account number", true),
        text("instructions", "Instructions"),
        text("isDefault", "Default account", false, "boolean"),
      ],
    },
  },
  categories: {
    title: "Expense categories",
    path: "/api/v1/expenses/categories?includeInactive=true",
    list: "categories",
    owner: true,
    fields: ["name", "description", "isActive"],
    create: {
      title: "Add category",
      path: "/api/v1/expenses/categories",
      fields: [text("name", "Name", true), text("description", "Description")],
    },
  },
  refunds: {
    title: "Refunds",
    path: "/api/v1/refunds",
    list: "refunds",
    owner: true,
    fields: [
      "refundVoucherNumber",
      "payment.gymMember.fullName",
      "amount",
      "refundMethod",
      "reason",
      "refundDate",
    ],
  },
  audit: {
    title: "Activity history",
    path: "/api/v1/audit?limit=20",
    list: "logs",
    owner: true,
    search: true,
    fields: ["actorName", "action", "entityType", "reason", "createdAt"],
  },
};

export function recordActions(
  section: string,
  row: Row,
  owner: boolean,
): Operation[] {
  const id = encodeURIComponent(row.id),
    reason = text("reason", "Reason", true, "multiline");
  if (section === "registrations")
    return ["APPROVE", "REJECT"].map((action) => ({
      title: action === "APPROVE" ? "Approve account" : "Decline account",
      path: `/api/v1/member-registrations/${id}`,
      fixed: { action },
      fields: action === "REJECT" ? [reason] : [],
      confirm: "Apply this account decision?",
    }));
  if (section === "renewals")
    return ["APPROVE", "REJECT"].map((action) => ({
      title: action === "APPROVE" ? "Approve renewal" : "Decline renewal",
      path: `/api/v1/members/renewals/${id}`,
      fixed: { action },
      fields:
        action === "REJECT"
          ? [text("rejectionReason", "Reason", true)]
          : [text("startDateOverride", "Start date", false, "date")],
      confirm: "Apply this renewal decision?",
    }));
  if (section === "freezes" && owner)
    return ["APPROVE", "REJECT"].map((action) => ({
      title: action === "APPROVE" ? "Approve freeze" : "Decline freeze",
      path: `/api/v1/membership/freeze-requests/${id}`,
      method: "PATCH",
      fixed: { action },
      fields: [
        text("reviewNotes", "Review notes", action === "REJECT"),
        ...(action === "APPROVE"
          ? [text("freezeStartDate", "Freeze start date", false, "date")]
          : []),
      ],
      confirm: "Apply this freeze decision?",
    }));
  if (section === "transfers")
    return ["APPROVE", "REJECT"].map((action) => ({
      title: action === "APPROVE" ? "Confirm transfer" : "Reject transfer",
      path: "/api/v1/transfers/verify",
      fixed: { submissionId: row.id, action },
      fields:
        action === "REJECT" ? [text("rejectionReason", "Reason", true)] : [],
      confirm: "Apply this transfer decision?",
    }));
  if (section === "fee-plans" && owner)
    return [
      {
        title: "Edit fee plan",
        path: `/api/v1/fee-plans/${id}`,
        method: "PUT",
        fields: planFields,
      },
    ];
  if (section === "accounts" && owner)
    return [
      {
        title: "Edit receiving account",
        path: `/api/v1/settings/accounts/${id}`,
        method: "PATCH",
        fields: [
          text("displayName", "Display name", true),
          text("accountTitle", "Account title", true),
          text("accountNumber", "Account number", true),
          text("instructions", "Instructions"),
          text("isActive", "Active", false, "boolean"),
          text("isDefault", "Default account", false, "boolean"),
        ],
        confirm:
          "Save these receiving account details? Verify your owner password first in Gym settings.",
      },
    ];
  if (section === "announcements" && owner)
    return [
      {
        title: "Edit announcement",
        path: `/api/v1/owner/announcements/${id}`,
        method: "PATCH",
        fields: [
          text("title", "Title", true),
          text("content", "Message", true, "multiline"),
          text("pinned", "Pinned", false, "boolean"),
          text("notifyUpdate", "Notify about this update", false, "boolean"),
        ],
        confirm: "Update this announcement?",
      },
      {
        title: "Remove announcement",
        path: `/api/v1/owner/announcements/${id}`,
        method: "DELETE",
        confirm: "Remove this announcement?",
      },
    ];
  if (section === "categories" && owner)
    return [
      {
        title: row.isActive ? "Disable category" : "Enable category",
        path: "/api/v1/expenses/categories",
        method: "PATCH",
        fixed: { id: row.id, isActive: !row.isActive },
        confirm: "Change this category’s status?",
      },
    ];
  if (section === "staff" && owner)
    return [
      {
        title: "Change staff role / status",
        path: "/api/staff/status",
        fixed: { targetUserId: row.id },
        fields: [
          choice("newRole", "Role", ["TRAINER", "RECEPTIONIST"], row.role),
          choice("newStatus", "Status", ["ACTIVE", "SUSPENDED"], row.status),
          reason,
        ],
        confirm: "Update staff access and end their active sessions?",
      },
      {
        title: "Set staff permissions",
        path: "/api/v1/settings/permissions",
        fixed: { targetUserId: row.id },
        fields: [
          ...permissionActions.map((key) => ({
            key: "permissionGrants." + key,
            label: key.replace(/_/g, " "),
            kind: "boolean" as const,
            initial:
              row.role === "RECEPTIONIST" &&
              [
                "MEMBER_REGISTER_UPDATE",
                "MEMBERSHIP_ASSIGN_RENEW",
                "PAYMENT_RECORD_VERIFY",
                "ATTENDANCE_MANAGE",
              ].includes(key),
          })),
          reason,
        ],
        confirm:
          "Apply these permission overrides and revoke this staff member’s sessions?",
      },
      {
        title: "Resend invitation",
        path: "/api/staff/invite/resend",
        fixed: { userId: row.id },
        confirm: "Resend this staff invitation?",
      },
    ];
  if ((section === "payments" || section === "receipts") && owner)
    return [
      {
        title: "Record refund",
        path: "/api/v1/refunds",
        fixed: { paymentId: row.id },
        fields: [
          text("amount", "Refund amount", true, "number"),
          reason,
          choice("refundMethod", "Refund method", methods),
          choice("feeObligationTreatment", "Fee obligation", [
            "KEEP_FEE_DUE",
            "CANCEL_OBLIGATION",
          ]),
        ],
        confirm: "Record this refund?",
      },
    ];
  if (section === "invoices" && owner)
    return [
      {
        title: "Issue credit note",
        path: `/api/v1/invoices/${id}/credit-note`,
        fields: [text("amount", "Amount", true, "number"), reason],
        idempotent: true,
        confirm: "Reduce this invoice’s unpaid balance?",
      },
      {
        title: "Void invoice",
        path: `/api/v1/invoices/${id}/void`,
        fields: [
          reason,
          choice("treatment", "Paid amount treatment", [
            "ADVANCE_CREDIT",
            "REFUND_REVIEW",
          ]),
        ],
        confirm: "Void this invoice or send it for refund review?",
      },
    ];
  if (section === "attendance")
    return [
      {
        title: "Void visit",
        path: `/api/v1/attendance/${id}/void`,
        fields: [reason],
        confirm: "Void this visit?",
      },
    ];
  if (section === "expenses" && owner)
    return [
      {
        title: "Edit expense",
        path: `/api/v1/expenses/${id}`,
        method: "PUT",
        fields: expenseFields,
      },
      {
        title: "Pay expense",
        path: `/api/v1/expenses/${id}/pay`,
        fields: [
          text("amount", "Amount", true, "number"),
          choice("paymentMethod", "Method", methods),
          accountChoice,
          text("referenceNumber", "Reference"),
          text("paymentDate", "Payment date", false, "date"),
        ],
        confirm: "Record this expense payment?",
      },
      {
        title: "Void expense",
        path: `/api/v1/expenses/${id}`,
        method: "DELETE",
        fields: [reason],
        confirm: "Void this unpaid expense?",
      },
    ];
  return [];
}
