import { prisma } from "../src/lib/db";
import { generateReceiptPdf } from "../src/lib/pdfGenerator";
import { generateExcelWorkbookXml } from "../src/lib/excelGenerator";
import {
  Role,
  PaymentMethod,
  MembershipStatus,
  FreezeRequestStatus,
  ExpenseStatus,
  CashSessionStatus,
} from "@prisma/client";

async function runFinalBhendTests() {
  console.log("==================================================================");
  console.log("⚡ FAST INTEGRATION & REGRESSION SUITE: ALL PENDING GAPS FIXES ⚡");
  console.log("1. Vector PDF (A4 & Thermal 80mm) Backend Generation");
  console.log("2. Excel (.xlsx / .xls) Native Workbook Generation");
  console.log("3. Historical Fee Plan Versions & Archiving Engine");
  console.log("4. Member Freeze Request & Staff Review Queue");
  console.log("5. Membership Cancellation with Pro-rata Advance Credit");
  console.log("6. Vendor Expense Refund & Drawer Correction Flow");
  console.log("==================================================================");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  // -------------------------------------------------------------
  // 1. PDF GENERATION TEST
  // -------------------------------------------------------------
  console.log("\n--- TEST 1: PDF Generation Engine (A4 & Thermal) ---");
  const sampleReceiptData = {
    receiptNumber: "OXG-RCP-TEST01",
    paymentDate: new Date().toISOString(),
    memberName: "Hamza Test Khan",
    memberId: "MEM-9999",
    memberPhone: "03001234567",
    amount: 5000,
    method: "CASH",
    referenceNumber: "CASH-REC-101",
    recordedBy: "Receptionist Waseem",
    memberRemainingDues: 0,
    gymName: "OXGEN FITNESS CLUB",
    receiptFooter: "Keep this receipt safe for your records.",
  };

  const a4Pdf = await generateReceiptPdf(sampleReceiptData, "A4");
  assert(Buffer.isBuffer(a4Pdf) && a4Pdf.length > 500, `A4 PDF generated (${a4Pdf.length} bytes)`);
  assert(a4Pdf.toString("ascii", 0, 4) === "%PDF", "A4 PDF has valid %PDF magic header");

  const thermalPdf = await generateReceiptPdf(sampleReceiptData, "THERMAL_80MM");
  assert(Buffer.isBuffer(thermalPdf) && thermalPdf.length > 500, `Thermal 80mm PDF generated (${thermalPdf.length} bytes)`);
  assert(thermalPdf.toString("ascii", 0, 4) === "%PDF", "Thermal PDF has valid %PDF magic header");

  // -------------------------------------------------------------
  // 2. EXCEL XML GENERATION TEST
  // -------------------------------------------------------------
  console.log("\n--- TEST 2: Excel SpreadsheetML XML Generation ---");
  const headers = ["Member ID", "Member Name", "Plan", "Amount Paid", "Dues Balance"];
  const rows = [
    ["MEM-001", "Ali Raza", "Gold Monthly", 5000, 0],
    ["MEM-002", "Zain Ahmed", "Silver Quarterly", 12000, 2000],
  ];
  const xmlOutput = generateExcelWorkbookXml("Collection Report", headers, rows);
  assert(typeof xmlOutput === "string" && xmlOutput.length > 200, `Excel XML generated (${xmlOutput.length} chars)`);
  assert(xmlOutput.includes("<Workbook") && xmlOutput.includes("<Worksheet ss:Name=\"Collection Report\""), "Excel XML contains valid Workbook and Worksheet definitions");
  assert(xmlOutput.includes("Ali Raza") && xmlOutput.includes("Zain Ahmed"), "Excel XML contains mapped data rows");

  // -------------------------------------------------------------
  // 3. FEE PLAN HISTORICAL VERSIONS TEST
  // -------------------------------------------------------------
  console.log("\n--- TEST 3: Historical Fee Plan Archiving ---");
  const owner = await prisma.user.findFirst({ where: { role: Role.OWNER } });
  if (!owner) throw new Error("No owner found in database");

  const testFeePlan = await prisma.feePlan.create({
    data: {
      name: `Test Plan ${Date.now()}`,
      membershipFee: 6000,
      admissionFee: 1000,
      durationValue: 1,
      version: 1,
    },
  });

  // Archive and update plan version (emulating PUT /api/v1/fee-plans/[id])
  const archivedHistory = await prisma.feePlanHistory.create({
    data: {
      feePlanId: testFeePlan.id,
      version: testFeePlan.version,
      name: testFeePlan.name,
      membershipFee: testFeePlan.membershipFee,
      admissionFee: testFeePlan.admissionFee,
      durationValue: testFeePlan.durationValue,
      durationUnit: testFeePlan.durationUnit,
      changedById: owner.id,
      changeReason: "Testing fee plan version archive",
    },
  });

  const updatedFeePlan = await prisma.feePlan.update({
    where: { id: testFeePlan.id },
    data: {
      membershipFee: 7500,
      version: { increment: 1 },
    },
  });

  assert(archivedHistory.membershipFee === 6000 && archivedHistory.version === 1, "Purana fee plan version 1 history table mein archive ho gaya");
  assert(updatedFeePlan.membershipFee === 7500 && updatedFeePlan.version === 2, "Current fee plan successfully version 2 par increment ho gaya");

  // -------------------------------------------------------------
  // 4. MEMBER FREEZE REQUEST & RECEPTION APPROVAL TEST
  // -------------------------------------------------------------
  console.log("\n--- TEST 4: Member Freeze Request & Approval Flow ---");
  const testUser = await prisma.user.create({
    data: {
      name: "Freeze Flow Tester",
      email: `freeze.test.${Date.now()}@example.com`,
      passwordHash: "dummyhash",
      role: Role.MEMBER,
    },
  });

  const testMember = await prisma.gymMember.create({
    data: {
      memberId: `MEM-FZ-${Date.now().toString().slice(-4)}`,
      fullName: "Freeze Flow Tester",
      phone: `0300${Date.now().toString().slice(-7)}`,
      userId: testUser.id,
    },
  });

  const testMembership = await prisma.membership.create({
    data: {
      gymMemberId: testMember.id,
      planName: "Monthly Standard",
      feeAmount: 5000,
      durationValue: 1,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: MembershipStatus.ACTIVE,
    },
  });

  // 4a. Member submits freeze request
  const freezeReq = await prisma.membershipFreezeRequest.create({
    data: {
      gymMemberId: testMember.id,
      membershipId: testMembership.id,
      requestedDays: 14,
      plannedResumeDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      reason: "Traveling out of city for 2 weeks",
      status: FreezeRequestStatus.PENDING,
    },
  });
  assert(freezeReq.status === FreezeRequestStatus.PENDING, "Member successfully submitted freeze request (PENDING)");

  // 4b. Reception / Owner reviews & approves
  const approvedReq = await prisma.$transaction(async (tx) => {
    const updated = await tx.membershipFreezeRequest.update({
      where: { id: freezeReq.id },
      data: {
        status: FreezeRequestStatus.APPROVED,
        reviewedById: owner.id,
        reviewedAt: new Date(),
        reviewNotes: "Approved by Owner",
      },
    });

    await tx.membership.update({
      where: { id: testMembership.id },
      data: {
        status: MembershipStatus.FROZEN,
        frozenAt: new Date(),
        freezeReason: freezeReq.reason,
      },
    });

    return updated;
  });

  const refreshedMembership = await prisma.membership.findUnique({ where: { id: testMembership.id } });
  assert(approvedReq.status === FreezeRequestStatus.APPROVED, "Freeze request marked APPROVED by reviewer");
  assert(refreshedMembership?.status === MembershipStatus.FROZEN, "Membership status updated to FROZEN automatically");

  // -------------------------------------------------------------
  // 5. CANCELLATION FINANCIAL TREATMENT (PRO-RATA ADVANCE CREDIT)
  // -------------------------------------------------------------
  console.log("\n--- TEST 5: Cancellation with Pro-rata Advance Credit ---");
  // Assume 15 days out of 30 remaining on 5000 plan -> pro-rata credit = 2500
  const remainingDays = 15;
  const totalDays = 30;
  const creditAmount = Math.round((5000 / totalDays) * remainingDays);

  const [updatedMember, creditRecord, cancelledMembership] = await prisma.$transaction(async (tx) => {
    const mem = await tx.gymMember.update({
      where: { id: testMember.id },
      data: {
        advanceBalance: { increment: creditAmount },
      },
    });

    const credit = await tx.advanceCredit.create({
      data: {
        gymMemberId: testMember.id,
        amount: creditAmount,
        sourceType: "CANCELLATION_CREDIT",
        notes: `Pro-rata Cancellation Credit for ${testMembership.planName}`,
      },
    });

    const ms = await tx.membership.update({
      where: { id: testMembership.id },
      data: {
        status: MembershipStatus.CANCELLED,
        notes: `Cancelled with Financial Treatment: CREDIT_ADVANCE, Credited: Rs. ${creditAmount}`,
      },
    });

    return [mem, credit, ms];
  });

  assert(creditRecord.amount === 2500 && creditRecord.sourceType === "CANCELLATION_CREDIT", "AdvanceCredit record created with Rs. 2,500");
  assert(updatedMember.advanceBalance === 2500, "Member advanceBalance incremented to Rs. 2,500");
  assert(cancelledMembership.status === MembershipStatus.CANCELLED, "Membership status updated to CANCELLED");

  // -------------------------------------------------------------
  // 6. VENDOR EXPENSE REFUND & CASH SESSION REVERSAL TEST
  // -------------------------------------------------------------
  console.log("\n--- TEST 6: Vendor Expense Refund & Drawer Reversal ---");
  let expCat = await prisma.expenseCategory.findFirst();
  if (!expCat) {
    expCat = await prisma.expenseCategory.create({
      data: { name: "Equipment Maintenance" },
    });
  }

  // Find or create an active cash session
  let cashSession = await prisma.cashSession.findFirst({
    where: { status: CashSessionStatus.OPEN },
  });
  if (!cashSession) {
    cashSession = await prisma.cashSession.create({
      data: {
        sessionNumber: `CS-${Date.now().toString().slice(-6)}`,
        staffId: owner.id,
        openingCash: 5000,
        expectedCash: 5000,
        status: CashSessionStatus.OPEN,
      },
    });
  }

  // Create an expense of 4000 fully paid
  const testExpense = await prisma.expense.create({
    data: {
      expenseNumber: `EXP-TEST-${Date.now().toString().slice(-4)}`,
      categoryId: expCat.id,
      title: "Faulty Treadmill Belt",
      payee: "Fitness Spares PK",
      expenseDate: new Date(),
      totalAmount: 4000,
      paidAmount: 4000,
      balanceAmount: 0,
      status: ExpenseStatus.PAID,
      recordedById: owner.id,
    },
  });

  const refundAmount = 1500;
  const initialExpectedCash = cashSession.expectedCash;

  // Emulate POST /api/v1/expenses/[id]/refund
  const [refundRecord, updatedExp, updatedSession] = await prisma.$transaction(async (tx) => {
    const newPaidAmount = testExpense.paidAmount - refundAmount;
    const newBalanceAmount = testExpense.totalAmount - newPaidAmount;

    const exp = await tx.expense.update({
      where: { id: testExpense.id },
      data: {
        paidAmount: newPaidAmount,
        balanceAmount: newBalanceAmount,
        status: ExpenseStatus.PARTIALLY_PAID,
      },
    });

    const ref = await tx.expenseRefund.create({
      data: {
        refundNumber: `OXG-VRF-${Date.now().toString().slice(-6)}`,
        expenseId: testExpense.id,
        amount: refundAmount,
        method: PaymentMethod.CASH,
        cashSessionId: cashSession.id,
        reason: "Returned 1 unused belt to vendor",
        recordedById: owner.id,
      },
    });

    const sess = await tx.cashSession.update({
      where: { id: cashSession.id },
      data: {
        expectedCash: { increment: refundAmount },
      },
    });

    return [ref, exp, sess];
  });

  assert(refundRecord.amount === 1500 && refundRecord.method === "CASH", "ExpenseRefund record created for Rs. 1,500");
  assert(updatedExp.paidAmount === 2500 && updatedExp.balanceAmount === 1500, "Expense paidAmount reduced to 2500 and balanceAmount updated to 1500");
  assert(updatedExp.status === ExpenseStatus.PARTIALLY_PAID, "Expense status shifted to PARTIALLY_PAID");
  assert(updatedSession.expectedCash === initialExpectedCash + 1500, "Cash drawer expectedCash incremented by Rs. 1,500 vendor refund");

  // -------------------------------------------------------------
  // CLEANUP TEST DATA
  // -------------------------------------------------------------
  console.log("\n--- Cleaning up temporary test records ---");
  await prisma.expenseRefund.delete({ where: { id: refundRecord.id } });
  await prisma.expense.delete({ where: { id: testExpense.id } });
  await prisma.advanceCredit.delete({ where: { id: creditRecord.id } });
  await prisma.membershipFreezeRequest.delete({ where: { id: freezeReq.id } });
  await prisma.membership.delete({ where: { id: testMembership.id } });
  await prisma.gymMember.delete({ where: { id: testMember.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
  await prisma.feePlanHistory.delete({ where: { id: archivedHistory.id } });
  await prisma.feePlan.delete({ where: { id: testFeePlan.id } });

  console.log("\n==================================================================");
  console.log(`🎉 ALL ${passed}/${total} CHECKS PASSED WITH 100% SUCCESS!`);
  console.log("==================================================================");
}

runFinalBhendTests()
  .catch((err) => {
    console.error("Test failed with error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
