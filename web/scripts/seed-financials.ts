import { PrismaClient, PaymentMethod, PaymentStatus, InvoiceStatus, TransferProofStatus, CashSessionStatus, MemberRecordStatus, Role } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

async function seedFinancials() {
  console.log("================================================");
  console.log("  OXGEN GYM - SEEDING REALISTIC FINANCIAL DATA  ");
  console.log("================================================");

  try {
    const owner = await prisma.user.findFirst({
      where: { role: Role.OWNER },
    });

    if (!owner) {
      console.error("❌ Owner account nahi mila. Pehle `npm run setup:owner` chalayein.");
      process.exit(1);
    }

    // 1. Create or upsert Receiving Accounts
    console.log("⏳ Setting up Gym Receiving Accounts...");
    const meezanBank = await prisma.receivingAccount.upsert({
      where: { id: "acc-meezan-01" },
      update: {},
      create: {
        id: "acc-meezan-01",
        type: PaymentMethod.BANK_TRANSFER,
        displayName: "Meezan Bank - Main Collection",
        accountTitle: "OXGEN FITNESS CLUB (SMC-PVT) LTD",
        accountNumber: "02010103492817",
        instructions: "Transfer confirmation screenshot ya TRX ID darj karein.",
        isActive: true,
        isDefault: true,
      },
    });

    const easypaisa = await prisma.receivingAccount.upsert({
      where: { id: "acc-easypaisa-01" },
      update: {},
      create: {
        id: "acc-easypaisa-01",
        type: PaymentMethod.EASYPAISA,
        displayName: "Easypaisa - Front Desk Wallet",
        accountTitle: "OXGEN GYM CASHIER",
        accountNumber: "03001234567",
        instructions: "Easypaisa bhej kar Transaction ID provide karein.",
        isActive: true,
        isDefault: false,
      },
    });

    const cashAccount = await prisma.receivingAccount.upsert({
      where: { id: "acc-cash-drawer" },
      update: {},
      create: {
        id: "acc-cash-drawer",
        type: PaymentMethod.CASH,
        displayName: "Reception Cash Drawer",
        accountTitle: "Physical Cash",
        accountNumber: "DRAWER-01",
        instructions: "Counter par cash payment.",
        isActive: true,
        isDefault: false,
      },
    });

    // 2. Create realistic members
    console.log("⏳ Setting up Initial Gym Members...");
    const memberAhmed = await prisma.gymMember.upsert({
      where: { memberId: "OXG-000001" },
      update: {},
      create: {
        memberId: "OXG-000001",
        fullName: "Ahmed Khan",
        phone: "03011234567",
        email: "ahmed.khan@example.com",
        joiningDate: new Date(),
        status: MemberRecordStatus.CURRENT,
      },
    });

    const memberSara = await prisma.gymMember.upsert({
      where: { memberId: "OXG-000002" },
      update: {},
      create: {
        memberId: "OXG-000002",
        fullName: "Sara Ali",
        phone: "03219876543",
        email: "sara.ali@example.com",
        joiningDate: new Date(),
        status: MemberRecordStatus.CURRENT,
      },
    });

    const memberBilal = await prisma.gymMember.upsert({
      where: { memberId: "OXG-000003" },
      update: {},
      create: {
        memberId: "OXG-000003",
        fullName: "Bilal Tariq",
        phone: "03335551234",
        email: "bilal.tariq@example.com",
        joiningDate: new Date(),
        status: MemberRecordStatus.CURRENT,
      },
    });

    const memberUsman = await prisma.gymMember.upsert({
      where: { memberId: "OXG-000004" },
      update: {},
      create: {
        memberId: "OXG-000004",
        fullName: "Usman Sheikh",
        phone: "03451112233",
        email: "usman.sheikh@example.com",
        joiningDate: new Date(),
        status: MemberRecordStatus.CURRENT,
      },
    });

    // 3. Create Invoices
    console.log("⏳ Setting up Fee Invoices...");
    const invAhmed = await prisma.invoice.upsert({
      where: { invoiceNumber: "OXG-INV-000001" },
      update: { paidAmount: 2000, balanceAmount: 1000, status: InvoiceStatus.PARTIALLY_PAID },
      create: {
        invoiceNumber: "OXG-INV-000001",
        gymMemberId: memberAhmed.id,
        title: "Regular Monthly Membership",
        totalAmount: 3000,
        paidAmount: 2000,
        balanceAmount: 1000,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: InvoiceStatus.PARTIALLY_PAID,
      },
    });

    const invSara = await prisma.invoice.upsert({
      where: { invoiceNumber: "OXG-INV-000002" },
      update: { paidAmount: 8000, balanceAmount: 0, status: InvoiceStatus.PAID },
      create: {
        invoiceNumber: "OXG-INV-000002",
        gymMemberId: memberSara.id,
        title: "Quarterly Advance Membership",
        totalAmount: 8000,
        paidAmount: 8000,
        balanceAmount: 0,
        dueDate: new Date(),
        status: InvoiceStatus.PAID,
      },
    });

    const invBilal = await prisma.invoice.upsert({
      where: { invoiceNumber: "OXG-INV-000003" },
      update: { paidAmount: 0, balanceAmount: 3000, status: InvoiceStatus.UNPAID },
      create: {
        invoiceNumber: "OXG-INV-000003",
        gymMemberId: memberBilal.id,
        title: "Monthly Membership - October",
        totalAmount: 3000,
        paidAmount: 0,
        balanceAmount: 3000,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        status: InvoiceStatus.UNPAID,
      },
    });

    const invUsman = await prisma.invoice.upsert({
      where: { invoiceNumber: "OXG-INV-000004" },
      update: { paidAmount: 10000, balanceAmount: 0, status: InvoiceStatus.PAID },
      create: {
        invoiceNumber: "OXG-INV-000004",
        gymMemberId: memberUsman.id,
        title: "Yearly Strength Pass - First Term",
        totalAmount: 10000,
        paidAmount: 10000,
        balanceAmount: 0,
        dueDate: new Date(),
        status: InvoiceStatus.PAID,
      },
    });

    // 4. Create Confirmed Payments matching requirement.txt example (Rs. 12,000 cash, Rs. 8,000 bank, Rs. 2,000 refund)
    console.log("⏳ Setting up Today's Confirmed Payments...");
    const pay1 = await prisma.payment.upsert({
      where: { receiptNumber: "OXG-RCP-000125" },
      update: {},
      create: {
        receiptNumber: "OXG-RCP-000125",
        gymMemberId: memberAhmed.id,
        amount: 2000,
        method: PaymentMethod.CASH,
        receivingAccountId: cashAccount.id,
        paymentDate: new Date(),
        status: PaymentStatus.CONFIRMED,
        recordedById: owner.id,
        notes: "Ahmed partial payment for monthly fee",
      },
    });

    const pay2 = await prisma.payment.upsert({
      where: { receiptNumber: "OXG-RCP-000126" },
      update: {},
      create: {
        receiptNumber: "OXG-RCP-000126",
        gymMemberId: memberSara.id,
        amount: 8000,
        method: PaymentMethod.BANK_TRANSFER,
        receivingAccountId: meezanBank.id,
        paymentDate: new Date(),
        referenceNumber: "MEEZAN-984210",
        status: PaymentStatus.CONFIRMED,
        recordedById: owner.id,
        verifiedById: owner.id,
        notes: "Sara verified transfer for Quarterly plan",
      },
    });

    const pay3 = await prisma.payment.upsert({
      where: { receiptNumber: "OXG-RCP-000127" },
      update: {},
      create: {
        receiptNumber: "OXG-RCP-000127",
        gymMemberId: memberUsman.id,
        amount: 10000,
        method: PaymentMethod.CASH,
        receivingAccountId: cashAccount.id,
        paymentDate: new Date(),
        status: PaymentStatus.CONFIRMED,
        recordedById: owner.id,
        notes: "Usman cash payment at desk",
      },
    });

    // Link payment allocations
    await prisma.paymentAllocation.deleteMany({});
    await prisma.paymentAllocation.createMany({
      data: [
        { paymentId: pay1.id, invoiceId: invAhmed.id, amount: 2000 },
        { paymentId: pay2.id, invoiceId: invSara.id, amount: 8000 },
        { paymentId: pay3.id, invoiceId: invUsman.id, amount: 10000 },
      ],
    });

    // 5. Create a Refund of Rs. 2,000 as per requirement example
    console.log("⏳ Setting up Refund Record (Rs. 2,000)...");
    const existingRefund = await prisma.refund.findFirst({
      where: { paymentId: pay3.id },
    });
    if (!existingRefund) {
      await prisma.refund.create({
        data: {
          paymentId: pay3.id,
          amount: 2000,
          reason: "Usman overpayment returned by Owner",
          refundDate: new Date(),
          recordedById: owner.id,
          feeObligationTreatment: "CANCEL_OBLIGATION",
        },
      });
    }

    // 6. Create a Pending Transfer Submission waiting for verification
    console.log("⏳ Setting up Pending Bank Transfer Proof (Bilal Tariq - Rs. 3,000)...");
    const existingTransfer = await prisma.transferSubmission.findFirst({
      where: { gymMemberId: memberBilal.id, status: TransferProofStatus.PENDING },
    });
    if (!existingTransfer) {
      await prisma.transferSubmission.create({
        data: {
          gymMemberId: memberBilal.id,
          amount: 3000,
          receivingAccountId: meezanBank.id,
          transactionReference: "TRX-7849102",
          status: TransferProofStatus.PENDING,
          submittedAt: new Date(),
        },
      });
    }

    // 7. Create an active Cash Session for reception desk
    console.log("⏳ Setting up Shift Cash Session...");
    await prisma.cashSession.upsert({
      where: { sessionNumber: "CS-000001" },
      update: { expectedCash: 12000 }, // Rs. 2000 + Rs. 10000 = Rs. 12000 cash
      create: {
        sessionNumber: "CS-000001",
        staffId: owner.id,
        openingCash: 0,
        expectedCash: 12000,
        status: CashSessionStatus.OPEN,
      },
    });

    console.log("\n✅ SUCCESS: Financial Data Seeded In Aiven PostgreSQL Successfully!");
    console.log("------------------------------------------------------------------");
    console.log("- Cash Received:          Rs. 12,000");
    console.log("- Bank Transfers (Verif): Rs. 8,000");
    console.log("- Total Received:         Rs. 20,000");
    console.log("- Recorded Refund:        Rs. 2,000");
    console.log("- Today's Net Collection: Rs. 18,000  (Matches requirement example!)");
    console.log("- Pending Bank Proofs:    1 (Bilal Tariq - Rs. 3,000)");
    console.log("------------------------------------------------------------------\n");
  } catch (err) {
    console.error("❌ Seeding error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedFinancials();
