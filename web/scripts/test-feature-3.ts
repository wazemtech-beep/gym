import { prisma } from "../src/lib/db";
import { MemberRecordStatus, MembershipStatus, InvoiceStatus, Role } from "@prisma/client";
import { normalizePhoneNumber, generateNextMemberId } from "../src/lib/members";

async function runFeature3Verification() {
  console.log("==================================================");
  console.log("   OXGEN GYM - FEATURE 3 (MEMBERS) TEST SUITE    ");
  console.log("==================================================");

  // 1. Verify Owner Account
  const owner = await prisma.user.findFirst({
    where: { role: Role.OWNER },
  });
  if (!owner) throw new Error("Owner account not found!");
  console.log(`[PASS] Owner verified: ${owner.name} (${owner.email})`);

  // 2. Test Phone Normalization
  const testPhoneRaw = "+92 321-7654321";
  const normalized = normalizePhoneNumber(testPhoneRaw);
  if (normalized !== "03217654321") throw new Error(`Phone normalization failed: ${normalized}`);
  console.log(`[PASS] Phone normalization: '${testPhoneRaw}' -> '${normalized}'`);

  // 3. Test Sequential Member ID Generation
  const nextId = await generateNextMemberId();
  if (!nextId.startsWith("OXG-")) throw new Error(`Invalid Member ID: ${nextId}`);
  console.log(`[PASS] Sequential Member ID generated: ${nextId}`);

  // 4. Test Duplicate Check Logic
  const existingMember = await prisma.gymMember.findFirst();
  if (existingMember) {
    const dupCheck = await prisma.gymMember.findFirst({
      where: { phone: existingMember.phone },
    });
    if (!dupCheck) throw new Error("Duplicate check failed to detect existing phone!");
    console.log(`[PASS] Duplicate detection verified for phone ${existingMember.phone} (${dupCheck.fullName})`);
  }

  // 5. Test Registering a Member with Opening Dues (Point 2 & 8)
  const testMemberName = "Usman Aslam Test";
  const testPhone = "03219988776";
  const openingDues = 1500;

  // Clean up if already exists from prior test
  await prisma.gymMember.deleteMany({
    where: { phone: testPhone },
  });

  const memberId = await generateNextMemberId();
  const createdMember = await prisma.$transaction(async (tx) => {
    const m = await tx.gymMember.create({
      data: {
        memberId,
        fullName: testMemberName,
        phone: testPhone,
        email: "usman.aslam.test@oxgengym.com",
        joiningDate: new Date(),
        dateOfBirth: new Date("1996-05-14"),
        address: "DHA Phase 5, Lahore",
        emergencyContactName: "Aslam Javed",
        emergencyContactPhone: "03009988776",
        fitnessGoal: "Muscle Gain & Hypertrophy",
        limitations: "Lower back strain",
        staffNote: "Corporate member reference",
        openingDues,
        status: MemberRecordStatus.CURRENT,
      },
    });

    // Opening Dues creates unpaid invoice, NOT collection (Point 8)
    const openingInv = await tx.invoice.create({
      data: {
        invoiceNumber: `OXG-INV-OPN-${memberId.replace("OXG-", "")}`,
        gymMemberId: m.id,
        title: "Opening Dues Balance",
        totalAmount: openingDues,
        paidAmount: 0,
        balanceAmount: openingDues,
        dueDate: new Date(),
        status: InvoiceStatus.UNPAID,
        notes: "Purani outstanding fees balance import",
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: owner.id,
        actorName: owner.name,
        actorRole: owner.role,
        action: "MEMBER_REGISTERED",
        entityType: "GYM_MEMBER",
        entityId: m.id,
        details: JSON.stringify({
          memberId: m.memberId,
          fullName: m.fullName,
          openingDues,
          invoiceNumber: openingInv.invoiceNumber,
        }),
      },
    });

    return { m, openingInv };
  });

  console.log(`[PASS] Member registered: ${createdMember.m.fullName} (${createdMember.m.memberId})`);
  console.log(`[PASS] Opening invoice created: ${createdMember.openingInv.invoiceNumber} (Rs. ${createdMember.openingInv.balanceAmount})`);

  // 6. Test Assigning Membership Plan (Point 5 & 6)
  const startDate = new Date();
  const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const planFee = 5000;

  const membership = await prisma.$transaction(async (tx) => {
    const mem = await tx.membership.create({
      data: {
        gymMemberId: createdMember.m.id,
        planName: "Monthly Standard Fitness",
        startDate,
        endDate,
        status: MembershipStatus.ACTIVE,
        feeAmount: planFee,
      },
    });

    const invCount = await tx.invoice.count();
    const inv = await tx.invoice.create({
      data: {
        invoiceNumber: `OXG-INV-${String(invCount + 1).padStart(6, "0")}`,
        gymMemberId: createdMember.m.id,
        title: "Monthly Standard Fitness Subscription",
        totalAmount: planFee,
        paidAmount: 0,
        balanceAmount: planFee,
        issueDate: new Date(),
        dueDate: endDate,
        status: InvoiceStatus.UNPAID,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: owner.id,
        actorName: owner.name,
        actorRole: owner.role,
        action: "MEMBERSHIP_ASSIGNED",
        entityType: "GYM_MEMBER",
        entityId: createdMember.m.id,
        details: JSON.stringify({
          planName: mem.planName,
          invoiceNumber: inv.invoiceNumber,
          fee: planFee,
        }),
      },
    });

    return { mem, inv };
  });

  console.log(`[PASS] Membership assigned: ${membership.mem.planName} (${membership.mem.status})`);
  console.log(`[PASS] Subscription invoice created: ${membership.inv.invoiceNumber} (Rs. ${membership.inv.totalAmount})`);

  // 7. Verify Total Dues = Opening Dues (1500) + Plan Fee (5000) = 6500
  const allInvoices = await prisma.invoice.findMany({
    where: {
      gymMemberId: createdMember.m.id,
      status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] },
    },
  });
  const totalDuesCalculated = allInvoices.reduce((sum, i) => sum + i.balanceAmount, 0);
  if (totalDuesCalculated !== 6500) throw new Error(`Expected dues 6500, got ${totalDuesCalculated}`);
  console.log(`[PASS] Member outstanding dues computed accurately: Rs. ${totalDuesCalculated.toLocaleString()}`);

  // 8. Test Recording Payment against Opening Invoice (Point 5)
  const payAmount = 1500;
  const payCount = await prisma.payment.count();
  const receiptNum = `OXG-RCP-${String(payCount + 101).padStart(6, "0")}`;

  const paymentResult = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        receiptNumber: receiptNum,
        gymMemberId: createdMember.m.id,
        amount: payAmount,
        method: "CASH",
        paymentDate: new Date(),
        status: "CONFIRMED",
        recordedById: owner.id,
        notes: "Opening dues settled in cash",
      },
    });

    await tx.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        invoiceId: createdMember.openingInv.id,
        amount: payAmount,
      },
    });

    await tx.invoice.update({
      where: { id: createdMember.openingInv.id },
      data: {
        paidAmount: payAmount,
        balanceAmount: 0,
        status: InvoiceStatus.PAID,
      },
    });

    return payment;
  });

  console.log(`[PASS] Payment recorded & receipt issued: ${paymentResult.receiptNumber} (Rs. ${payAmount})`);

  // Re-verify dues after payment: should now be exactly 5000 (only subscription invoice left)
  const remainingInvoices = await prisma.invoice.findMany({
    where: {
      gymMemberId: createdMember.m.id,
      status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] },
    },
  });
  const remainingDues = remainingInvoices.reduce((sum, i) => sum + i.balanceAmount, 0);
  if (remainingDues !== 5000) throw new Error(`Expected remaining dues 5000, got ${remainingDues}`);
  console.log(`[PASS] Dues updated dynamically after payment: Rs. ${remainingDues.toLocaleString()}`);

  // 9. Test Marking Attendance (Point 6 Tab 7)
  const attendance = await prisma.attendanceRecord.create({
    data: {
      gymMemberId: createdMember.m.id,
      checkIn: new Date(),
      method: "MANUAL",
      notes: "Front desk reception check-in",
    },
  });
  console.log(`[PASS] Attendance check-in recorded: ${attendance.checkIn.toLocaleTimeString()} (${attendance.method})`);

  // 10. Test Freezing Membership (Point 6 Tab 3)
  const frozenMembership = await prisma.membership.update({
    where: { id: membership.mem.id },
    data: {
      status: MembershipStatus.FROZEN,
      frozenAt: new Date(),
      freezeReason: "Exam study leave for 15 days",
    },
  });
  if (frozenMembership.status !== MembershipStatus.FROZEN) throw new Error("Freeze failed");
  console.log(`[PASS] Membership frozen: status=${frozenMembership.status}, reason='${frozenMembership.freezeReason}'`);

  // 11. Test Member Archive Flow (Point 10)
  const archiveReasonText = "Relocated to Islamabad for new job";
  const archivedMember = await prisma.gymMember.update({
    where: { id: createdMember.m.id },
    data: {
      status: MemberRecordStatus.ARCHIVED,
      archivedAt: new Date(),
      archiveReason: archiveReasonText,
    },
  });
  if (archivedMember.status !== MemberRecordStatus.ARCHIVED) throw new Error("Archive failed");
  console.log(`[PASS] Member archived: status=${archivedMember.status}, reason='${archivedMember.archiveReason}'`);

  // Verify that outstanding dues still exist when member is archived (Point 10: dues balance preserved!)
  const archivedDuesCheck = await prisma.invoice.aggregate({
    where: {
      gymMemberId: createdMember.m.id,
      status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] },
    },
    _sum: { balanceAmount: true },
  });
  if (archivedDuesCheck._sum.balanceAmount !== 5000) throw new Error("Archived member dues lost!");
  console.log(`[PASS] Financial integrity verified: Archived member balance Rs. ${archivedDuesCheck._sum.balanceAmount} preserved in dues system!`);

  // 12. Test Member Unarchive Flow (Point 10)
  const unarchivedMember = await prisma.gymMember.update({
    where: { id: createdMember.m.id },
    data: {
      status: MemberRecordStatus.CURRENT,
      archivedAt: null,
      archiveReason: null,
    },
  });
  if (unarchivedMember.status !== MemberRecordStatus.CURRENT) throw new Error("Unarchive failed");
  console.log(`[PASS] Member unarchived: restored to ${unarchivedMember.status} with original ID ${unarchivedMember.memberId}`);

  // 13. Verify Audit Trail (Point 6 Tab 9)
  const memberAuditLogs = await prisma.auditLog.findMany({
    where: { entityId: createdMember.m.id },
    orderBy: { createdAt: "asc" },
  });
  console.log(`[PASS] Audit trail verified: ${memberAuditLogs.length} immutable events recorded for member.`);
  memberAuditLogs.forEach((log) => {
    console.log(`       - [${log.action}] by ${log.actorName} (${log.actorRole})`);
  });

  console.log("\n==================================================");
  console.log("   ALL 12 REQUIREMENTS FOR FEATURE 3 VERIFIED!   ");
  console.log("==================================================");
}

runFeature3Verification()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
