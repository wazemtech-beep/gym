import { cachedServerRead, readCacheScope } from "@/lib/serverReadCache";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { Role, InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import Sidebar from "@/components/layout/Sidebar";
import TopHeader from "@/components/layout/TopHeader";
import MemberProfileClient from "@/components/members/MemberProfileClient";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await getCurrentSession();

  if (!current) {
    redirect("/admin/login");
  }

  // Access allowed for Owner & Receptionist (Point 11)
  if (current.user.role !== Role.OWNER && current.user.role !== Role.RECEPTIONIST) {
    redirect("/");
  }

  if (current.user.mustChangePassword) {
    redirect("/auth/change-password");
  }

  const { id } = await params;

  // Lookup member by ID or Member ID (OXG-XXXXXX)
  const member = await cachedServerRead("app/admin/(panel)/members/[id]/page.tsx:prisma.gymMember.findFirst:927", () => prisma.gymMember.findFirst({
    where: {
      OR: [{ id }, { memberId: id }],
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          role: true,
          mustChangePassword: true,
          createdAt: true,
        },
      },
      trainer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      memberships: {
        orderBy: { createdAt: "desc" },
      },
      invoices: {
        orderBy: { issueDate: "desc" },
        include: {
          allocations: {
            include: {
              payment: {
                select: {
                  id: true,
                  receiptNumber: true,
                  paymentDate: true,
                  method: true,
                },
              },
            },
          },
        },
      },
      payments: {
        orderBy: { paymentDate: "desc" },
        include: {
          receivingAccount: {
            select: { displayName: true, type: true },
          },
          recordedBy: {
            select: { name: true },
          },
        },
      },
      attendance: {
        orderBy: { checkIn: "desc" },
        take: 50,
      },
    },
  }), readCacheScope(current), {
    where: {
      OR: [{ id }, { memberId: id }],
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          role: true,
          mustChangePassword: true,
          createdAt: true,
        },
      },
      trainer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      memberships: {
        orderBy: { createdAt: "desc" },
      },
      invoices: {
        orderBy: { issueDate: "desc" },
        include: {
          allocations: {
            include: {
              payment: {
                select: {
                  id: true,
                  receiptNumber: true,
                  paymentDate: true,
                  method: true,
                },
              },
            },
          },
        },
      },
      payments: {
        orderBy: { paymentDate: "desc" },
        include: {
          receivingAccount: {
            select: { displayName: true, type: true },
          },
          recordedBy: {
            select: { name: true },
          },
        },
      },
      attendance: {
        orderBy: { checkIn: "desc" },
        take: 50,
      },
    },
  });

  if (!member) {
    redirect("/admin/members");
  }

  // Fetch audit trail
  const auditLogs = await cachedServerRead("app/admin/(panel)/members/[id]/page.tsx:prisma.auditLog.findMany:2359", () => prisma.auditLog.findMany({
    where: {
      entityId: member.id,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  }), readCacheScope(current), {
    where: {
      entityId: member.id,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Calculate dues and paid summaries
  const totalDues = member.invoices
    .filter((inv) => inv.status === InvoiceStatus.UNPAID || inv.status === InvoiceStatus.PARTIALLY_PAID)
    .reduce((sum, inv) => sum + inv.balanceAmount, 0);

  const totalPaid = member.payments.reduce((sum, p) => sum + p.amount, 0);

  let appAccessStatus = "NOT_ACTIVATED";
  if (member.user) {
    appAccessStatus = member.user.status;
  }

  const formattedMember = {
    ...member,
    totalDues,
    totalPaid,
    appAccessStatus,
    joiningDate: member.joiningDate.toISOString(),
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
    archivedAt: member.archivedAt ? member.archivedAt.toISOString() : null,
    dateOfBirth: member.dateOfBirth ? member.dateOfBirth.toISOString() : null,
    memberships: member.memberships.map((m) => ({
      ...m,
      startDate: m.startDate.toISOString(),
      endDate: m.endDate.toISOString(),
      createdAt: m.createdAt.toISOString(),
    })),
    invoices: member.invoices.map((inv) => ({
      ...inv,
      issueDate: inv.issueDate.toISOString(),
      dueDate: inv.dueDate.toISOString(),
    })),
    payments: member.payments.map((p) => ({
      ...p,
      paymentDate: p.paymentDate.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
    attendance: member.attendance.map((a) => ({
      ...a,
      checkIn: a.checkIn.toISOString(),
    })),
  };

  const formattedAuditLogs = auditLogs.map((log) => ({
    ...log,
    createdAt: log.createdAt.toISOString(),
  }));

  return (
    <div className="app-shell">
      <Sidebar user={current.user} />
      <div className="app-content">
        <TopHeader userName={current.user.name} />
        <main className="app-main">
          <MemberProfileClient
            initialMember={formattedMember}
            auditLogs={formattedAuditLogs}
            currentUserRole={current.user.role}
          />
        </main>
      </div>
    </div>
  );
}
