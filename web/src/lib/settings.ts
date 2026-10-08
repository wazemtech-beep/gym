import { prisma } from "./db";
import { createAuditLog } from "./audit";
import { PaymentMethod } from "@prisma/client";

export interface UpdateSettingsInput {
  expectedVersion?: number;
  gymName?: string;
  tagline?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  logoUrl?: string;
  receiptPrefix?: string;
  invoiceDueDays?: number;
  maxFreezeDays?: number;
  expiryReminderDays?: number[];
  overdueReminderDays?: number[];
  dueDateReminderEnabled?: boolean;
  receiptFooter?: string;
  receiptPrintFormat?: string; // A4 | THERMAL_80MM
  emailReceiptsAutomatically?: boolean;
  attendanceEnabled?: boolean;
  notificationPrefs?: any;
}

/**
 * Loads or initializes the singleton gym settings
 */
export async function getGymSettings() {
  let settings = await prisma.gymSettings.findFirst();
  if (!settings) {
    settings = await prisma.gymSettings.create({
      data: {
        id: "default",
        gymName: "OXGEN GYM",
        tagline: "Strength & Performance",
        contactPhone: "+92 300 1234567",
        contactEmail: "info@oxgengym.com",
        address: "Main Boulevard, Gulberg III, Lahore, Pakistan",
        receiptPrefix: "OXG-RCP",
        currency: "PKR",
        timezone: "Asia/Karachi",
        isInitialSetupDone: true,
        attendanceEnabled: false,
        invoiceDueDays: 7,
        maxFreezeDays: 30,
        expiryReminderDays: [7, 1],
        overdueReminderDays: [3],
        dueDateReminderEnabled: true,
        receiptFooter: "Thank you for choosing OXGEN GYM",
        receiptPrintFormat: "A4",
        emailReceiptsAutomatically: false,
        version: 1,
      },
    });
  }
  return settings;
}

/**
 * Optimistic concurrency-controlled settings update with audit logging
 */
export async function updateGymSettings(
  input: UpdateSettingsInput,
  actor: { id: string; name: string; role: any },
  ipAddress?: string
) {
  const current = await getGymSettings();

  // Optimistic concurrency check
  if (
    typeof input.expectedVersion === "number" &&
    input.expectedVersion !== current.version
  ) {
    return {
      success: false,
      conflict: true,
      error: "Settings doosre user ne update kar di hain. Barah-e-karam page refresh karke latest version check karein.",
      currentSettings: current,
    };
  }

  // Currency and timezone are locked in active system
  const updates: Record<string, any> = {
    updatedById: actor.id,
    version: current.version + 1,
  };

  const changes: Array<{ field: string; before: any; after: any }> = [];

  const checkAndSet = (field: keyof UpdateSettingsInput, keyInDb: keyof typeof current) => {
    if (input[field] !== undefined && input[field] !== (current as any)[keyInDb]) {
      changes.push({
        field: String(keyInDb),
        before: (current as any)[keyInDb],
        after: input[field],
      });
      updates[keyInDb] = input[field];
    }
  };

  if (input.gymName !== undefined) checkAndSet("gymName", "gymName");
  if (input.tagline !== undefined) checkAndSet("tagline", "tagline");
  if (input.contactPhone !== undefined) checkAndSet("contactPhone", "contactPhone");
  if (input.contactEmail !== undefined) checkAndSet("contactEmail", "contactEmail");
  if (input.address !== undefined) checkAndSet("address", "address");
  if (input.logoUrl !== undefined) checkAndSet("logoUrl", "logoUrl");
  if (input.receiptPrefix !== undefined) checkAndSet("receiptPrefix", "receiptPrefix");
  if (input.invoiceDueDays !== undefined) checkAndSet("invoiceDueDays", "invoiceDueDays");
  if (input.maxFreezeDays !== undefined) checkAndSet("maxFreezeDays", "maxFreezeDays");
  if (input.expiryReminderDays !== undefined) checkAndSet("expiryReminderDays", "expiryReminderDays");
  if (input.overdueReminderDays !== undefined) checkAndSet("overdueReminderDays", "overdueReminderDays");
  if (input.dueDateReminderEnabled !== undefined) checkAndSet("dueDateReminderEnabled", "dueDateReminderEnabled");
  if (input.receiptFooter !== undefined) checkAndSet("receiptFooter", "receiptFooter");
  if (input.receiptPrintFormat !== undefined) checkAndSet("receiptPrintFormat", "receiptPrintFormat");
  if (input.emailReceiptsAutomatically !== undefined) checkAndSet("emailReceiptsAutomatically", "emailReceiptsAutomatically");
  if (input.attendanceEnabled !== undefined) checkAndSet("attendanceEnabled", "attendanceEnabled");
  if (input.notificationPrefs !== undefined) {
    changes.push({
      field: "notificationPrefs",
      before: current.notificationPrefs,
      after: input.notificationPrefs,
    });
    updates.notificationPrefs = input.notificationPrefs;
  }

  if (changes.length === 0) {
    return {
      success: true,
      settings: current,
      noChanges: true,
    };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.gymSettings.update({
      where: { id: current.id, version: current.version },
      data: updates,
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.name,
        actorRole: String(actor.role),
        action: "GYM_SETTINGS_UPDATED",
        entityType: "SETTINGS",
        entityId: s.id,
        changes: changes as any,
        details: JSON.stringify({
          versionBefore: current.version,
          versionAfter: s.version,
          fieldsChanged: changes.map((c) => c.field),
        }),
        ipAddress: ipAddress || null,
      },
    });

    return s;
  }, { maxWait: 10000, timeout: 25000 }).catch(error => {
    if (error?.code === "P2025") return null;
    throw error;
  });

  if (!updated) return { success: false, conflict: true, error: "Settings changed while saving. Refresh and try again.", currentSettings: await getGymSettings() };

  return {
    success: true,
    settings: updated,
    changes,
  };
}
