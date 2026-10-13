import { prisma } from "@/lib/db";
import {
  NotificationCategory,
  NotificationDeliveryStatus,
  Role,
} from "@prisma/client";
import { createSmtpTransport } from "./smtpTransport";
import { sendPushNotification } from "@/lib/firebaseAdmin";
import type { Prisma } from "@prisma/client";
import { generateReceiptPdf } from "@/lib/pdfGenerator";
import { acquireJobLease, releaseJobLease } from "./jobLease";

export interface DispatchNotificationParams {
  recipientUserId: string;
  eventType: string; // e.g. "INVOICE_ISSUED", "PAYMENT_CONFIRMED", "INSTALLMENT_DUE", "MEMBERSHIP_EXPIRING", "WORKOUT_PUBLISHED", "DIET_PUBLISHED", "ANNOUNCEMENT"
  title: string;
  message: string;
  category: NotificationCategory;
  entityType?: string; // "RECEIPT", "INVOICE", "WORKOUT_PLAN", "DIET_PLAN", "ANNOUNCEMENT"
  entityId?: string;
  actionUrl?: string;
  dedupKey?: string; // Idempotent key to prevent duplicates
  channels?: Array<"IN_APP" | "EMAIL" | "PUSH">;
  announcementId?: string;
  metadata?: any;
  existingEventId?: string;
}

export async function enqueueNotification(tx: Prisma.TransactionClient, params: DispatchNotificationParams) {
  return tx.notificationEvent.create({ data: { recipientUserId: params.recipientUserId, eventType: params.eventType, title: params.title, message: params.message, category: params.category, entityType: params.entityType, entityId: params.entityId, actionUrl: params.actionUrl, dedupKey: params.dedupKey, metadata: { ...params.metadata, channels: params.channels || ["IN_APP", "EMAIL", "PUSH"], attempts: 0 }, processed: false } });
}

export async function deferNotification(params: DispatchNotificationParams) {
  if (!params.dedupKey) throw new Error("Deferred notifications need an idempotency key");
  const event = await prisma.notificationEvent.upsert({
    where: { dedupKey: params.dedupKey }, update: {},
    create: { recipientUserId: params.recipientUserId, eventType: params.eventType, title: params.title, message: params.message, category: params.category, entityType: params.entityType, entityId: params.entityId, actionUrl: params.actionUrl, dedupKey: params.dedupKey, metadata: { ...params.metadata, channels: params.channels || ["IN_APP", "EMAIL", "PUSH"], attempts: 0, announcementId: params.announcementId }, processed: false },
  });
  return { success: true, eventId: event.id, queued: true };
}

/**
 * Requirement 7: Lockscreen Privacy
 * "Phone lock screen par sensitive details default hide hongi.
 * Dues amount, injury, weight ya diet details push preview mein nahi."
 */
export function sanitizeLockScreenMessage(title: string, message: string): { title: string; message: string } {
  const sensitiveRegex = /(rs\.?|\bdues\b|\boverdue\b|\bweight\b|\bkg\b|\bwaist\b|\binjury\b|\bdiet\b|\bcalories\b|\bportion\b)/i;
  if (sensitiveRegex.test(message) || sensitiveRegex.test(title)) {
    return {
      title: "OXGEN GYM Alert",
      message: "Aapke OXGEN GYM account mein nayi update aayi hai — tafseelat dekhne ke liye app kholein.",
    };
  }
  return { title, message };
}

/**
 * Dispatch an idempotent notification across In-App, Email, and Push channels.
 * Isolation guarantee: delivery errors NEVER throw or cancel business transactions.
 */
