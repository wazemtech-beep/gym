import { prisma } from "../src/lib/db";
import {
  Role,
  PaymentMethod,
  PaymentStatus,
  InvoiceStatus,
  MemberRecordStatus,
  InstallmentStatus,
  NotificationCategory,
  NotificationDeliveryStatus,
} from "@prisma/client";
import { allocatePaymentToInvoicesAndInstallments, generateReceiptNumber } from "../src/lib/financialAllocation";
import {
  dispatchNotification,
  runReminderScheduler,
  runScheduledAnnouncementWorker,
  processNotificationOutbox,
} from "../src/lib/notifications";

async function runSteps456Tests() {
  console.log("==================================================================");
  console.log("STEPS 4, 5 & 6 INTEGRATION TEST SUITE");
  console.log("Step 4: Refunds, Advance Credit & Historical Dues Reconstruction");
  console.log("Step 5: Immutable Receipt Snapshots & Report Exports");
  console.log("Step 6: Notification Worker & System Reliability");
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

  // -------------------------------------------------------------
  // SETUP TEST DATA
  // -------------------------------------------------------------
  const ownerUser = await prisma.user.findFirst({ where: { role: Role.OWNER } });
  if (!ownerUser) throw new Error("No owner user found in DB");

  const testMemberUser = await prisma.user.create({
    data: {
      name: "Step 4-5-6 Test Member",
      email: `member.s456.${Date.now()}@oxgen.local`,
      phone: `0321${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: Role.MEMBER,
      status: "ACTIVE",
    },
  });

  const testGymMember = await prisma.gymMember.create({
    data: {
      userId: testMemberUser.id,
      memberId: `MEM-456-${Math.floor(1000 + Math.random() * 9000)}`,
      fullName: testMemberUser.name,
      phone: testMemberUser.phone!,
      email: testMemberUser.email,
      status: MemberRecordStatus.CURRENT,
      advanceBalance: 0,
    },
  });

  // Ensure an OPEN CashSession exists for cash movements
  let openCashSession = await prisma.cashSession.findFirst({
    where: { status: "OPEN" },
  });

  if (!openCashSession) {
    openCashSession = await prisma.cashSession.create({
      data: {
        sessionNumber: `CS-TEST-${Date.now().toString().slice(-5)}`,
        staffId: ownerUser.id,
        openingCash: 50000,
        expectedCash: 50000,
        status: "OPEN",
      },
    });
  }

  const initialExpectedCash = openCashSession.expectedCash;

  // =============================================================
  // SECTION 1: STEP 4 - ADVANCE OVERPAYMENT & REFUND UNSETTLEMENT
  // =============================================================
  console.log("\n--- Section 1: Step 4 - Advance Credit & Member Refund ---");

  // 1. Create Invoice with 2 installments (Rs. 3000 each = Rs. 6000 total)
  const inv1 = await prisma.invoice.create({
    data: {
      title: "Step 4 Test Membership Fee",
      invoiceNumber: `INV-456-${Date.now()}`,
      gymMemberId: testGymMember.id,
      totalAmount: 6000,
      paidAmount: 0,
      balanceAmount: 6000,
      status: InvoiceStatus.UNPAID,
      dueDate: new Date(Date.now() + 7 * 86400000),
      installments: {
        create: [
          {
            installmentNumber: 1,
            amount: 3000,
            dueDate: new Date(Date.now() + 7 * 86400000),
            status: InstallmentStatus.PENDING,
            paidAmount: 0,
          },
          {
            installmentNumber: 2,
            amount: 3000,
            dueDate: new Date(Date.now() + 14 * 86400000),
            status: InstallmentStatus.PENDING,
            paidAmount: 0,
          },
        ],
      },
    },
    include: { installments: true },
  });

  // 2. Member pays Rs. 8,000 in Cash (Rs. 6000 settles inv1, Rs. 2000 is Overpayment Advance Credit)
  const receiptNum1 = await generateReceiptNumber();
  const payment1 = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        receiptNumber: receiptNum1,
        gymMemberId: testGymMember.id,
        amount: 8000,
        method: PaymentMethod.CASH,
        paymentDate: new Date(),
        status: PaymentStatus.CONFIRMED,
        recordedById: ownerUser.id,
      },
    });

    await allocatePaymentToInvoicesAndInstallments(tx, {
      gymMemberId: testGymMember.id,
      paymentId: p.id,
      amount: 8000,
      preferredInvoiceId: inv1.id,
    });

    await tx.cashSession.update({
      where: { id: openCashSession.id },
      data: { expectedCash: { increment: 8000 } },
    });

    return p;
  }, { maxWait: 15000, timeout: 30000 });

  // Verify advance credit state post-payment
  const memberAfterPayment = await prisma.gymMember.findUnique({
    where: { id: testGymMember.id },
  });
  const inv1AfterPayment = await prisma.invoice.findUnique({
    where: { id: inv1.id },
    include: { installments: true },
  });

  assert(memberAfterPayment?.advanceBalance === 2000, "Step 4: Member advanceBalance credited with excess Rs. 2,000");
  assert(inv1AfterPayment?.status === InvoiceStatus.PAID, "Step 4: Invoice 1 marked fully PAID");
  assert(inv1AfterPayment?.balanceAmount === 0, "Step 4: Invoice 1 balanceAmount is 0");
  assert(Boolean(inv1AfterPayment?.installments.every((i) => i.status === InstallmentStatus.PAID)), "Step 4: All installments marked PAID");

  // 3. Issue a partial Refund of Rs. 3,500 with KEEP_FEE_DUE
  // Rs. 2,000 should clear the advance credit to 0
  // Remaining Rs. 1,500 should reopen invoice 1 (paidAmount = 4500, balance = 1500, status = PARTIALLY_PAID)
  // CashSession expectedCash should decrement by 3,500
  const refundRes = await fetch("http://localhost:3000/api/v1/refunds", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Provide owner session authorization header or cookie
    },
    // Using direct API route handler call via fetch requires session cookie;
    // Alternatively test via database transaction logic or session token
  }).catch(() => null);

  // We can execute the refund via the refund endpoint or the exact transactional logic
  // Let's create an active owner session cookie to call the endpoint directly!
  const sessionToken = `test-sess-${Date.now()}`;
  await prisma.session.create({
    data: {
      token: sessionToken,
      userId: ownerUser.id,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    },
  });

  const refundApiResponse = await fetch("http://localhost:3000/api/v1/refunds", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `oxgen_session=${sessionToken}`,
    },
    body: JSON.stringify({
      paymentId: payment1.id,
      amount: 3500,
      feeObligationTreatment: "KEEP_FEE_DUE",
      refundMethod: "CASH",
      reason: "Member requested partial fee refund",
    }),
  });

  const refundData = await refundApiResponse.json();
  assert(refundData.success === true, `Step 4: POST /api/v1/refunds returned success: ${refundData.message}`);
  assert(refundData.refundVoucherNumber.startsWith("OXG-RFD-"), "Step 4: Generated unique voucher number OXG-RFD-***");

  // Verify DB state after refund
  const memberAfterRefund = await prisma.gymMember.findUnique({ where: { id: testGymMember.id } });
  const inv1AfterRefund = await prisma.invoice.findUnique({
    where: { id: inv1.id },
    include: { installments: { orderBy: { installmentNumber: "asc" } } },
  });
  const cashSessionAfterRefund = await prisma.cashSession.findUnique({ where: { id: openCashSession.id } });

  assert(memberAfterRefund?.advanceBalance === 0, "Step 4: Overpayment advance credit was deducted by Rs. 2,000 (balance now 0)");
  assert(inv1AfterRefund?.paidAmount === 4500, `Step 4: Invoice paidAmount correctly reduced to 4,500 (actual: ${inv1AfterRefund?.paidAmount})`);
  assert(inv1AfterRefund?.balanceAmount === 1500, `Step 4: Invoice balanceAmount correctly unsettled to 1,500 (actual: ${inv1AfterRefund?.balanceAmount})`);
  assert(inv1AfterRefund?.status === InvoiceStatus.PARTIALLY_PAID, "Step 4: Invoice status changed from PAID to PARTIALLY_PAID");
  assert(inv1AfterRefund?.installments[1].status === InstallmentStatus.PENDING, "Step 4: Installment 2 reopened to PENDING");
  assert(
    cashSessionAfterRefund?.expectedCash === initialExpectedCash + 8000 - 3500,
    "Step 4: Active CashSession expectedCash decremented by refund amount (Rs. 3,500)"
  );

  // Check Audit Log
  const refundAudit = await prisma.auditLog.findFirst({
    where: {
      action: "MEMBER_REFUND_RECORDED",
      entityId: refundData.refund.id,
    },
  });
  assert(refundAudit !== null, "Step 4: Immutable audit log recorded for member refund");

  // Test over-refund guard: attempting to refund more than remaining Rs. 4,500 refundable
  const overRefundRes = await fetch("http://localhost:3000/api/v1/refunds", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `oxgen_session=${sessionToken}`,
    },
    body: JSON.stringify({
      paymentId: payment1.id,
      amount: 5000, // exceeds 4,500
      reason: "Exceeds remaining",
    }),
  });
  const overRefundData = await overRefundRes.json();
  assert(overRefundRes.status === 400 && overRefundData.success === false, "Step 4: Over-refund exceeding maximum refundable balance rejected with HTTP 400");

  // =============================================================
  // SECTION 2: STEP 4 - HISTORICAL DUES RECONSTRUCTION & EXPORT
  // =============================================================
  console.log("\n--- Section 2: Step 4 - Historical Dues Reconstruction ---");

  // Query dues report with format=csv
  const duesCsvRes = await fetch("http://localhost:3000/api/v1/reports/dues?format=csv", {
    headers: { Cookie: `oxgen_session=${sessionToken}` },
  });
  assert(duesCsvRes.status === 200, "Step 4: Dues CSV export returned HTTP 200");
  const duesCsvText = await duesCsvRes.text();
  assert(
    duesCsvText.includes("Member ID,Member Name,Phone,Membership Plan,Status,Total Outstanding (PKR)"),
    "Step 4: Dues CSV export contains expected column headers"
  );
  assert(duesCsvText.includes(testGymMember.memberId), "Step 4: Test member with unsettled dues is present in CSV");

  // Query historical as-of date (yesterday - before inv1 was created)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const duesHistoricalRes = await fetch(`http://localhost:3000/api/v1/reports/dues?asOfDate=${yesterday}`, {
    headers: { Cookie: `oxgen_session=${sessionToken}` },
  });
  const duesHistoricalData = await duesHistoricalRes.json();
  assert(duesHistoricalData.success === true, "Step 4: Historical dues report query succeeded");
  const memberInPast = duesHistoricalData.duesList.find((d: any) => d.id === testGymMember.id);
  assert(memberInPast === undefined, "Step 4: Historical dues as-of yesterday correctly excludes invoice created today");

  // =============================================================
  // SECTION 3: STEP 5 - IMMUTABLE RECEIPT SNAPSHOTS & COLLECTION EXPORT
  // =============================================================
  console.log("\n--- Section 3: Step 5 - Immutable Receipt Snapshots ---");

  // 1. Create a fresh invoice of Rs. 10,000
  const inv2 = await prisma.invoice.create({
    data: {
      title: "Step 5 Annual Package",
      invoiceNumber: `INV-S5-${Date.now()}`,
      gymMemberId: testGymMember.id,
      totalAmount: 10000,
      paidAmount: 0,
      balanceAmount: 10000,
      status: InvoiceStatus.UNPAID,
      dueDate: new Date(Date.now() + 30 * 86400000),
    },
  });

  // 2. Payment 1: Rs. 4,000
  const p1ReceiptNum = await generateReceiptNumber();
  const paymentRecord1 = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        receiptNumber: p1ReceiptNum,
        gymMemberId: testGymMember.id,
        amount: 4000,
        method: PaymentMethod.CASH,
        paymentDate: new Date(),
        status: PaymentStatus.CONFIRMED,
        recordedById: ownerUser.id,
      },
    });

    await allocatePaymentToInvoicesAndInstallments(tx, {
      gymMemberId: testGymMember.id,
      paymentId: p.id,
      amount: 4000,
      preferredInvoiceId: inv2.id,
    });

    await tx.payment.update({
      where: { id: p.id },
      data: { memberRemainingDues: 6000 },
    });

    return p;
  }, { maxWait: 15000, timeout: 30000 });

  // 3. Inspect Receipt 1 immediately
  const r1Res = await fetch(`http://localhost:3000/api/v1/receipts/${paymentRecord1.id}`, {
    headers: { Cookie: `oxgen_session=${sessionToken}` },
  });
  const r1Data = await r1Res.json();
  assert(r1Data.success === true, "Step 5: GET /api/v1/receipts/[id] for Payment 1 succeeded");
  assert(r1Data.receipt.allocations[0].invoice.balanceAmount === 6000, "Step 5: Receipt 1 displays invoice balance as Rs. 6,000");
  assert(r1Data.receipt.memberRemainingDues === 6000, "Step 5: Receipt 1 displays member remaining dues as Rs. 6,000");

  // 4. Payment 2: Rs. 6,000 (settles inv2 completely to 0 balance)
  const p2ReceiptNum = await generateReceiptNumber();
  const paymentRecord2 = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        receiptNumber: p2ReceiptNum,
        gymMemberId: testGymMember.id,
        amount: 6000,
        method: PaymentMethod.CASH,
        paymentDate: new Date(),
        status: PaymentStatus.CONFIRMED,
        recordedById: ownerUser.id,
      },
    });

    await allocatePaymentToInvoicesAndInstallments(tx, {
      gymMemberId: testGymMember.id,
      paymentId: p.id,
      amount: 6000,
      preferredInvoiceId: inv2.id,
    });

    await tx.payment.update({
      where: { id: p.id },
      data: { memberRemainingDues: 0 },
    });

    return p;
  }, { maxWait: 15000, timeout: 30000 });

  // 5. CRITICAL TEST: Re-fetch Receipt 1! Its balance MUST NOT have changed to 0!
  const r1RecheckRes = await fetch(`http://localhost:3000/api/v1/receipts/${paymentRecord1.id}`, {
    headers: { Cookie: `oxgen_session=${sessionToken}` },
  });
  const r1RecheckData = await r1RecheckRes.json();
  assert(
    r1RecheckData.receipt.allocations[0].invoice.balanceAmount === 6000,
    "Step 5 [IMMUTABILITY]: Receipt 1 invoice balanceAmount REMAINED frozen at Rs. 6,000 after subsequent payment!"
  );
  assert(
    r1RecheckData.receipt.memberRemainingDues === 6000,
    "Step 5 [IMMUTABILITY]: Receipt 1 memberRemainingDues REMAINED frozen at Rs. 6,000!"
  );

  // 6. Inspect Receipt 2 (must show balance 0)
  const r2Res = await fetch(`http://localhost:3000/api/v1/receipts/${paymentRecord2.id}`, {
    headers: { Cookie: `oxgen_session=${sessionToken}` },
  });
  const r2Data = await r2Res.json();
  assert(r2Data.receipt.allocations[0].invoice.balanceAmount === 0, "Step 5: Receipt 2 shows updated post-payment balance Rs. 0");

  // 7. Collection Report CSV Export
  const collectionCsvRes = await fetch("http://localhost:3000/api/v1/reports/collection?format=csv", {
    headers: { Cookie: `oxgen_session=${sessionToken}` },
  });
  assert(collectionCsvRes.status === 200, "Step 5: Collection CSV export returned HTTP 200");
  const collectionCsvText = await collectionCsvRes.text();
  assert(
    collectionCsvText.includes("Receipt No,Date,Member ID,Member Name,Amount (PKR),Method"),
    "Step 5: Collection CSV export contains standard transaction columns"
  );

  // =============================================================
  // SECTION 4: STEP 6 - NOTIFICATION RELIABILITY & WORKER
  // =============================================================
  console.log("\n--- Section 4: Step 6 - Notifications, Logout & Scheduler ---");

  // 1. Un-simulated delivery status test:
  // Without FCM_SERVER_KEY and SMTP configured, dispatch notification requesting PUSH and EMAIL
  const unsimulatedNotification = await dispatchNotification({
    recipientUserId: testMemberUser.id,
    eventType: "TEST_UNSIMULATED",
    title: "Step 6 Reliability Test",
    message: "Verifying that delivery is not falsely marked accepted.",
    category: NotificationCategory.PAYMENT,
    channels: ["IN_APP", "EMAIL", "PUSH"],
    dedupKey: `test-unsim-${Date.now()}`,
  });

  console.log("DEBUG unsimulatedNotification:", unsimulatedNotification);
  assert(unsimulatedNotification.success === true, "Step 6: In-App notification recorded successfully");
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    assert(
      unsimulatedNotification.emailStatus === NotificationDeliveryStatus.ACCEPTED,
      `Step 6: With live SMTP configured, emailStatus is ACCEPTED`
    );
  } else {
    assert(
      unsimulatedNotification.emailStatus === NotificationDeliveryStatus.SKIPPED,
      `Step 6: Without SMTP configured, emailStatus is SKIPPED (not simulated ACCEPTED)`
    );
  }
  assert(
    unsimulatedNotification.pushStatus === NotificationDeliveryStatus.SKIPPED,
    `Step 6: Without FCM gateway configured, pushStatus is SKIPPED (not simulated ACCEPTED)`
  );

  // 2. Device Push Token Registration & Logout Unlinking
  const testPushToken1 = `fcm-token-1-${Date.now()}`;
  const testPushToken2 = `fcm-token-2-${Date.now()}`;

  await prisma.devicePushToken.createMany({
    data: [
      { userId: testMemberUser.id, token: testPushToken1, platform: "android" },
      { userId: testMemberUser.id, token: testPushToken2, platform: "android" },
    ],
  });

  const tokensBefore = await prisma.devicePushToken.findMany({ where: { userId: testMemberUser.id } });
  assert(tokensBefore.length === 2, "Step 6: Successfully registered 2 device push tokens for member");

  // Create member session to test logout unlinking
  const memberSessionToken = `member-sess-${Date.now()}`;
  await prisma.session.create({
    data: {
      token: memberSessionToken,
      userId: testMemberUser.id,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    },
  });

  // Call POST /api/auth/logout with single device token
  const singleLogoutRes = await fetch("http://localhost:3000/api/auth/logout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `oxgen_session=${memberSessionToken}`,
    },
    body: JSON.stringify({ deviceToken: testPushToken1 }),
  });
  const singleLogoutData = await singleLogoutRes.json();
  assert(singleLogoutData.success === true, "Step 6: Single-device logout API responded success");

  const tokensAfterSingleLogout = await prisma.devicePushToken.findMany({ where: { userId: testMemberUser.id } });
  assert(
    tokensAfterSingleLogout.length === 1 && tokensAfterSingleLogout[0].token === testPushToken2,
    "Step 6: Single device logout correctly unlinked specified device token while preserving other devices"
  );

  // Call logout-all-devices
  const memberSessionToken2 = `member-sess-2-${Date.now()}`;
  await prisma.session.create({
    data: {
      token: memberSessionToken2,
      userId: testMemberUser.id,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    },
  });

  const allDevicesLogoutRes = await fetch("http://localhost:3000/api/auth/logout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `oxgen_session=${memberSessionToken2}`,
    },
    body: JSON.stringify({ allDevices: true }),
  });
  const allDevicesData = await allDevicesLogoutRes.json();
  assert(allDevicesData.success === true, "Step 6: Logout all devices API responded success");

  const tokensAfterAllLogout = await prisma.devicePushToken.findMany({ where: { userId: testMemberUser.id } });
  assert(tokensAfterAllLogout.length === 0, "Step 6: Logout-all-devices removed ALL registered device push tokens for user");

  // 3. Scheduled Announcement Worker & Reminders Integration
  // Create an unbroadcasted scheduled announcement whose publishAt is in the past
  const scheduledAnnouncement = await prisma.announcement.create({
    data: {
      title: "Step 6 Scheduled Blast",
      content: "Exclusive gym workshop announcement scheduled for broadcast.",
      category: "EVENTS",
      audience: "ALL_MEMBERS",
      publishAt: new Date(Date.now() - 60000), // 1 minute ago
      isPublished: true,
      recipientCount: 0,
      authorId: ownerUser.id,
      channels: ["IN_APP"],
    },
  });

  // Call the enhanced background scheduler endpoint
  const schedulerApiRes = await fetch("http://localhost:3000/api/v1/scheduler/reminders", {
    method: "POST",
    headers: {
      Cookie: `oxgen_session=${sessionToken}`,
    },
  });
  const schedulerApiData = await schedulerApiRes.json();
  assert(schedulerApiRes.status === 200 && schedulerApiData.success === true, "Step 6: POST /api/v1/scheduler/reminders executed successfully");
  assert("reminders" in schedulerApiData.data, "Step 6: Scheduler executed fee & expiry reminders");
  assert("announcements" in schedulerApiData.data, "Step 6: Scheduler executed announcement broadcast worker");
  assert("outbox" in schedulerApiData.data, "Step 6: Scheduler executed notification outbox processor");

  // Verify scheduled announcement was processed by worker
  const broadcastedAnn = await prisma.announcement.findUnique({
    where: { id: scheduledAnnouncement.id },
  });
  assert(broadcastedAnn !== null && broadcastedAnn.recipientCount > 0, `Step 6: Scheduled announcement broadcasted to ${broadcastedAnn?.recipientCount} recipients`);

  // Verify member received in-app announcement notification
  const memberNotification = await prisma.notification.findFirst({
    where: {
      userId: testMemberUser.id,
      announcementId: scheduledAnnouncement.id,
    },
  });
  assert(memberNotification !== null, "Step 6: Member received in-app notification from scheduled announcement broadcast");

  console.log("\n==================================================================");
  console.log(`ALL TESTS PASSED: ${passed}/${total} assertions successful!`);
  console.log("==================================================================");
}

runSteps456Tests()
  .catch((err) => {
    console.error("TEST EXECUTION FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
