import { prisma } from "./db";
import { Role } from "@prisma/client";

// List of sensitive keys that must NEVER be written to audit logs or stored in details
const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "plainpassword",
  "newpassword",
  "currentpassword",
  "token",
  "sessiontoken",
  "activationcode",
  "smtppassword",
  "secret",
  "sessionsecret",
  "pin",
  "otp",
]);

export interface FieldChange {
  field: string;
  before: any;
  after: any;
}

export interface RecordAuditParams {
  actor?: {
    id: string;
    name: string;
    role: Role | string;
  } | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, any> | string | null;
  reason?: string | null;
  changes?: FieldChange[] | null;
  relatedEntityId?: string | null;
  ipAddress?: string | null;
}

/**
 * Sanitizes an object recursively by stripping any sensitive keys
 */
export function sanitizeAuditData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeAuditData);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof val === "object" && val !== null) {
      sanitized[key] = sanitizeAuditData(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

/**
 * Concurrency-safe, sanitized audit log creation
 */
export async function createAuditLog(params: RecordAuditParams) {
  try {
    const actorId = params.actor?.id || null;
    const actorName = params.actor?.name || "System";
    const actorRole = params.actor?.role ? String(params.actor.role) : "SYSTEM";

    let detailsString: string | null = null;
    if (params.details) {
      const sanitizedDetails = typeof params.details === "object"
        ? sanitizeAuditData(params.details)
        : params.details;
      detailsString = typeof sanitizedDetails === "string"
        ? sanitizedDetails
        : JSON.stringify(sanitizedDetails);
    }

    const sanitizedChanges = params.changes
      ? params.changes.map((c) => ({
          field: c.field,
          before: SENSITIVE_KEYS.has(c.field.toLowerCase()) ? "[REDACTED]" : c.before,
          after: SENSITIVE_KEYS.has(c.field.toLowerCase()) ? "[REDACTED]" : c.after,
        }))
      : null;

    return await prisma.auditLog.create({
      data: {
        actorId,
        actorName,
        actorRole,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        details: detailsString,
        reason: params.reason ? params.reason.trim() : null,
        changes: sanitizedChanges as any,
        relatedEntityId: params.relatedEntityId || null,
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (err) {
    console.error("Failed to create audit log:", err);
    return null;
  }
}