export async function dispatchNotification(params: DispatchNotificationParams) {
  let deliveryLease: { key: string; owner: string } | undefined;
  try {
    const {
      recipientUserId,
      eventType,
      title,
      message,
      category,
      entityType,
      entityId,
      actionUrl,
      dedupKey,
      channels = ["IN_APP", "EMAIL", "PUSH"],
      announcementId,
      metadata,
    } = params;

    // 1. Idempotency Check: if dedupKey already processed, prevent duplicate!
    let event: any = null;
    if ((params as any).existingEventId) {
      event = await prisma.notificationEvent.findUnique({
        where: { id: (params as any).existingEventId },
      });
    }

    if (!event && dedupKey) {
      const existing = await prisma.notificationEvent.findUnique({
        where: { dedupKey },
      });
      if (existing) {
        if (existing.processed) {
          return {
            success: true,
            skippedDuplicate: true,
            eventId: existing.id,
            message: "Notification skipped: duplicate event already processed.",
          };
        }
        event = existing;
      }
    }

    if (event?.processed) return { success: true, duplicate: true, eventId: event.id };
    // 2. Persist event into the outbox if not already existing
    if (!event) {
      event = await prisma.notificationEvent.create({
        data: {
          recipientUserId,
          eventType,
          title,
          message,
          category,
          dedupKey: dedupKey || undefined,
          entityType,
          entityId,
          actionUrl,
          metadata: { ...metadata, channels, attempts: 0, announcementId },
          processed: false,
        },
      });
    }

    const leaseKey = `notification:${event.id}`;
    const leaseOwner = await acquireJobLease(leaseKey);
    if (!leaseOwner) return { success: true, queued: true, eventId: event.id };
    deliveryLease = { key: leaseKey, owner: leaseOwner };
    if ((await prisma.notificationEvent.findUnique({ where: { id: event.id }, select: { processed: true } }))?.processed) return { success: true, duplicate: true, eventId: event.id };
    if (["ANNOUNCEMENT_PUBLISHED", "ANNOUNCEMENT_UPDATED"].includes(eventType) && entityId) {
      const live = await prisma.announcement.findUnique({ where: { id: entityId }, select: { isPublished: true, publishAt: true, expiresAt: true } });
      if (!live?.isPublished || (live.expiresAt && live.expiresAt <= new Date())) {
        await prisma.notificationEvent.update({ where: { id: event.id }, data: { processed: true } });
        return { success: true, skipped: true, eventId: event.id };
      }
      if (live.publishAt > new Date()) return { success: true, queued: true, eventId: event.id };
    }

    // 3. Fetch recipient user + preferences + devices
    const user = await prisma.user.findUnique({
      where: { id: recipientUserId },
      include: {
        notificationPreferences: true,
        deviceTokens: true,
      },
    });

    if (!user) {
      await prisma.notificationEvent.update({
        where: { id: event.id },
        data: { processed: true },
      });
      return { success: false, error: "Recipient user not found." };
    }

    const prefs = user.notificationPreferences;
    const defaults = (await prisma.gymSettings.findFirst({ select: { notificationPrefs: true } }))?.notificationPrefs as any;
    const eventDefaults = defaults?.[eventType] || defaults?.[category];

    // Check category preferences
    let allowEmail = true;
    let allowPush = true;

    if (prefs) {
      if (category === NotificationCategory.PAYMENT) {
        allowEmail = prefs.emailPayment;
        allowPush = prefs.pushPayment;
      } else if (category === NotificationCategory.MEMBERSHIP) {
        allowEmail = prefs.emailMembership;
        allowPush = prefs.pushMembership;
      } else if (category === NotificationCategory.TRAINING) {
        allowEmail = prefs.emailTraining;
        allowPush = prefs.pushTraining;
      } else if (category === NotificationCategory.ANNOUNCEMENT) {
        allowEmail = prefs.emailAnnouncements;
        allowPush = prefs.pushAnnouncements;
      }
    }

    if (eventDefaults && eventType !== "EMAIL_CHANGE_VERIFICATION") {
      if (eventDefaults.email === false) allowEmail = false;
      if (eventDefaults.push === false) allowPush = false;
    }
    // 4. Create In-App Notification (Always enabled if IN_APP channel requested)
    const previousDelivery = await prisma.notification.findFirst({ where: { eventId: event.id } });
    let inAppNotification = previousDelivery;
    if (channels.includes("IN_APP") && !inAppNotification) {
      inAppNotification = await prisma.notification.create({
        data: {
          userId: recipientUserId,
          title,
          message,
          category,
          entityType,
          entityId,
          actionUrl,
          deliveryStatus: NotificationDeliveryStatus.ACCEPTED,
          eventId: event.id,
          announcementId,
        },
      });
    }

    // 5. Email Delivery Attempt
    let emailStatus: NotificationDeliveryStatus = previousDelivery?.emailStatus || NotificationDeliveryStatus.SKIPPED;
    let emailError: string | null = null;

    const deliveryEmail = event.eventType === "EMAIL_CHANGE_VERIFICATION" ? event.metadata?.verificationEmail : user.email;
    const siteOrigin = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    const emailActionUrl = actionUrl?.startsWith("/") && siteOrigin ? new URL(actionUrl, siteOrigin).toString() : actionUrl;
    if (channels.includes("EMAIL") && allowEmail && emailStatus !== NotificationDeliveryStatus.ACCEPTED) {
      if (deliveryEmail) {
        const transporter = await createSmtpTransport();
        if (transporter) {
          try {
            let attachments: Array<{ filename: string; content: Buffer }> = [];
            if (event.eventType === "RECEIPT_EMAIL" && event.entityId) {
              const payment = await prisma.payment.findUnique({ where: { id: event.entityId }, include: { gymMember: true, recordedBy: true } });
              if (!payment || payment.gymMember.userId !== recipientUserId || payment.status !== "CONFIRMED") throw new Error("Receipt is no longer eligible for delivery.");
              const snapshot = payment.brandingSnapshot as any;
              attachments = [{ filename: `${payment.receiptNumber}.pdf`, content: generateReceiptPdf({ receiptNumber: payment.receiptNumber, paymentDate: payment.paymentDate.toISOString(), memberName: snapshot?.memberName || payment.gymMember.fullName, memberId: snapshot?.memberId || payment.gymMember.memberId, memberPhone: snapshot?.memberPhone || payment.gymMember.phone, amount: payment.amount, method: payment.method, recordedBy: payment.recordedBy.name, memberRemainingDues: payment.memberRemainingDues ?? undefined, gymName: snapshot?.gymName, gymPhone: snapshot?.contactPhone, gymAddress: snapshot?.address, receiptFooter: snapshot?.receiptFooter }) }];
            }
            await transporter.sendMail({
              from: `"OXGEN GYM" <${process.env.SMTP_USER || "noreply@oxgengym.com"}>`,
              to: deliveryEmail,
              subject: `[OXGEN GYM] ${title}`,
              attachments,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                  <div style="background: #0f172a; padding: 16px; border-radius: 6px; text-align: center; color: #f97316; font-weight: bold; font-size: 20px; letter-spacing: 1px;">
                    OXGEN GYM
                  </div>
                  <div style="padding: 24px 8px; color: #1e293b;">
                    <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">${title}</h2>
                    <p style="font-size: 15px; line-height: 1.6; color: #334155;">${message}</p>
                    ${
                      actionUrl
                        ? `<div style="margin-top: 24px;">
                            <a href="${emailActionUrl}" style="background: #f97316; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">View in App</a>
                          </div>`
                        : ""
                    }
                  </div>
                  <div style="border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 12px; color: #64748b; text-align: center;">
                    Yeh automatic notification hai. Apni preferences member settings mein manage karein.
                  </div>
                </div>
              `,
            });
            emailStatus = NotificationDeliveryStatus.ACCEPTED;
          } catch (err: any) {
            console.error("SMTP_SEND_FAILED:", err.message);
            emailStatus = NotificationDeliveryStatus.FAILED;
            emailError = err.message;
          } finally { transporter.close(); }
        } else {
          // If SMTP not configured, report skipped accurately without fake simulation
          emailStatus = NotificationDeliveryStatus.SKIPPED;
          emailError = "SMTP mail service not configured on server (SMTP_USER/SMTP_PASS missing)";
        }
      } else {
        emailStatus = NotificationDeliveryStatus.SKIPPED;
        emailError = "Recipient has no email address registered";
      }
    } else if (!allowEmail) {
      emailStatus = NotificationDeliveryStatus.SKIPPED;
      emailError = "User opted out of email notifications for this category";
    }

    // 6. Mobile Push Notification Attempt (FCM gateway via Firebase Admin SDK)
    let pushStatus: NotificationDeliveryStatus = previousDelivery?.pushStatus || NotificationDeliveryStatus.SKIPPED;
    let pushError: string | null = null;

    if (channels.includes("PUSH") && allowPush && pushStatus !== NotificationDeliveryStatus.ACCEPTED) {
      if (user.deviceTokens && user.deviceTokens.length > 0) {
        // Sanitize for lockscreen privacy (Requirement 7)
        const sanitized = sanitizeLockScreenMessage(title, message);
        const tokens = user.deviceTokens.map((t: any) => t.token);

        // Check if Firebase service account or project is configured
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.FIREBASE_PROJECT_ID) {
          try {
            const pushResult = await sendPushNotification(tokens, {
              title: sanitized.title,
              body: sanitized.message,
              data: {
                eventType,
                actionUrl: actionUrl || "",
                category,
              },
            });

            if (pushResult.success || pushResult.successCount > 0) {
              pushStatus = NotificationDeliveryStatus.ACCEPTED;
            } else {
              pushStatus = NotificationDeliveryStatus.FAILED;
              pushError = pushResult.error || `Push failed across all ${tokens.length} device tokens`;
            }
          } catch (fcmErr: any) {
            console.error("FCM_DISPATCH_EXCEPTION:", fcmErr.message);
            pushStatus = NotificationDeliveryStatus.FAILED;
            pushError = fcmErr.message;
          }
        } else {
          // Accurately report if Firebase credentials not configured in .env
          pushStatus = NotificationDeliveryStatus.SKIPPED;
          pushError = "Firebase Admin SDK not configured in .env (FIREBASE_SERVICE_ACCOUNT_PATH missing)";
        }
      } else {
        pushStatus = NotificationDeliveryStatus.SKIPPED;
        pushError = "No registered mobile device push tokens";
      }
    } else if (!allowPush) {
      pushStatus = NotificationDeliveryStatus.SKIPPED;
      pushError = "User opted out of push notifications for this category";
    }

    // 7. Update In-App notification record with delivery metrics
    if (inAppNotification) {
      await prisma.notification.update({
        where: { id: inAppNotification.id },
        data: {
          emailStatus,
          emailError,
          pushStatus,
          pushError,
        },
      });
    }

    if (announcementId) {
      const counts = await prisma.notification.groupBy({ by: ["emailStatus", "pushStatus"], where: { announcementId }, _count: { _all: true } });
      await prisma.announcement.updateMany({ where: { id: announcementId }, data: {
        emailSentCount: counts.reduce((n, row) => n + (row.emailStatus === "ACCEPTED" ? row._count._all : 0), 0),
        emailFailedCount: counts.reduce((n, row) => n + (row.emailStatus === "FAILED" ? row._count._all : 0), 0),
        pushSentCount: counts.reduce((n, row) => n + (row.pushStatus === "ACCEPTED" ? row._count._all : 0), 0),
      } });
    }

    // 8. Mark outbox event as processed
    await prisma.notificationEvent.update({
      where: { id: event.id },
      data: { processed: (emailStatus !== NotificationDeliveryStatus.FAILED && pushStatus !== NotificationDeliveryStatus.FAILED) || Number(event.metadata?.attempts || 0) >= 4, metadata: { ...(event.metadata || {}), attempts: Number(event.metadata?.attempts || 0) + 1 } },
    });

    return {
      success: true,
      notificationId: inAppNotification?.id,
      eventId: event.id,
      inApp: !!inAppNotification,
      emailStatus,
      pushStatus,
    };
  } catch (error: any) {
    console.error("DISPATCH_NOTIFICATION_ERROR:", error);
    // Return gracefully so business logic is not interrupted
    return { success: false, error: error.message };
  } finally {
    if (deliveryLease) await releaseJobLease(deliveryLease.key, deliveryLease.owner).catch(() => console.error("Notification lease cleanup deferred until expiry."));
  }
}

/**
 * Requirement 4 & 5: Fee & Expiry Reminder Scheduler
 * Checks active memberships expiring in 7d or 1d, installments currently due or overdue.
 * Idempotent with Karachi timezone, re-verifies live database status before sending.
 */
export async function runReminderScheduler(memberId?: string, options: { enqueueOnly?: boolean } = {}) {
  const results = {
    expiringProcessed: 0,
    installmentsProcessed: 0,
    skippedPaidOrObsolete: 0,
    errors: [] as string[],
  };

  try {
    const now = new Date();
    const settings = await prisma.gymSettings.findFirst();
    const localDay = (value: Date) => new Date(value.getTime() + 18000000).toISOString().slice(0, 10);
    const dayDifference = (date: Date) => Math.round((Date.parse(localDay(date)) - Date.parse(localDay(now))) / 86400000);

    // 1. Expiry Reminders: Scan active memberships
    const activeMemberships = await prisma.membership.findMany({
      where: {
        status: "ACTIVE",
        ...(memberId ? { gymMemberId: memberId } : {}),
      },
      include: {
        gymMember: {
          include: {
            user: true,
          },
        },
      },
    });

    for (const membership of activeMemberships) {
      const member = membership.gymMember;
      if (!member?.userId || !membership.endDate) continue;

      const expiry = new Date(membership.endDate);
      const diffMs = expiry.getTime() - now.getTime();
      const diffDays = dayDifference(expiry);
      const expiryDateStr = localDay(expiry);

      // Check 7 days and 1 day milestones
      if ((settings?.expiryReminderDays ?? [7, 1]).includes(diffDays)) {
        const dedupKey = `remind-exp-${diffDays}d-${member.id}-${expiryDateStr}`;

        // Live check: membership still active?
        const currentMembership = await prisma.membership.findUnique({
          where: { id: membership.id },
          select: { status: true },
        });

        if (currentMembership?.status !== "ACTIVE") {
          results.skippedPaidOrObsolete++;
          continue;
        }

        await (options.enqueueOnly ? deferNotification : dispatchNotification)({
          recipientUserId: member.userId,
          eventType: "MEMBERSHIP_EXPIRING",
          title: `Membership Expiring in ${diffDays} Day${diffDays > 1 ? "s" : ""}`,
          message: `Aapki OXGEN GYM membership ${diffDays === 1 ? "kal" : `${diffDays} din mein`} (${expiryDateStr}) expire hone wali hai. Nirantar workout ke liye renew karein.`,
          category: NotificationCategory.MEMBERSHIP,
          entityType: "MEMBERSHIP",
          entityId: member.id,
          actionUrl: "/dashboard",
          dedupKey,
        });

        results.expiringProcessed++;
      }
    }

    // 2. Installment Due / Overdue Reminders
    const dueInstallments = await prisma.invoiceInstallment.findMany({
      where: {
        status: { in: ["PENDING", "OVERDUE"] },
        ...(memberId ? { invoice: { gymMemberId: memberId } } : {}),
      },
      include: {
        invoice: {
          include: {
            gymMember: {
              include: { user: true },
            },
          },
        },
      },
    });

    for (const inst of dueInstallments) {
      const member = inst.invoice.gymMember;
      if (!member?.userId) continue;

      const dueDate = new Date(inst.dueDate);
      const dueDateStr = localDay(dueDate);
      const daysUntilDue = dayDifference(dueDate);
      const isOverdue = daysUntilDue < 0;
      if (daysUntilDue > 0 || (daysUntilDue === 0 && settings?.dueDateReminderEnabled === false) || (isOverdue && !(settings?.overdueReminderDays ?? [3]).includes(-daysUntilDue))) continue;

      // Live verification: Is installment or invoice still pending/unpaid?
      const liveInst = await prisma.invoiceInstallment.findUnique({
        where: { id: inst.id },
        select: { status: true, amount: true, paidAmount: true },
      });

      const liveInvoice = await prisma.invoice.findUnique({
        where: { id: inst.invoiceId },
        select: { status: true, balanceAmount: true },
      });

      if (
        !liveInst ||
        liveInst.status === "PAID" ||
        !liveInvoice ||
        liveInvoice.status === "PAID" ||
        liveInvoice.balanceAmount <= 0
      ) {
        results.skippedPaidOrObsolete++;
        continue;
      }

      const balanceDue = Math.min(liveInvoice.balanceAmount, Math.max(0, liveInst.amount - liveInst.paidAmount));
      if (balanceDue <= 0 || liveInvoice.status === "VOID") continue;
      const milestone = isOverdue ? `overdue-${-daysUntilDue}` : "due";
      const dedupKey = `remind-inst-${inst.id}-${milestone}-${dueDateStr}`;

      const title = isOverdue ? "Installment Payment Overdue" : "Fee Installment Due";
      const message = isOverdue
        ? `Aapki Rs. ${balanceDue.toLocaleString()} ki installment ${dueDateStr} ko overdue ho chuki hai. Kripya reception par jama karwayein.`
        : `Aapki Rs. ${balanceDue.toLocaleString()} ki installment aaj (${dueDateStr}) due hai. Receipt ke liye online transfer ya cash jamayein.`;

      await (options.enqueueOnly ? deferNotification : dispatchNotification)({
        recipientUserId: member.userId,
        eventType: "INSTALLMENT_DUE",
        title,
        message,
        category: NotificationCategory.PAYMENT,
        entityType: "INVOICE",
        entityId: inst.invoiceId,
        actionUrl: "/dashboard",
        dedupKey,
      });

      results.installmentsProcessed++;
    }

    return { success: true, results };
  } catch (err: any) {
    console.error("REMINDER_SCHEDULER_ERROR:", err);
    results.errors.push(err.message);
    return { success: false, results };
  }
}

/**
 * Requirement 20: Scheduled Announcement Broadcast Worker
 * Scans published announcements that have reached their publishAt timestamp
 * and dispatches inbox/email/push broadcast to the target audience.
 */
export async function runScheduledAnnouncementWorker(announcementIds?: string[]) {
  const results = {
    broadcastedAnnouncements: 0,
    totalRecipientsNotified: 0,
    errors: [] as string[],
  };

  try {
    const now = new Date();
    const pendingAnnouncements = await prisma.announcement.findMany({
      where: {
        ...(announcementIds ? { id: { in: announcementIds } } : {}),
        isPublished: true,
        publishAt: { lte: now },
        recipientCount: 0,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
    });

    for (const ann of pendingAnnouncements) {
      let targetUserIds: string[] = [];

      if (ann.audience === "ALL_MEMBERS") {
        const members = await prisma.gymMember.findMany({
          where: { userId: { not: null } },
          select: { userId: true },
        });
        targetUserIds = members.map((m) => m.userId!).filter(Boolean);
      } else if (ann.audience === "ACTIVE_MEMBERS") {
        const activeMemberships = await prisma.membership.findMany({
          where: { status: "ACTIVE" },
          include: { gymMember: { select: { userId: true } } },
        });
        targetUserIds = activeMemberships.map((m) => m.gymMember.userId!).filter(Boolean);
      } else if (ann.audience === "STAFF") {
        const staff = await prisma.user.findMany({
          where: { role: { in: [Role.OWNER, Role.RECEPTIONIST, Role.TRAINER] } },
          select: { id: true },
        });
        targetUserIds = staff.map((s) => s.id);
      } else if (ann.audience === "SELECTED_MEMBERS") {
        targetUserIds = ann.targetMemberIds;
      }

      let emailSentCount = 0;
      let pushSentCount = 0;

      for (const userId of targetUserIds) {
        const res = await dispatchNotification({
          recipientUserId: userId,
          eventType: "ANNOUNCEMENT_PUBLISHED",
          title: ann.title,
          message: ann.content,
          category: NotificationCategory.ANNOUNCEMENT,
          entityType: "ANNOUNCEMENT",
          entityId: ann.id,
          actionUrl: "/dashboard",
          channels: (ann.channels as Array<"IN_APP" | "EMAIL" | "PUSH">) || ["IN_APP"],
          announcementId: ann.id,
          dedupKey: `announcement-${ann.id}-${userId}`,
        });

        if (res.emailStatus === "ACCEPTED") emailSentCount++;
        if (res.pushStatus === "ACCEPTED") pushSentCount++;
      }

      await prisma.announcement.update({
        where: { id: ann.id },
        data: {
          recipientCount: targetUserIds.length,
          emailSentCount,
          pushSentCount,
        },
      });

      results.broadcastedAnnouncements++;
      results.totalRecipientsNotified += targetUserIds.length;
    }

    return { success: true, results };
  } catch (err: any) {
    console.error("SCHEDULED_ANNOUNCEMENT_WORKER_ERROR:", err);
    results.errors.push(err.message);
    return { success: false, results };
  }
}

/**
 * Requirement 20: Notification Outbox Processor
 * Processes unprocessed events and retries bounded failed notification channels.
 */
export async function processNotificationOutbox(limit = 50, eventIds?: string[]) {
  const results = {
    processedCount: 0,
    errors: [] as string[],
  };

  try {
    const pendingEvents = await prisma.notificationEvent.findMany({
      where: { processed: false, ...(eventIds ? { id: { in: eventIds } } : {}) },
      take: limit,
      orderBy: { createdAt: "asc" },
    });

    for (const evt of pendingEvents) {
      const delivery = await dispatchNotification({
        recipientUserId: evt.recipientUserId,
        eventType: evt.eventType,
        title: evt.title,
        message: evt.message,
        category: evt.category,
        entityType: evt.entityType || undefined,
        entityId: evt.entityId || undefined,
        actionUrl: evt.actionUrl || undefined,
        dedupKey: evt.dedupKey || undefined,
        metadata: evt.metadata,
        channels: (evt.metadata as any)?.channels,
        existingEventId: evt.id,
        announcementId: (evt.metadata as any)?.announcementId,
      } as any);

      if (!delivery.success) {
        const attempts = Number((evt.metadata as any)?.attempts || 0) + 1;
        await prisma.notificationEvent.update({ where: { id: evt.id }, data: { processed: attempts >= 5, metadata: { ...(evt.metadata as object || {}), attempts } } });
        results.errors.push(`Delivery failed for event ${evt.id}; attempt ${attempts}.`);
      }

      results.processedCount++;
    }

    return { success: true, results };
  } catch (err: any) {
    console.error("OUTBOX_PROCESSOR_ERROR:", err);
    results.errors.push(err.message);
    return { success: false, results };
  }
}
