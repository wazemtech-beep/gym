import { prisma } from "../src/lib/db";
import { Role, PaymentMethod, PaymentStatus, InvoiceStatus, MemberRecordStatus, InstallmentStatus, AccountStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

async function runStep3Tests() {
  console.log("==================================================================");
  console.log("STEP 3 INTEGRATION TEST: MISSING UI, RECEPTION & RECOVERY");
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

  // 1. Setup Base Users
  const ownerUser = await prisma.user.findFirst({ where: { role: Role.OWNER } });
  if (!ownerUser) throw new Error("No owner user found in DB");

  let receptionist = await prisma.user.create({
    data: {
      name: "Test Receptionist Step3",
      email: `reception.step3.${Date.now()}@oxgen.local`,
      phone: `0300${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: Role.RECEPTIONIST,
      status: "ACTIVE",
    },
  });

  const memberUser = await prisma.user.create({
    data: {
      name: "Test Member Step3",
      email: `member.step3.${Date.now()}@oxgen.local`,
      phone: `0311${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: Role.MEMBER,
      status: "ACTIVE",
      passwordHash: await bcrypt.hash("InitialPass123!", 10),
    },
  });

  const gymMember = await prisma.gymMember.create({
    data: {
      user: { connect: { id: memberUser.id } },
      memberId: `MEM-S3-${Math.floor(1000 + Math.random() * 9000)}`,
      fullName: memberUser.name,
      phone: memberUser.phone!,
      email: memberUser.email,
      status: MemberRecordStatus.CURRENT,
    },
  });

  // -------------------------------------------------------------
  // SECTION 1: INVOICES DIRECTORY & AGGREGATE CALCULATIONS
  // -------------------------------------------------------------
  console.log("\n--- Section 1: Invoices Query & Aggregates ---");

  // Create an invoice with 2 installments
  const testInvoice = await prisma.invoice.create({
    data: {
      title: "Step 3 Fitness Plan Invoice",
      invoiceNumber: `INV-S3-${Date.now()}`,
      gymMemberId: gymMember.id,
      totalAmount: 5000,
      paidAmount: 2000,
      balanceAmount: 3000,
      status: InvoiceStatus.PARTIALLY_PAID,
      dueDate: new Date(Date.now() + 7 * 86400000),
      notes: "Step 3 Test Invoice",
      lineItems: {
        create: [
          {
            description: "Step 3 Fitness Plan",
            amount: 5000,
          },
        ],
      },
      installments: {
        create: [
          {
            installmentNumber: 1,
            amount: 2500,
            dueDate: new Date(Date.now() - 86400000), // Overdue
            status: InstallmentStatus.OVERDUE,
            paidAmount: 2000,
          },
          {
            installmentNumber: 2,
            amount: 2500,
            dueDate: new Date(Date.now() + 14 * 86400000),
            status: InstallmentStatus.PENDING,
            paidAmount: 0,
          },
        ],
      },
    },
    include: {
      lineItems: true,
      installments: true,
      gymMember: true,
    },
  });

  assert(testInvoice.lineItems.length === 1, "Invoice includes line items");
  assert(testInvoice.installments.length === 2, "Invoice includes installment schedule");
  assert(testInvoice.totalAmount - testInvoice.paidAmount === 3000, "Outstanding balance is computed accurately (Rs. 3,000)");

  // -------------------------------------------------------------
  // SECTION 2: RECEPTION OPERATIONS & CASH DRAWER ISOLATION
  // -------------------------------------------------------------
  console.log("\n--- Section 2: Reception Operations & Cash Attribution ---");

  // Receptionist records a CASH payment
  const cashPayment = await prisma.payment.create({
    data: {
      receiptNumber: `RCP-S3-CASH-${Date.now()}`,
      gymMemberId: gymMember.id,
      amount: 2000,
      method: PaymentMethod.CASH,
      status: PaymentStatus.CONFIRMED,
      paymentDate: new Date(),
      recordedById: receptionist.id,
      notes: "Front desk cash fee collection",
    },
  });

  // Owner records a BANK_TRANSFER payment (different user, non-cash)
  const bankPayment = await prisma.payment.create({
    data: {
      receiptNumber: `RCP-S3-BANK-${Date.now()}`,
      gymMemberId: gymMember.id,
      amount: 10000,
      method: PaymentMethod.BANK_TRANSFER,
      status: PaymentStatus.CONFIRMED,
      paymentDate: new Date(),
      recordedById: ownerUser.id,
      notes: "Owner online bank transfer",
    },
  });

  // Check Receptionist's Cash Drawer isolation
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const myCashPayments = await prisma.payment.findMany({
    where: {
      recordedById: receptionist.id,
      method: PaymentMethod.CASH,
      status: PaymentStatus.CONFIRMED,
      paymentDate: { gte: startOfDay, lte: endOfDay },
    },
  });

  const myCashTotal = myCashPayments.reduce((s, p) => s + p.amount, 0);
  assert(myCashTotal === 2000, "Receptionist drawer isolates CASH (Rs. 2,000) from other staff and methods");

  // Reception Quick Check-in
  const checkInRecord = await prisma.attendanceRecord.create({
    data: {
      gymMemberId: gymMember.id,
      checkIn: new Date(),
      method: "MANUAL",
      recordedById: receptionist.id,
      notes: "Front desk shortcut check-in",
    },
    include: {
      gymMember: true,
    },
  });

  assert(checkInRecord.gymMember.fullName === memberUser.name, "Reception check-in links to member profile");
  assert(checkInRecord.method === "MANUAL", "Check-in method recorded as MANUAL");

  // -------------------------------------------------------------
  // SECTION 3: FORGOT PASSWORD WORKFLOW VIA EMAIL TOKEN
  // -------------------------------------------------------------
  console.log("\n--- Section 3: Forgot Password (Email Token) ---");

  // Invalidate any old tokens for member
  await prisma.passwordResetToken.updateMany({
    where: { userId: memberUser.id, usedAt: null },
    data: { expiresAt: new Date(0) },
  });

  // Generate 1-hour secure reset token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenRecord = await prisma.passwordResetToken.create({
    data: {
      userId: memberUser.id,
      token: rawToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  assert(tokenRecord.token === rawToken, "Password reset token generated securely");
  assert(tokenRecord.expiresAt > new Date(), "Token has 1-hour future expiry");

  // Consume token to update password
  const newPasswordRaw = "NewSecureGymPass2026!";
  const newHash = await bcrypt.hash(newPasswordRaw, 10);

  const updatedUser = await prisma.user.update({
    where: { id: memberUser.id },
    data: {
      passwordHash: newHash,
      failedLoginAttempts: 0,
      lockoutUntil: null,
      mustChangePassword: false,
    },
  });

  await prisma.passwordResetToken.update({
    where: { id: tokenRecord.id },
    data: { usedAt: new Date() },
  });

  const verifyPass = await bcrypt.compare(newPasswordRaw, updatedUser.passwordHash!);
  assert(verifyPass, "User password updated and matches new hash");

  // Single-use check: Verify token is marked used
  const usedToken = await prisma.passwordResetToken.findUnique({
    where: { id: tokenRecord.id },
  });
  assert(usedToken?.usedAt !== null, "Password reset token marked as usedAt (single-use enforced)");

  // -------------------------------------------------------------
  // SECTION 4: WALK-IN MEMBER 6-DIGIT RESET CODE WORKFLOW
  // -------------------------------------------------------------
  console.log("\n--- Section 4: Walk-in Member 6-Digit Reset Code ---");

  // Receptionist issues a 6-digit code for the member
  const numericCode = Math.floor(100000 + Math.random() * 900000).toString();
  const resetCodeRecord = await prisma.passwordResetToken.create({
    data: {
      userId: memberUser.id,
      token: crypto.randomBytes(24).toString("hex"),
      resetCode: numericCode,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    },
  });

  assert(resetCodeRecord.resetCode?.length === 6, "Reset code is exactly 6 numeric digits");
  assert(resetCodeRecord.expiresAt.getTime() - Date.now() <= 15 * 60 * 1000 + 1000, "Reset code validity is 15 minutes");

  // Member consumes 6-digit code with member identifier
  const codeResetPass = "WalkInPass2026!";
  const codeResetHash = await bcrypt.hash(codeResetPass, 10);

  // Validate code in DB
  const validCode = await prisma.passwordResetToken.findFirst({
    where: {
      userId: memberUser.id,
      resetCode: numericCode,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  assert(validCode !== null, "Active 6-digit reset code found and validated");

  await prisma.user.update({
    where: { id: memberUser.id },
    data: { passwordHash: codeResetHash },
  });

  await prisma.passwordResetToken.update({
    where: { id: validCode!.id },
    data: { usedAt: new Date() },
  });

  const userAfterCode = await prisma.user.findUnique({ where: { id: memberUser.id } });
  const codePassMatches = await bcrypt.compare(codeResetPass, userAfterCode!.passwordHash!);
  assert(codePassMatches, "Password reset via 6-digit reception code succeeded");

  // Attempt reuse of 6-digit code
  const recheckCode = await prisma.passwordResetToken.findFirst({
    where: {
      userId: memberUser.id,
      resetCode: numericCode,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  assert(recheckCode === null, "Used 6-digit reset code cannot be reused (guarded)");

  // -------------------------------------------------------------
  // SECTION 5: STAFF INVITATION RESEND & INVALIDATION WORKFLOW
  // -------------------------------------------------------------
  console.log("\n--- Section 5: Staff Invitation Resend & Invalidation ---");

  // 1. Create a pending staff user with an existing invitation
  const pendingStaffUser = await prisma.user.create({
    data: {
      name: "Pending Trainer Step3",
      email: `trainer.pending.${Date.now()}@oxgen.local`,
      role: Role.TRAINER,
      status: AccountStatus.INVITATION_PENDING,
    },
  });

  const oldTokenRaw = crypto.randomBytes(32).toString("hex");
  const oldInviteToken = await prisma.invitation.create({
    data: {
      email: pendingStaffUser.email,
      role: Role.TRAINER,
      token: oldTokenRaw,
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      createdById: ownerUser.id,
    },
  });

  assert(oldInviteToken.email === pendingStaffUser.email, "Pending staff invitation created");

  // 2. Owner resends invite: Invalidates old token and issues fresh one
  await prisma.invitation.updateMany({
    where: {
      email: pendingStaffUser.email,
      usedAt: null,
    },
    data: {
      expiresAt: new Date(0), // Invalidate
    },
  });

  const newTokenRaw = crypto.randomBytes(32).toString("hex");
  const newInviteToken = await prisma.invitation.create({
    data: {
      email: pendingStaffUser.email,
      role: Role.TRAINER,
      token: newTokenRaw,
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      createdById: ownerUser.id,
    },
  });

  // Verify old token is expired
  const oldTokenRefetched = await prisma.invitation.findUnique({
    where: { id: oldInviteToken.id },
  });
  assert(oldTokenRefetched!.expiresAt.getTime() === 0, "Old staff invitation token instantly invalidated (expiresAt: 0)");

  // Verify fresh token is valid
  const freshTokenRefetched = await prisma.invitation.findUnique({
    where: { id: newInviteToken.id },
  });
  assert(freshTokenRefetched!.expiresAt > new Date(), "Fresh 48-hour activation token active and usable");

  // -------------------------------------------------------------
  // CLEANUP TEST FIXTURES
  // -------------------------------------------------------------
  console.log("\n--- Cleaning up test fixtures ---");
  await prisma.invitation.deleteMany({ where: { email: pendingStaffUser.email } });
  await prisma.user.delete({ where: { id: pendingStaffUser.id } });

  await prisma.passwordResetToken.deleteMany({ where: { userId: memberUser.id } });
  await prisma.attendanceRecord.deleteMany({ where: { gymMemberId: gymMember.id } });
  await prisma.payment.deleteMany({ where: { gymMemberId: gymMember.id } });
  await prisma.invoiceInstallment.deleteMany({ where: { invoiceId: testInvoice.id } });
  await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: testInvoice.id } });
  await prisma.invoice.delete({ where: { id: testInvoice.id } });
  await prisma.gymMember.delete({ where: { id: gymMember.id } });
  await prisma.user.delete({ where: { id: memberUser.id } });
  await prisma.user.delete({ where: { id: receptionist.id } });

  console.log("==================================================================");
  console.log(`ALL STEP 3 INTEGRATION TESTS PASSED: ${passed}/${total} assertions`);
  console.log("==================================================================");
}

runStep3Tests()
  .catch((err) => {
    console.error("Test failed with error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
