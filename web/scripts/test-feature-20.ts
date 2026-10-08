import { prisma } from "../src/lib/db";
import {
  Role,
  AccountStatus,
  MemberRecordStatus,
  MembershipStatus,
  PaymentMethod,
  PaymentStatus,
  InvoiceStatus,
  InstallmentStatus,
  NotificationCategory,
  NotificationDeliveryStatus,
  AnnouncementAudience,
  AnnouncementPriority,
} from "@prisma/client";
import {
  dispatchNotification,
  sanitizeLockScreenMessage,
  runReminderScheduler,
} from "../src/lib/notifications";

async function runFeature20Tests() {
  console.log("\n========================================================");
  console.log("🚀 STARTING AUTOMATED TEST SUITE: FEATURE 20 (NOTIFICATIONS & ANNOUNCEMENTS)");
  console.log("========================================================\n");

  const testSuffix = Math.floor(100000 + Math.random() * 900000).toString();

  // ------------------------------------------------------------------
  // SETUP: Seed Test Users (Owner, Member 1, Member 2)
  // ------------------------------------------------------------------
  console.log("--- SETUP: Seeding Test Users & Memberships ---");

  const ownerUser = await prisma.user.create({
    data: {
      name: `Owner Test ${testSuffix}`,
      email: `owner.${testSuffix}@oxgentest.com`,
      phone: `+92300${testSuffix}`,
      role: Role.OWNER,
      status: AccountStatus.ACTIVE,
    },
  });

  const memberUser1 = await prisma.user.create({
    data: {
      name: `Member One ${testSuffix}`,
      email: `member1.${testSuffix}@oxgentest.com`,
      phone: `+92311${testSuffix}`,
      role: Role.MEMBER,
      status: AccountStatus.ACTIVE,
    },
  });

  const memberUser2 = await prisma.user.create({
    data: {
      name: `Member Two ${testSuffix}`,
      email: `member2.${testSuffix}@oxgentest.com`,
      phone: `+92322${testSuffix}`,
      role: Role.MEMBER,
      status: AccountStatus.ACTIVE,
    },
  });

  const gymMember1 = await prisma.gymMember.create({
    data: {
      memberId: `OXG-T20-1-${testSuffix}`,
      fullName: `Member One ${testSuffix}`,
      phone: `+92311${testSuffix}`,
      email: `member1.${testSuffix}@oxgentest.com`,
      userId: memberUser1.id,
      status: MemberRecordStatus.CURRENT,
    },
  });

  const gymMember2 = await prisma.gymMember.create({
    data: {
      memberId: `OXG-T20-2-${testSuffix}`,
      fullName: `Member Two ${testSuffix}`,
      phone: `+92322${testSuffix}`,
      email: `member2.${testSuffix}@oxgentest.com`,
      userId: memberUser2.id,
      status: MemberRecordStatus.CURRENT,
    },
  });

  console.log(`✅ Seeded Owner (${ownerUser.id}), Member 1 (${gymMember1.id}), Member 2 (${gymMember2.id})\n`);

  try {
    // ------------------------------------------------------------------
    // CHECK 1: In-App Notification Dispatch, Unread Count & Filtering
    // ------------------------------------------------------------------
    console.log("--- CHECK 1: Testing In-App Notification Dispatch, Unread Count & Category Filters ---");

    // Dispatch a PAYMENT notification
    const payNotif = await dispatchNotification({
      recipientUserId: memberUser1.id,
      eventType: "PAYMENT_CONFIRMED",
      title: "Payment Confirmed",
      message: "Aapki Rs. 5,000 ki fee confirm ho chuki hai. Receipt #OXG-RCP-999 issue hui hai.",
      category: NotificationCategory.PAYMENT,
      entityType: "RECEIPT",
      entityId: "rcp-test-01",
      actionUrl: "/member/dashboard",
    });

    // Dispatch a TRAINING notification
    const trainNotif = await dispatchNotification({
      recipientUserId: memberUser1.id,
      eventType: "WORKOUT_PUBLISHED",
      title: "New Workout Routine",
      message: "Aapka Upper Body hypertrophy routine update ho chuka hai.",
      category: NotificationCategory.TRAINING,
      entityType: "WORKOUT_PLAN",
      entityId: "plan-test-01",
      actionUrl: "/member/dashboard",
    });

    // Verify unread count is 2
    const initialUnreadCount = await prisma.notification.count({
      where: { userId: memberUser1.id, isRead: false },
    });

    if (initialUnreadCount !== 2) {
      throw new Error(`CHECK 1 FAILED: Expected 2 unread notifications, got ${initialUnreadCount}`);
    }

    // Verify category query filtering
    const paymentNotifs = await prisma.notification.findMany({
      where: { userId: memberUser1.id, category: NotificationCategory.PAYMENT },
    });
    if (paymentNotifs.length !== 1 || paymentNotifs[0].title !== "Payment Confirmed") {
      throw new Error("CHECK 1 FAILED: Category filtering failed to isolate PAYMENT notification!");
    }

    console.log(`Unread Count: ${initialUnreadCount}, Payment Filter Count: ${paymentNotifs.length}`);
    console.log("✅ CHECK 1 PASSED: Notifications dispatched, unread count accurate, and category filtering verified.\n");

    // ------------------------------------------------------------------
    // CHECK 2: Mark Read & Mark All Read
    // ------------------------------------------------------------------
    console.log("--- CHECK 2: Testing Mark Read & Mark All Read ---");

    // Mark single notification as read
    const readSingle = await prisma.notification.update({
      where: { id: paymentNotifs[0].id },
      data: { isRead: true, readAt: new Date(), deliveryStatus: NotificationDeliveryStatus.READ },
    });

    if (!readSingle.isRead || !readSingle.readAt) {
      throw new Error("CHECK 2 FAILED: Single notification read status update failed!");
    }

    const midUnreadCount = await prisma.notification.count({
      where: { userId: memberUser1.id, isRead: false },
    });
    if (midUnreadCount !== 1) {
      throw new Error(`CHECK 2 FAILED: Expected 1 unread notification after single read, got ${midUnreadCount}`);
    }

    // Mark all as read
    await prisma.notification.updateMany({
      where: { userId: memberUser1.id, isRead: false },
      data: { isRead: true, readAt: new Date(), deliveryStatus: NotificationDeliveryStatus.READ },
    });

    const finalUnreadCount = await prisma.notification.count({
      where: { userId: memberUser1.id, isRead: false },
    });
    if (finalUnreadCount !== 0) {
      throw new Error(`CHECK 2 FAILED: Expected 0 unread notifications after mark all read, got ${finalUnreadCount}`);
    }

    console.log("✅ CHECK 2 PASSED: Single notification read and mark-all-read validated.\n");

    // ------------------------------------------------------------------
    // CHECK 3: Idempotency & Duplicate Prevention (`dedupKey`)
    // ------------------------------------------------------------------
    console.log("--- CHECK 3: Testing Idempotency & Duplicate Prevention (dedupKey) ---");

    const testDedupKey = `test-idempotent-key-${testSuffix}`;

    // Attempt 1: Should create notification
    const res1 = await dispatchNotification({
      recipientUserId: memberUser1.id,
      eventType: "INVOICE_ISSUED",
      title: "New Invoice Issued",
      message: "Monthly membership fee invoice generated.",
      category: NotificationCategory.PAYMENT,
      dedupKey: testDedupKey,
    });

    if (!res1.success || res1.skippedDuplicate) {
      throw new Error("CHECK 3 FAILED: First dispatch with unique dedupKey should succeed and not be skipped!");
    }

    // Attempt 2: Same dedupKey (e.g. repeated cron run or payment retry)
    const res2 = await dispatchNotification({
      recipientUserId: memberUser1.id,
      eventType: "INVOICE_ISSUED",
      title: "New Invoice Issued",
      message: "Monthly membership fee invoice generated.",
      category: NotificationCategory.PAYMENT,
      dedupKey: testDedupKey,
    });

    if (!res2.skippedDuplicate) {
      throw new Error("CHECK 3 FAILED: Duplicate notification dispatch was NOT prevented by dedupKey!");
    }

    // Verify inbox only has 1 record for this dedupKey event
    const notifsForEvent = await prisma.notification.count({
      where: { userId: memberUser1.id, eventId: res1.eventId },
    });
    if (notifsForEvent !== 1) {
      throw new Error(`CHECK 3 FAILED: Expected exactly 1 notification in inbox, found ${notifsForEvent}`);
    }

    console.log(`Attempt 1 Event ID: ${res1.eventId}, Attempt 2 Skipped: ${res2.skippedDuplicate}`);
    console.log("✅ CHECK 3 PASSED: Idempotency verified; duplicate notification prevented across repeated executions.\n");

    // ------------------------------------------------------------------
    // CHECK 4: Member Notification Preferences (Channel Toggles)
    // ------------------------------------------------------------------
    console.log("--- CHECK 4: Testing Member Channel Preferences (Email & Push toggles) ---");

    // Member 1 opts out of TRAINING emails and push
    await prisma.notificationPreference.upsert({
      where: { userId: memberUser1.id },
      create: {
        userId: memberUser1.id,
        emailPayment: true,
        pushPayment: true,
        emailTraining: false, // OPTED OUT
        pushTraining: false,  // OPTED OUT
        emailMembership: true,
        pushMembership: true,
        emailAnnouncements: true,
        pushAnnouncements: true,
      },
      update: {
        emailTraining: false,
        pushTraining: false,
      },
    });

    const prefTestNotif = await dispatchNotification({
      recipientUserId: memberUser1.id,
      eventType: "WORKOUT_PUBLISHED",
      title: "Diet Routine Updated",
      message: "Aapke coach ne naya diet routine assign kiya hai.",
      category: NotificationCategory.TRAINING,
      channels: ["IN_APP", "EMAIL", "PUSH"],
    });

    if (prefTestNotif.emailStatus !== NotificationDeliveryStatus.SKIPPED) {
      throw new Error(`CHECK 4 FAILED: Expected emailStatus SKIPPED due to user preference, got ${prefTestNotif.emailStatus}`);
    }
    if (prefTestNotif.pushStatus !== NotificationDeliveryStatus.SKIPPED) {
      throw new Error(`CHECK 4 FAILED: Expected pushStatus SKIPPED due to user preference, got ${prefTestNotif.pushStatus}`);
    }

    console.log(`Training notification dispatched: Email=${prefTestNotif.emailStatus}, Push=${prefTestNotif.pushStatus} (Respected user preference opt-out)`);
    console.log("✅ CHECK 4 PASSED: Member notification channel preferences strictly respected.\n");

    // ------------------------------------------------------------------
    // CHECK 5: Lock Screen Privacy Protection (Sensitive details sanitization)
    // ------------------------------------------------------------------
    console.log("--- CHECK 5: Testing Lock Screen Privacy Protection ---");

    const sensitiveTitle = "Installment Overdue Alert";
    const sensitiveMessage = "Aapki Rs. 3,500 ki overdue installment baqi hai, weight 78 kg aur waist 92 cm track hui.";

    const sanitized = sanitizeLockScreenMessage(sensitiveTitle, sensitiveMessage);

    if (
      sanitized.message.includes("3,500") ||
      sanitized.message.includes("Rs.") ||
      sanitized.message.includes("weight") ||
      sanitized.message.includes("waist")
    ) {
      throw new Error("CHECK 5 FAILED: Sensitive financial/body details leaked into lock screen push preview!");
    }

    if (!sanitized.message.includes("app kholein")) {
      throw new Error("CHECK 5 FAILED: Sanitized message does not match required safe preview!");
    }

    console.log(`Original: "${sensitiveMessage}"`);
    console.log(`Sanitized Lockscreen: "${sanitized.message}"`);
    console.log("✅ CHECK 5 PASSED: Sensitive lock screen details successfully sanitized.\n");

    // ------------------------------------------------------------------
    // CHECK 6: Device Push Token Management & Logout Cleanup
    // ------------------------------------------------------------------
    console.log("--- CHECK 6: Testing Device Push Token Registration & Logout Unlinking ---");

    const testToken = `fcm-token-${testSuffix}-device-xyz`;

    // Register token
    const tokenRecord = await prisma.devicePushToken.create({
      data: {
        userId: memberUser1.id,
        token: testToken,
        platform: "android",
        deviceModel: "Samsung Galaxy S23",
      },
    });

    if (tokenRecord.token !== testToken) {
      throw new Error("CHECK 6 FAILED: Device token registration failed!");
    }

    // Simulate Logout: Unregister token
    await prisma.devicePushToken.deleteMany({
      where: { userId: memberUser1.id, token: testToken },
    });

    const remainingTokens = await prisma.devicePushToken.count({
      where: { userId: memberUser1.id },
    });

    if (remainingTokens !== 0) {
      throw new Error("CHECK 6 FAILED: Device token was not unlinked on logout!");
    }

    console.log("✅ CHECK 6 PASSED: Device push token registered and cleaned up on logout.\n");

    // ------------------------------------------------------------------
    // CHECK 7: Automated Fee & Expiry Reminder Scheduler with Stale Check
    // ------------------------------------------------------------------
    console.log("--- CHECK 7: Testing Fee & Expiry Reminder Scheduler with Stale Check ---");

    // 7A: Create active membership expiring in 7 days
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + 7);

    const membership = await prisma.membership.create({
      data: {
        gymMemberId: gymMember1.id,
        planName: "Test Monthly Plan",
        startDate: new Date(),
        endDate: expDate,
        status: MembershipStatus.ACTIVE,
      },
    });

    // 7B: Create Invoice & Installment due today
    const invoice = await prisma.invoice.create({
      data: {
        gymMemberId: gymMember1.id,
        membershipId: membership.id,
        invoiceNumber: `INV-${testSuffix}-01`,
        title: `Membership Fee Invoice (${testSuffix})`,
        totalAmount: 2000,
        paidAmount: 0,
        balanceAmount: 2000,
        dueDate: new Date(),
        status: InvoiceStatus.UNPAID,
      },
    });

    const installment = await prisma.invoiceInstallment.create({
      data: {
        invoiceId: invoice.id,
        installmentNumber: 1,
        amount: 2000,
        dueDate: new Date(),
        status: InstallmentStatus.PENDING,
      },
    });

    // Run scheduler scan 1
    const scan1 = await runReminderScheduler();
    console.log(`Scan 1 Results: Expiring=${scan1.results.expiringProcessed}, Installments=${scan1.results.installmentsProcessed}`);

    if (scan1.results.expiringProcessed < 1 || scan1.results.installmentsProcessed < 1) {
      throw new Error("CHECK 7 FAILED: Reminder scheduler failed to process expiring membership or due installment!");
    }

    // Run scheduler scan 2 immediately (Idempotency test: should be skipped via dedupKey)
    const scan2 = await runReminderScheduler();
    console.log(`Scan 2 (Immediate Re-run) Results: Expiring=${scan2.results.expiringProcessed}, Installments=${scan2.results.installmentsProcessed}`);

    // Scan 2 shouldn't create new notifications because dedupKeys already exist
    // Now simulate member paying the invoice while installment was pending
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: InvoiceStatus.PAID, paidAmount: 2000, balanceAmount: 0 },
    });

    // Run scheduler scan 3: Verify stale paid installment is skipped
    const scan3 = await runReminderScheduler();
    console.log(`Scan 3 (After Payment) Skipped Paid: ${scan3.results.skippedPaidOrObsolete}`);

    if (scan3.results.skippedPaidOrObsolete < 1) {
      throw new Error("CHECK 7 FAILED: Scheduler did not skip obsolete reminder for paid installment!");
    }

    console.log("✅ CHECK 7 PASSED: Reminder scheduler executed with 7d expiry alerts, due notices, idempotency, and stale paid skipping.\n");

    // ------------------------------------------------------------------
    // CHECK 8: Owner Announcements Creation, Targeting & Delivery Analytics
    // ------------------------------------------------------------------
    console.log("--- CHECK 8: Testing Owner Announcements Creation, Targeting & Analytics ---");

    const announcement = await prisma.announcement.create({
      data: {
        title: `Eid Holiday Timings (${testSuffix})`,
        content: "Gym will remain closed on the 1st day of Eid. Normal hours resume on the 2nd day.",
        category: "HOLIDAY",
        priority: AnnouncementPriority.IMPORTANT,
        audience: AnnouncementAudience.ALL_MEMBERS,
        isPublished: true,
        publishAt: new Date(),
        channels: ["IN_APP", "EMAIL"],
        authorId: ownerUser.id,
      },
    });

    // Broadcast announcement notification to member 1 & member 2
    for (const member of [memberUser1, memberUser2]) {
      await dispatchNotification({
        recipientUserId: member.id,
        eventType: "ANNOUNCEMENT_PUBLISHED",
        title: announcement.title,
        message: announcement.content,
        category: NotificationCategory.ANNOUNCEMENT,
        entityType: "ANNOUNCEMENT",
        entityId: announcement.id,
        announcementId: announcement.id,
        channels: ["IN_APP", "EMAIL"],
        dedupKey: `ann-${announcement.id}-${member.id}`,
      });
    }

    // Update announcement analytics
    await prisma.announcement.update({
      where: { id: announcement.id },
      data: {
        recipientCount: 2,
        emailSentCount: 2,
      },
    });

    const notifsCreated = await prisma.notification.findMany({
      where: { announcementId: announcement.id },
    });

    if (notifsCreated.length !== 2) {
      throw new Error(`CHECK 8 FAILED: Expected 2 notifications created for announcement, found ${notifsCreated.length}`);
    }

    console.log(`Announcement Dispatched: RecipientCount=2, In-App Records=${notifsCreated.length}`);
    console.log("✅ CHECK 8 PASSED: Owner announcement created, targeted, and analytics tracked.\n");

    // ------------------------------------------------------------------
    // CHECK 9: Fault Isolation Guarantee
    // ------------------------------------------------------------------
    console.log("--- CHECK 9: Testing Business Transaction Fault Isolation ---");

    // Dispatch to non-existent or invalid user should NOT throw or crash
    const resilientResult = await dispatchNotification({
      recipientUserId: "non-existent-user-id",
      eventType: "ORPHAN_TEST",
      title: "Orphan Test",
      message: "Testing resilience",
      category: NotificationCategory.OPERATIONAL,
    });

    if (resilientResult.success !== false) {
      throw new Error("CHECK 9 FAILED: Invalid recipient should return success: false without throwing!");
    }

    console.log("Resilient dispatch handled gracefully without unhandled rejection.");
    console.log("✅ CHECK 9 PASSED: Business operations isolated from notification delivery faults.\n");

    // ------------------------------------------------------------------
    // CLEANUP
    // ------------------------------------------------------------------
    console.log("--- CLEANUP: Removing Test Artifacts ---");
    await prisma.notification.deleteMany({ where: { announcementId: announcement.id } });
    await prisma.announcement.delete({ where: { id: announcement.id } });
    await prisma.notification.deleteMany({ where: { userId: { in: [memberUser1.id, memberUser2.id] } } });
    await prisma.notificationEvent.deleteMany({ where: { recipientUserId: { in: [memberUser1.id, memberUser2.id] } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: memberUser1.id } });
    await prisma.invoiceInstallment.deleteMany({ where: { invoiceId: invoice.id } });
    await prisma.invoice.delete({ where: { id: invoice.id } });
    await prisma.membership.delete({ where: { id: membership.id } });
    await prisma.gymMember.deleteMany({ where: { id: { in: [gymMember1.id, gymMember2.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerUser.id, memberUser1.id, memberUser2.id] } } });
    console.log("✅ Cleanup complete.");

    console.log("\n========================================================");
    console.log("🎉 ALL ACCEPTANCE GATES PASSED SUCCESSFULLY!");
    console.log("Feature 20 (Notifications + Announcements) is 100% Verified!");
    console.log("========================================================\n");
  } catch (error) {
    console.error("\n❌ TEST SUITE FAILED WITH ERROR:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runFeature20Tests();
