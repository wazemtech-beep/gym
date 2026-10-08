import { cachedServerRead, readCacheScope } from "@/lib/serverReadCache";
import { getDateRangeForPeriod } from "@/lib/businessDates";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { Role, PaymentMethod, PaymentStatus, InvoiceStatus, TransferProofStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import Sidebar from "@/components/layout/Sidebar";
import TopHeader from "@/components/layout/TopHeader";
import TrainerReassignmentQueue from "@/components/owner/TrainerReassignmentQueue";
import MembershipFreezeQueue from "@/components/owner/MembershipFreezeQueue";
import CollectionSection from "@/components/dashboard/CollectionSection";
import styles from "@/components/dashboard/Dashboard.module.css";
import { Users, Shield } from "lucide-react";

const activityLabels: Record<string, string> = {
  PAYMENT_RECORDED: "Payment recorded",
  TRANSFER_PROOF_VERIFIED_AND_PAID: "Transfer confirmed",
  TRANSFER_PROOF_REJECTED: "Transfer rejected",
  CASH_SESSION_CLOSED: "Cash session closed",
  STAFF_INVITED: "Staff invited",
  MEMBER_DETAILS_UPDATED: "Member details updated",
};

function readableLabel(value: string) {
  const words = value.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export default async function OwnerDashboardPage() {
  const current = await getCurrentSession();

  if (!current) {
    redirect("/admin/login");
  }

  // Strict role check: only OWNER allowed
  if (current.user.role !== Role.OWNER) {
    redirect("/");
  }

  if (current.user.mustChangePassword) {
    redirect("/auth/change-password");
  }

  // Compute Today's date range in Asia/Karachi context
  const now = new Date();
  const { start: startOfToday, end: endOfToday } = getDateRangeForPeriod("today");
  

  // 1. Fetch Today's Confirmed Payments
  const todayPayments = await cachedServerRead("app/admin/(panel)/dashboard/page.tsx:prisma.payment.findMany:1758", () => prisma.payment.findMany({
    where: {
      paymentDate: { gte: startOfToday, lte: endOfToday },
      status: { in: [PaymentStatus.CONFIRMED, PaymentStatus.REFUNDED] },
      method: { not: "ADVANCE_CREDIT" },
    },
    include: {
      gymMember: { select: { fullName: true, memberId: true } },
      recordedBy: { select: { name: true } },
      receivingAccount: { select: { displayName: true } },
    },
    orderBy: { paymentDate: "desc" },
  }), readCacheScope(current), {
    where: {
      paymentDate: { gte: startOfToday, lte: endOfToday },
      status: { in: [PaymentStatus.CONFIRMED, PaymentStatus.REFUNDED] },
      method: { not: "ADVANCE_CREDIT" },
    },
    include: {
      gymMember: { select: { fullName: true, memberId: true } },
      recordedBy: { select: { name: true } },
      receivingAccount: { select: { displayName: true } },
    },
    orderBy: { paymentDate: "desc" },
  });

  // 2. Fetch Today's Refunds
  const todayRefunds = await cachedServerRead("app/admin/(panel)/dashboard/page.tsx:prisma.refund.findMany:2273", () => prisma.refund.findMany({
    where: {
      refundDate: { gte: startOfToday, lte: endOfToday },
    },
  }), readCacheScope(current), {
    where: {
      refundDate: { gte: startOfToday, lte: endOfToday },
    },
  });

  let cashReceived = 0;
  let bankReceived = 0;
  for (const p of todayPayments) {
    if (p.method === PaymentMethod.CASH) {
      cashReceived += p.amount;
    } else {
      bankReceived += p.amount;
    }
  }

  const totalReceived = cashReceived + bankReceived;
  const totalRefunds = todayRefunds.reduce((sum, r) => sum + r.amount, 0);
  const netCollection = totalReceived - totalRefunds;

  // 3. Pending Transfers
  const pendingTransfers = await cachedServerRead("app/admin/(panel)/dashboard/page.tsx:prisma.transferSubmission.findMany:2839", () => prisma.transferSubmission.findMany({
    where: { status: TransferProofStatus.PENDING },
    include: {
      gymMember: { select: { fullName: true, memberId: true, phone: true } },
      receivingAccount: { select: { displayName: true, accountNumber: true } },
    },
    orderBy: { submittedAt: "desc" },
  }), readCacheScope(current), {
    where: { status: TransferProofStatus.PENDING },
    include: {
      gymMember: { select: { fullName: true, memberId: true, phone: true } },
      receivingAccount: { select: { displayName: true, accountNumber: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  const pendingTransfersAmount = pendingTransfers.reduce((sum, t) => sum + t.amount, 0);

  // 4. Invoices & Dues
  const outstandingInvoices = await cachedServerRead("app/admin/(panel)/dashboard/page.tsx:prisma.invoice.findMany:3303", () => prisma.invoice.findMany({
    where: { status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] } },
  }), readCacheScope(current), {
    where: { status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] } },
  });
  const totalOutstandingDues = outstandingInvoices.reduce((sum, inv) => sum + inv.balanceAmount, 0);
  const overdueInvoices = outstandingInvoices.filter((inv) => new Date(inv.dueDate) < now);
  const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.balanceAmount, 0);

  // 5. Total Active Members
  const activeMembersCount = await cachedServerRead("app/admin/(panel)/dashboard/page.tsx:prisma.gymMember.count:3767", () => prisma.gymMember.count({
    where: { status: "CURRENT", memberships: { some: { status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now } } } },
  }), readCacheScope(current), {
    where: { status: "CURRENT", memberships: { some: { status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now } } } },
  });
  const expiringMembershipsCount = await cachedServerRead("app/admin/(panel)/dashboard/page.tsx:prisma.membership.count:3966", () => prisma.membership.count({ where: { status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) }, gymMember: { status: "CURRENT" } } }), readCacheScope(current), { where: { status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) }, gymMember: { status: "CURRENT" } } });

  // 6. Active Cash Session
  const activeCashSession = await cachedServerRead("app/admin/(panel)/dashboard/page.tsx:prisma.cashSession.findFirst:4214", () => prisma.cashSession.findFirst({
    where: { status: "OPEN", staffId: current.user.id },
    include: { staff: { select: { name: true } } },
    orderBy: { openedAt: "desc" },
  }), readCacheScope(current), {
    where: { status: "OPEN", staffId: current.user.id },
    include: { staff: { select: { name: true } } },
    orderBy: { openedAt: "desc" },
  });

  // 7. Dropdown options for modals
  const membersList = await cachedServerRead("app/admin/(panel)/dashboard/page.tsx:prisma.gymMember.findMany:4460", () => prisma.gymMember.findMany({
    where: { status: "CURRENT" },
    select: { id: true, memberId: true, fullName: true },
    orderBy: { fullName: "asc" },
  }), readCacheScope(current), {
    where: { status: "CURRENT" },
    select: { id: true, memberId: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  const accountsList = await cachedServerRead("app/admin/(panel)/dashboard/page.tsx:prisma.receivingAccount.findMany:4650", () => prisma.receivingAccount.findMany({
    where: { isActive: true },
    select: { id: true, displayName: true, type: true },
  }), readCacheScope(current), {
    where: { isActive: true },
    select: { id: true, displayName: true, type: true },
  });

  const staffMembers = await prisma.user.findMany({
    where: { role: { in: [Role.RECEPTIONIST, Role.TRAINER] } },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const recentAuditLogs = await cachedServerRead("app/admin/(panel)/dashboard/page.tsx:prisma.auditLog.findMany:4984", () => prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
  }), readCacheScope(current), {
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const gymSettings = await cachedServerRead("app/admin/(panel)/dashboard/page.tsx:prisma.gymSettings.findUnique:5095", () => prisma.gymSettings.findUnique({
    where: { id: "default" },
  }), readCacheScope(current), {
    where: { id: "default" },
  });

  const initialMetrics = {
    netCollection,
    totalReceived,
    cashReceived,
    bankReceived,
    totalRefunds,
    pendingTransfersCount: pendingTransfers.length,
    pendingTransfersAmount,
    totalOutstandingDues,
    totalOverdue,
    activeMembersCount,
    expiringMembershipsCount,
  };

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <Sidebar user={current.user} />

      {/* Main Content */}
      <div className="app-content">
        <TopHeader gymName={gymSettings?.gymName || "OXGEN GYM"} userName={current.user.name} />

        <main className={`app-main ${styles.page}`}>
          {/* Feature 2: Complete Interactive Financial & Collection Engine */}
          <div>
            <CollectionSection
              initialMetrics={initialMetrics}
              initialPayments={todayPayments as any}
              membersList={membersList}
              accountsList={accountsList as any}
              pendingTransfersList={pendingTransfers as any}
              activeCashSession={activeCashSession}
            />
          </div>

          <TrainerReassignmentQueue />
          <MembershipFreezeQueue />
          {/* Bottom Grid: Staff Management & Live Audit Logs */}
          <div className={styles.bottomGrid}>
            {/* Staff Management Section */}
            <div className={styles.panel}>
              <div className={styles.sectionHeading}>
                <Users size={20} />
                <div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "4px" }}>
                    Your team
                  </h3>
                </div>
              </div>

              {staffMembers.length === 0 ? (
                <div
                  style={{
                    padding: "36px",
                    textAlign: "center",
                    background: "var(--bg-secondary)",
                    borderRadius: "var(--radius-md)",
                    border: "1px dashed var(--border-subtle)",
                  }}
                >
                  <Users size={36} color="var(--text-dim)" style={{ marginBottom: "10px" }} />
                  <h4 style={{ color: "var(--text-muted)", marginBottom: "4px" }}>
                    No staff members yet.
                  </h4>
                </div>
              ) : (
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-dim)" }}>
                        <th style={{ padding: "10px 12px" }}>Staff Member</th>
                        <th style={{ padding: "10px 12px" }}>Role</th>
                        <th style={{ padding: "10px 12px" }}>Status</th>
                        <th style={{ padding: "10px 12px" }}>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffMembers.map((staff) => (
                        <tr key={staff.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "12px" }}>
                            <div className={styles.staffIdentity}>
                            <span className={styles.avatar} aria-hidden="true">{staff.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()}</span>
                            <div>
                            <div style={{ fontWeight: 700 }}>{staff.name}</div>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{staff.email}</span>
                            </div>
                            </div>
                          </td>
                          <td style={{ padding: "12px" }}>
                            <span className={staff.role === Role.RECEPTIONIST ? "badge badge-receptionist" : "badge badge-trainer"}>
                              {readableLabel(staff.role)}
                            </span>
                          </td>
                          <td style={{ padding: "12px" }}>
                            <span
                              className="badge"
                              style={{
                                background: staff.status === "ACTIVE" ? "var(--accent-soft)" : "var(--amber-soft)",
                                color: staff.status === "ACTIVE" ? "var(--accent-primary)" : "var(--amber-primary)",
                              }}
                            >
                              {staff.status === "INVITATION_PENDING" ? "Invited" : readableLabel(staff.status)}
                            </span>
                          </td>
                          <td style={{ padding: "12px", color: "var(--text-dim)", fontSize: "0.8rem" }}>
                            {new Date(staff.createdAt).toLocaleDateString("en-GB")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Audit Trail Section */}
            <div className={styles.panel}>
              <div className={styles.sectionHeading}>
                <Shield size={20} color="var(--accent-primary)" />
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Recent activity</h3>
              </div>

              <div className={styles.timeline}>
                {recentAuditLogs.map((log) => (
                  <div
                    key={log.id}
                    className={styles.activity}
                  >
                    <div className={styles.activityTitle}>
                      <span style={{ fontWeight: 700, color: "var(--text-main)" }}>
                        {activityLabels[log.action] || readableLabel(log.action)}
                      </span>
                      <time dateTime={new Date(log.createdAt).toISOString()}>
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </time>
                    </div>
                    <div style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>
                      <span style={{ color: "var(--text-muted)" }}>{log.actorName || "System"}</span>
                      {log.actorRole && <span> · {readableLabel(log.actorRole)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
