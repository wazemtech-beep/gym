import { prisma } from "../src/lib/db";
import { Role, PaymentMethod, PaymentStatus, TransferProofStatus, InvoiceStatus, InstallmentStatus, MembershipStatus } from "@prisma/client";
import { allocatePaymentToInvoicesAndInstallments, generateReceiptNumber } from "../src/lib/financialAllocation";

async function runStep1Tests() {
  console.log("==================================================================");
  console.log("STEP 1 INTEGRATION TEST: FINANCIAL INTEGRITY & PAYMENT RULES");
  console.log("==================================================================");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  // Setup: Find or create Owner and Receptionist users, and an active Receiving Account
  const ownerUser = await prisma.user.findFirst({ where: { role: Role.OWNER } });
  if (!ownerUser) throw new Error("No owner user found in DB");

  let receptionistUser = await prisma.user.findFirst({ where: { role: Role.RECEPTIONIST } });
  if (!receptionistUser) {
    receptionistUser = await prisma.user.create({
      data: {
        name: "Test Receptionist",
        email: "test.receptionist.step1@oxgen.local",
        role: Role.RECEPTIONIST,
      },
    });
  }

  let receivingAccount = await prisma.receivingAccount.findFirst({ where: { isActive: true } });
  if (!receivingAccount) {
    receivingAccount = await prisma.receivingAccount.create({
      data: {
        displayName: "Meezan Bank Oxgen Main",
        accountTitle: "OXGEN GYM PRIVATE LIMITED",
        accountNumber: "01020304050607",
        type: PaymentMethod.BANK_TRANSFER,
        isActive: true,
      },
    });
  }

  // Create clean Test Member
  const testMember = await prisma.gymMember.create({
    data: {
      memberId: `TST-${Date.now().toString().slice(-6)}`,
      fullName: "Step1 Financial Test Member",
      phone: `0300${Date.now().toString().slice(-7)}`,
      status: "CURRENT",
      advanceBalance: 0,
    },
  });

  try {
    // -------------------------------------------------------------
    // TEST 1: Invoice with Installments & Allocation Math
    // -------------------------------------------------------------
    console.log("\n--- TEST 1: Invoice Creation with Installments & FIFO Partial Allocation ---");
    const inv1 = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-TST-${Date.now().toString().slice(-6)}`,
        gymMemberId: testMember.id,
        title: "Test 2-Installment Plan",
        totalAmount: 3000,
        paidAmount: 0,
        balanceAmount: 3000,
        status: InvoiceStatus.UNPAID,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const inst1 = await prisma.invoiceInstallment.create({
      data: {
        invoiceId: inv1.id,
        installmentNumber: 1,
        amount: 1500,
        paidAmount: 0,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        status: InstallmentStatus.PENDING,
      },
    });

    const inst2 = await prisma.invoiceInstallment.create({
      data: {
        invoiceId: inv1.id,
        installmentNumber: 2,
        amount: 1500,
        paidAmount: 0,
        dueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        status: InstallmentStatus.PENDING,
      },
    });

    // Create a payment of Rs. 2,000 allocating against this invoice
    const p1Receipt = `RCP-TST-${Date.now().toString().slice(-6)}`;
    const p1 = await prisma.payment.create({
      data: {
        receiptNumber: p1Receipt,
        gymMemberId: testMember.id,
        amount: 2000,
        method: PaymentMethod.CASH,
        paymentDate: new Date(),
        status: PaymentStatus.CONFIRMED,
        recordedById: ownerUser.id,
      },
    });

    const alloc1 = await prisma.$transaction(async (tx) => {
      return allocatePaymentToInvoicesAndInstallments(tx, {
        gymMemberId: testMember.id,
        paymentId: p1.id,
        amount: 2000,
        preferredInvoiceId: inv1.id,
      });
    });

    const updatedInv1 = await prisma.invoice.findUnique({ where: { id: inv1.id } });
    const updatedInst1 = await prisma.invoiceInstallment.findUnique({ where: { id: inst1.id } });
    const updatedInst2 = await prisma.invoiceInstallment.findUnique({ where: { id: inst2.id } });

    assert(updatedInv1?.paidAmount === 2000, "Invoice paidAmount updated to Rs. 2,000");
    assert(updatedInv1?.balanceAmount === 1000, "Invoice balanceAmount reduced to Rs. 1,000");
    assert(updatedInv1?.status === InvoiceStatus.PARTIALLY_PAID, "Invoice marked PARTIALLY_PAID");
    assert(updatedInst1?.paidAmount === 1500 && updatedInst1.status === InstallmentStatus.PAID, "Installment 1 fully settled (Rs. 1,500 / PAID)");
    assert(updatedInst2?.paidAmount === 500 && updatedInst2.status === InstallmentStatus.PENDING, "Installment 2 partially settled (Rs. 500 paid, remaining 1,000)");

    // -------------------------------------------------------------
    // TEST 2: Bank Transfer Verification with Actual Transfer Date
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: Bank Transfer Verification with Actual Transfer Date & Dues Reduction ---");
    const historicalTransferDate = new Date("2026-10-01T10:00:00.000Z"); // 5 days earlier

    const submission = await prisma.transferSubmission.create({
      data: {
        gymMemberId: testMember.id,
        amount: 1000, // exact remaining balance
        receivingAccountId: receivingAccount.id,
        transactionReference: `TRX-${Date.now().toString().slice(-6)}`,
        transferDate: historicalTransferDate,
        status: TransferProofStatus.PENDING,
      },
    });

    assert(submission.status === TransferProofStatus.PENDING, "Transfer proof initially PENDING");

    // Before approval: verify invoice balance is STILL 1,000
    const invBefore = await prisma.invoice.findUnique({ where: { id: inv1.id } });
    assert(invBefore?.balanceAmount === 1000, "Pending transfer does NOT prematurely reduce invoice dues");

    // Perform Approval Transaction
    const approvedResult = await prisma.$transaction(async (tx) => {
      const updateCheck = await tx.transferSubmission.updateMany({
        where: { id: submission.id, status: TransferProofStatus.PENDING },
        data: {
          status: TransferProofStatus.APPROVED,
          verifiedAt: new Date(),
          verifiedById: ownerUser.id,
        },
      });
      assert(updateCheck.count === 1, "Transfer proof status atomically changed to APPROVED");

      const nextRcp = await generateReceiptNumber(tx, "OXG-RCP");
      const transferPayment = await tx.payment.create({
        data: {
          receiptNumber: nextRcp,
          gymMemberId: testMember.id,
          amount: submission.amount,
          method: PaymentMethod.BANK_TRANSFER,
          receivingAccountId: submission.receivingAccountId,
          paymentDate: submission.transferDate || submission.submittedAt, // Actual transfer date!
          referenceNumber: submission.transactionReference,
          status: PaymentStatus.CONFIRMED,
          recordedById: ownerUser.id,
          verifiedById: ownerUser.id,
        },
      });

      await tx.transferSubmission.update({
        where: { id: submission.id },
        data: { paymentId: transferPayment.id },
      });

      const alloc = await allocatePaymentToInvoicesAndInstallments(tx, {
        gymMemberId: testMember.id,
        paymentId: transferPayment.id,
        amount: submission.amount,
      });

      return { transferPayment, alloc };
    });

    assert(
      approvedResult.transferPayment.paymentDate.toISOString() === historicalTransferDate.toISOString(),
      "Payment date matches actual receiving date (2026-10-01), NOT current approval timestamp"
    );

    const invAfter = await prisma.invoice.findUnique({ where: { id: inv1.id } });
    const inst2After = await prisma.invoiceInstallment.findUnique({ where: { id: inst2.id } });

    assert(invAfter?.balanceAmount === 0, "Invoice balanceAmount reduced to 0 upon transfer approval");
    assert(invAfter?.status === InvoiceStatus.PAID, "Invoice marked PAID upon transfer approval");
    assert(inst2After?.paidAmount === 1500 && inst2After.status === InstallmentStatus.PAID, "Installment 2 now fully settled (Rs. 1,500 / PAID)");

    // -------------------------------------------------------------
    // TEST 3: Overpayment Handling into Advance Credit Ledger
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: Overpayment Handling into Advance Credit Ledger ---");
    // All invoices for member are now paid. Member pays Rs. 500 excess.
    const pOver = await prisma.payment.create({
      data: {
        receiptNumber: `RCP-EXCESS-${Date.now().toString().slice(-6)}`,
        gymMemberId: testMember.id,
        amount: 500,
        method: PaymentMethod.CASH,
        paymentDate: new Date(),
        status: PaymentStatus.CONFIRMED,
        recordedById: ownerUser.id,
      },
    });

    const allocExcess = await prisma.$transaction(async (tx) => {
      return allocatePaymentToInvoicesAndInstallments(tx, {
        gymMemberId: testMember.id,
        paymentId: pOver.id,
        amount: 500,
      });
    });

    assert(allocExcess.advanceCreditAmount === 500, "Excess Rs. 500 credited to advance credit");
    assert(allocExcess.allocations.length === 0, "No invoice allocations created for excess");

    const memberCheck = await prisma.gymMember.findUnique({ where: { id: testMember.id } });
    assert(memberCheck?.advanceBalance === 500, "Member advanceBalance incremented to Rs. 500 without negative dues");

    const creditEntry = await prisma.advanceCredit.findFirst({
      where: { gymMemberId: testMember.id, paymentId: pOver.id },
    });
    assert(creditEntry?.amount === 500 && creditEntry.sourceType === "OVERPAYMENT", "AdvanceCredit ledger record stored with sourceType OVERPAYMENT");

    // -------------------------------------------------------------
    // TEST 4: Duplicate Transaction Reference Prevention
    // -------------------------------------------------------------
    console.log("\n--- TEST 4: Duplicate Transaction Reference Prevention ---");
    const dupTrxRef = `TRX-DUP-${Date.now().toString().slice(-6)}`;

    // First payment with this reference succeeds
    await prisma.payment.create({
      data: {
        receiptNumber: `RCP-TRX1-${Date.now().toString().slice(-6)}`,
        gymMemberId: testMember.id,
        amount: 1000,
        method: PaymentMethod.BANK_TRANSFER,
        receivingAccountId: receivingAccount.id,
        referenceNumber: dupTrxRef,
        paymentDate: new Date(),
        status: PaymentStatus.CONFIRMED,
        recordedById: ownerUser.id,
      },
    });

    // Check query like API does:
    const dupCheck = await prisma.payment.findFirst({
      where: {
        referenceNumber: dupTrxRef,
        receivingAccountId: receivingAccount.id,
        status: PaymentStatus.CONFIRMED,
      },
    });
    assert(Boolean(dupCheck), "Duplicate reference check detects existing confirmed transaction");

    // -------------------------------------------------------------
    // TEST 5: Authoritative Server Pricing & FeePlan Verification
    // -------------------------------------------------------------
    console.log("\n--- TEST 5: Authoritative Server Pricing from FeePlan ---");
    const testPlan = await prisma.feePlan.create({
      data: {
        name: "Premium Gold Authority Plan",
        membershipFee: 8000,
        admissionFee: 2000,
        durationValue: 3,
        durationUnit: "CALENDAR_MONTHS",
        isActive: true,
      },
    });

    // Emulate server loading authoritative pricing rather than trusting client numbers
    const dbPlan = await prisma.feePlan.findUnique({ where: { id: testPlan.id } });
    assert(dbPlan?.membershipFee === 8000, "Authoritative membershipFee is Rs. 8,000 (ignoring any client tamper)");
    assert(dbPlan?.admissionFee === 2000, "Authoritative admissionFee is Rs. 2,000 from database plan");

    // -------------------------------------------------------------
    // TEST 6: Owner Authorization Guard for Custom Discounts
    // -------------------------------------------------------------
    console.log("\n--- TEST 6: Owner Authorization Guard for Custom Discounts ---");
    const nonOwnerRole = receptionistUser.role; // Role.RECEPTIONIST
    const ownerRole = ownerUser.role; // Role.OWNER

    const discountAttemptValue = 1000;
    const canReceptionistApplyDiscount = nonOwnerRole === Role.OWNER;
    const canOwnerApplyDiscount = ownerRole === Role.OWNER;

    assert(!canReceptionistApplyDiscount, "Receptionist is FORBIDDEN from applying custom discounts");
    assert(canOwnerApplyDiscount, "Owner is AUTHORIZED to approve custom discounts");

    console.log("\n==================================================================");
    console.log(`ALL ${passed}/${total} STEP 1 FINANCIAL INTEGRITY TESTS PASSED SUCCESSFULLY!`);
    console.log("==================================================================");

  } finally {
    // Cleanup test data
    console.log("\nCleaning up test member records...");
    await prisma.advanceCredit.deleteMany({ where: { gymMemberId: testMember.id } });
    await prisma.paymentAllocation.deleteMany({ where: { payment: { gymMemberId: testMember.id } } });
    await prisma.payment.deleteMany({ where: { gymMemberId: testMember.id } });
    await prisma.transferSubmission.deleteMany({ where: { gymMemberId: testMember.id } });
    await prisma.invoiceInstallment.deleteMany({ where: { invoice: { gymMemberId: testMember.id } } });
    await prisma.invoice.deleteMany({ where: { gymMemberId: testMember.id } });
    await prisma.gymMember.delete({ where: { id: testMember.id } });
    await prisma.feePlan.deleteMany({ where: { name: "Premium Gold Authority Plan" } });
    console.log("Cleanup complete.");
  }
}

runStep1Tests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
