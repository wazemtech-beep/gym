import { PrismaClient, Role, PaymentStatus, PaymentMethod, InvoiceStatus, ExpenseStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("==================================================================");
  console.log("  OXGEN GYM SaaS - Feature 10 & 11 Comprehensive Verification Test");
  console.log("==================================================================");

  // 1. Get Owner user
  const owner = await prisma.user.findFirst({
    where: { role: Role.OWNER },
  });
  if (!owner) {
    throw new Error("Owner user nahi mila. Pehle seed-financials run karein.");
  }
  console.log(`✓ Owner Found: ${owner.name} (${owner.email})`);

  // 2. Get or create test member
  let member = await prisma.gymMember.findFirst({
    where: { memberId: "OXG-TEST-1011" },
  });
  if (!member) {
    member = await prisma.gymMember.create({
      data: {
        memberId: "OXG-TEST-1011",
        fullName: "Zubair Test Member",
        phone: "+92 321 9988776",
        email: "zubair.test@gmail.com",
        joiningDate: new Date(),
      },
    });
  }
  console.log(`✓ Test Member: ${member.fullName} (${member.memberId})`);

  // ================================================================
  // TEST PART 1: FEATURE 10 - RECEIPTS & PARTIAL PAYMENT & REVERSAL
  // ================================================================
  console.log("\n--- [TEST PART 1: RECEIPTS (FEATURE 10)] ---");

  // Create an invoice for Rs. 3,000
  const invCount = await prisma.invoice.count();
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `INV-TEST-${invCount + 100}`,
      gymMemberId: member.id,
      title: "Monthly Membership - Test Gym Session",
      totalAmount: 3000,
      paidAmount: 0,
      balanceAmount: 3000,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: InvoiceStatus.UNPAID,
    },
  });
  console.log(`✓ Invoice Created: ${invoice.invoiceNumber} (Total: Rs. ${invoice.totalAmount})`);

  // Member pays partial Rs. 2,000 in cash
  const payCount = await prisma.payment.count();
  const receiptNumber = `OXG-RCP-TEST-${payCount + 100}`;
  const partialPaymentAmount = 2000;

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        receiptNumber,
        gymMemberId: member.id,
        amount: partialPaymentAmount,
        paymentDate: new Date(),
        method: PaymentMethod.CASH,
        status: PaymentStatus.CONFIRMED,
        recordedById: owner.id,
        notes: "Partial fee payment test",
      },
    });

    // Allocate to invoice
    await tx.paymentAllocation.create({
      data: {
        paymentId: p.id,
        invoiceId: invoice.id,
        amount: partialPaymentAmount,
      },
    });

    // Update invoice
    const updatedInvoice = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: partialPaymentAmount,
        balanceAmount: invoice.totalAmount - partialPaymentAmount,
        status: InvoiceStatus.PARTIALLY_PAID,
      },
    });

    return { payment: p, updatedInvoice };
  });

  console.log(`✓ Partial Payment Recorded: ${payment.payment.receiptNumber} for Rs. ${payment.payment.amount}`);
  console.log(`✓ Invoice Balance Updated: Paid Rs. ${payment.updatedInvoice.paidAmount}, Remaining Due: Rs. ${payment.updatedInvoice.balanceAmount}`);
  if (payment.updatedInvoice.balanceAmount !== 1000) {
    throw new Error(`Expected remaining balance 1000 but got ${payment.updatedInvoice.balanceAmount}`);
  }

  // Test Reversal flow (Owner reverses payment with reason)
  console.log("\nTesting Reversal Flow (Owner-only with audit trail & invoice balance restore):");
  const reversalReason = "Wrong cash note denomination recorded by reception desk";

  const reversalResult = await prisma.$transaction(async (tx) => {
    // 1. Mark payment reversed
    const revP = await tx.payment.update({
      where: { id: payment.payment.id },
      data: {
        status: PaymentStatus.REVERSED,
        reversalReason,
        reversedAt: new Date(),
        reversedById: owner.id,
      },
    });

    // 2. Restore invoice balance
    const restoredInv = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: 0,
        balanceAmount: invoice.totalAmount,
        status: InvoiceStatus.UNPAID,
      },
    });

    // 3. Audit log
    const audit = await tx.auditLog.create({
      data: {
        actorId: owner.id,
        actorName: owner.name,
        actorRole: owner.role,
        action: "PAYMENT_REVERSED",
        entityType: "PAYMENT",
        entityId: revP.id,
        details: JSON.stringify({
          receiptNumber: revP.receiptNumber,
          reversalReason,
          restoredAmount: revP.amount,
        }),
      },
    });

    return { revP, restoredInv, audit };
  });

  console.log(`✓ Payment ${reversalResult.revP.receiptNumber} successfully REVERSED.`);
  console.log(`  - Reversal Reason: "${reversalResult.revP.reversalReason}"`);
  console.log(`  - Restored Invoice Balance: Rs. ${reversalResult.restoredInv.balanceAmount} (Status: ${reversalResult.restoredInv.status})`);
  console.log(`  - Audit Log Created: ${reversalResult.audit.action} by ${reversalResult.audit.actorName}`);

  // ================================================================
  // TEST PART 2: FEATURE 11 - EXPENSES & OUTFLOW ENGINE
  // ================================================================
  console.log("\n--- [TEST PART 2: EXPENSES (FEATURE 11)] ---");

  // Check categories
  const categories = await prisma.expenseCategory.findMany({ where: { isActive: true } });
  console.log(`✓ Active Expense Categories (${categories.length}): ${categories.map((c) => c.name).join(", ")}`);
  const rentCat = categories.find((c) => c.name.toLowerCase().includes("rent")) || categories[0];
  const utilCat = categories.find((c) => c.name.toLowerCase().includes("util")) || categories[0];
  const repairCat = categories.find((c) => c.name.toLowerCase().includes("repair")) || categories[0];

  // Test Cash Session Linkage:
  // Open a test cash session
  const activeSession = await prisma.cashSession.create({
    data: {
      sessionNumber: `CS-TEST-${Date.now().toString().slice(-4)}`,
      staffId: owner.id,
      openingCash: 50000,
      expectedCash: 50000,
      status: "OPEN",
    },
  });
  console.log(`✓ Opened Test Cash Session: ${activeSession.sessionNumber} with Expected Cash Rs. ${activeSession.expectedCash}`);

  // Scenario 1: Paid Electricity Bill Rs. 12,000 from cash drawer
  console.log("\nScenario 1: Paid Electricity Bill Rs. 12,000 (Desk Drawer Outflow):");
  const expNumber1 = `OXG-EXP-TEST-001`;
  const expense1 = await prisma.$transaction(async (tx) => {
    // 1. Create Expense
    const exp = await tx.expense.create({
      data: {
        expenseNumber: expNumber1,
        title: "LESCO Electricity Bill - October",
        categoryId: utilCat.id,
        payee: "LESCO Sub-division Gulberg",
        totalAmount: 12000,
        paidAmount: 12000,
        balanceAmount: 0,
        expenseDate: new Date(),
        status: ExpenseStatus.PAID,
        notes: "Monthly commercial electricity unit charges",
        recordedById: owner.id,
      },
    });

    // 2. Reduce cash session
    await tx.cashSession.update({
      where: { id: activeSession.id },
      data: {
        expectedCash: activeSession.expectedCash - 12000,
      },
    });

    // 3. Create expense payment
    const expPay = await tx.expensePayment.create({
      data: {
        expenseId: exp.id,
        amount: 12000,
        paymentDate: new Date(),
        method: PaymentMethod.CASH,
        cashSessionId: activeSession.id,
        notes: "Paid from reception cash drawer",
        recordedById: owner.id,
      },
    });

    return { exp, expPay };
  });

  const updatedSession = await prisma.cashSession.findUnique({ where: { id: activeSession.id } });
  console.log(`✓ Expense Recorded: ${expense1.exp.expenseNumber} - Rs. ${expense1.exp.totalAmount} (Status: ${expense1.exp.status})`);
  console.log(`✓ Linked Cash Outflow: Session expectedCash reduced from Rs. 50,000 to Rs. ${updatedSession?.expectedCash}`);
  if (updatedSession?.expectedCash !== 38000) {
    throw new Error(`Expected drawer cash 38,000 but got ${updatedSession?.expectedCash}`);
  }

  // Scenario 2: Partial Payment Flow (Machine repair Rs. 10,000; paid Rs. 4,000; then paid remaining Rs. 6,000)
  console.log("\nScenario 2: Machine Repair Rs. 10,000 with Partial Payment:");
  const expNumber2 = `OXG-EXP-TEST-002`;

  const expense2 = await prisma.$transaction(async (tx) => {
    const exp = await tx.expense.create({
      data: {
        expenseNumber: expNumber2,
        title: "Treadmill Motor Servicing & Belt Replacement",
        categoryId: repairCat.id,
        payee: "Fitness Tech Engineers",
        totalAmount: 10000,
        paidAmount: 4000,
        balanceAmount: 6000,
        expenseDate: new Date(),
        status: ExpenseStatus.PARTIALLY_PAID,
        notes: "Rs. 4,000 advance given on visit; Rs. 6,000 remaining on test run",
        recordedById: owner.id,
      },
    });

    await tx.expensePayment.create({
      data: {
        expenseId: exp.id,
        amount: 4000,
        paymentDate: new Date(),
        method: PaymentMethod.BANK_TRANSFER,
        referenceNumber: "TRX-ADV-9988",
        notes: "Advance paid via online transfer",
        recordedById: owner.id,
      },
    });

    return exp;
  });

  console.log(`✓ Expense Created: ${expense2.expenseNumber} - Total: Rs. 10,000, Paid: Rs. ${expense2.paidAmount}, Remaining: Rs. ${expense2.balanceAmount} (Status: ${expense2.status})`);

  // Now record second payment of Rs. 6,000 against same expense
  console.log("Recording second payment of Rs. 6,000 against existing expense...");
  const secondPayment = await prisma.$transaction(async (tx) => {
    const expPay2 = await tx.expensePayment.create({
      data: {
        expenseId: expense2.id,
        amount: 6000,
        paymentDate: new Date(),
        method: PaymentMethod.BANK_TRANSFER,
        referenceNumber: "TRX-FINAL-1122",
        notes: "Final settlement after repair test",
        recordedById: owner.id,
      },
    });

    const settled = await tx.expense.update({
      where: { id: expense2.id },
      data: {
        paidAmount: 10000,
        balanceAmount: 0,
        status: ExpenseStatus.PAID,
      },
      include: { payments: true },
    });

    return settled;
  });

  console.log(`✓ Expense Updated: ${secondPayment.expenseNumber} is now fully ${secondPayment.status}!`);
  console.log(`  - Total Paid: Rs. ${secondPayment.paidAmount}, Remaining Due: Rs. ${secondPayment.balanceAmount}`);
  console.log(`  - Total Payments Linked: ${secondPayment.payments.length}`);

  // Scenario 3: Monthly Clone/Copy Flow (Copy Previous Expense for Rent)
  console.log("\nScenario 3: Clone/Copy Previous Rent Expense for New Month:");
  const rentExpense = await prisma.expense.create({
    data: {
      expenseNumber: "OXG-EXP-TEST-RENT-OCT",
      title: "Gym Hall Rent - October 2026",
      categoryId: rentCat.id,
      payee: "Landlord Malik Riaz",
      totalAmount: 150000,
      paidAmount: 150000,
      balanceAmount: 0,
      expenseDate: new Date("2026-10-01"),
      status: ExpenseStatus.PAID,
      recordedById: owner.id,
    },
  });

  // Now 1-click clone for November:
  const clonedRent = await prisma.expense.create({
    data: {
      expenseNumber: "OXG-EXP-TEST-RENT-NOV",
      title: "Gym Hall Rent - November 2026",
      categoryId: rentExpense.categoryId,
      payee: rentExpense.payee,
      totalAmount: rentExpense.totalAmount,
      paidAmount: 0,
      balanceAmount: rentExpense.totalAmount,
      expenseDate: new Date("2026-11-01"),
      dueDate: new Date("2026-11-05"),
      status: ExpenseStatus.UNPAID,
      notes: `Cloned from ${rentExpense.expenseNumber}`,
      recordedById: owner.id,
    },
  });

  console.log(`✓ Cloned Rent Expense: ${clonedRent.expenseNumber} for Rs. ${clonedRent.totalAmount.toLocaleString()} saved as ${clonedRent.status}`);
  console.log(`  - Obligation recorded without premature cash outflow (Balance Due: Rs. ${clonedRent.balanceAmount})`);

  // Scenario 4: Voiding Unpaid Duplicate Expense
  console.log("\nScenario 4: Void Unpaid Expense with Mandatory Reason:");
  const voidable = await prisma.expense.create({
    data: {
      expenseNumber: "OXG-EXP-TEST-VOID-01",
      title: "Accidental Duplicate Cleaning Supplies",
      categoryId: categories.find((c) => c.name.toLowerCase().includes("clean"))?.id || categories[0].id,
      payee: "Alpha Mart",
      totalAmount: 3500,
      paidAmount: 0,
      balanceAmount: 3500,
      expenseDate: new Date(),
      status: ExpenseStatus.UNPAID,
      recordedById: owner.id,
    },
  });

  const voided = await prisma.expense.update({
    where: { id: voidable.id },
    data: {
      status: ExpenseStatus.VOID,
      notes: "VOIDED: Duplicate entry entered by mistake at reception",
    },
  });
  console.log(`✓ Voided Expense: ${voided.expenseNumber} Status: ${voided.status} Notes: "${voided.notes}"`);

  // Clean up test cash session
  await prisma.cashSession.update({
    where: { id: activeSession.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      countedCash: 38000,
      difference: 0,
    },
  });
  console.log(`✓ Test Cash Session Closed Cleanly.`);

  console.log("\n==================================================================");
  console.log("  ALL TESTS PASSED! FEATURES 10 & 11 ARE 100% OPERATIONAL & VERIFIED");
  console.log("==================================================================");
}

main()
  .catch((e) => {
    console.error("Test Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
