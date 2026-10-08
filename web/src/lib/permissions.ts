import { Role } from "@prisma/client";

export type PermissionAction =
  | "STAFF_CREATE_ROLE_CHANGE"
  | "MEMBER_REGISTER_UPDATE"
  | "MEMBERSHIP_ASSIGN_RENEW"
  | "PAYMENT_RECORD_VERIFY"
  | "PAYMENT_REVERSAL_REFUND"
  | "FINANCIAL_REPORTS"
  | "WORKOUT_DIET_ASSIGN"
  | "PROGRESS_ACTIVITY_VIEW"
  | "GYM_SETTINGS"
  | "EXPENSES_MANAGE"
  | "ATTENDANCE_MANAGE";

/**
 * Requirement.txt ke mutabiq role-based permission matrix:
 * Action                       Owner   Receptionist   Trainer            Member
 * Staff create/role change     ✅      —              —                  —
 * Member register/update       ✅      ✅             —                  Apne allowed fields
 * Membership assign/renew      ✅      ✅             —                  Renewal request
 * Payment record/verify        ✅      ✅             —                  Apna proof submit
 * Payment reversal/refund      ✅      —              —                  —
 * Gym financial reports        ✅      —              —                  —
 * Workout/diet assign          ✅      —              Assigned members   —
 * Progress/activity view       Consent —              Assigned+Shared    Apna data
 * Gym settings                 ✅      —              —                  —
 * Expenses manage              ✅      (Configurable) —                  —
 * Attendance manage            ✅      ✅             —                  —
 */

export function hasRolePermission(role: Role, action: PermissionAction): boolean {
  switch (action) {
    case "STAFF_CREATE_ROLE_CHANGE":
    case "PAYMENT_REVERSAL_REFUND":
    case "FINANCIAL_REPORTS":
    case "GYM_SETTINGS":
    case "EXPENSES_MANAGE":
      return role === Role.OWNER;

    case "MEMBER_REGISTER_UPDATE":
    case "MEMBERSHIP_ASSIGN_RENEW":
    case "PAYMENT_RECORD_VERIFY":
    case "ATTENDANCE_MANAGE":
      return role === Role.OWNER || role === Role.RECEPTIONIST;

    case "WORKOUT_DIET_ASSIGN":
      return role === Role.OWNER || role === Role.TRAINER;

    case "PROGRESS_ACTIVITY_VIEW":
      // Member, Trainer and Owner subject to consent / assignment check
      return true;

    default:
      return false;
  }
}

/**
 * Checks whether user has permission, accounting for per-staff permissionGrants overrides
 */
export function hasUserPermission(
  user: { role: Role; permissionGrants?: any },
  action: PermissionAction
): boolean {
  if (user.role === Role.OWNER) return true;
  if (user.permissionGrants && typeof user.permissionGrants === "object") {
    const grants = user.permissionGrants as Record<string, boolean>;
    if (grants[action] !== undefined) {
      return Boolean(grants[action]);
    }
  }
  return hasRolePermission(user.role, action);
}

/**
 * 3-Level Security Enforcement:
 * 1. Valid Session?
 * 2. Action Allowed for Role?
 * 3. Specific Record Access Allowed?
 */
export function verifyRecordAccess(
  currentUser: { id: string; role: Role },
  action: PermissionAction,
  context?: {
    targetMemberId?: string;
    targetUserId?: string;
    assignedTrainerId?: string;
    hasSharedConsent?: boolean;
  }
): boolean {
  // Check action allowed for role
  if (!hasRolePermission(currentUser.role, action)) {
    return false;
  }

  // Owner has gym-wide operational access, except private health data requires consent
  if (currentUser.role === Role.OWNER) {
    if (action === "PROGRESS_ACTIVITY_VIEW" && context?.hasSharedConsent === false) {
      return false;
    }
    return true;
  }

  // Receptionist has member and payment access, but not trainer/health details
  if (currentUser.role === Role.RECEPTIONIST) {
    if (action === "PROGRESS_ACTIVITY_VIEW" || action === "WORKOUT_DIET_ASSIGN") {
      return false;
    }
    return true;
  }

  // Trainer can only access their assigned members
  if (currentUser.role === Role.TRAINER) {
    if (action === "WORKOUT_DIET_ASSIGN") {
      return context?.assignedTrainerId === currentUser.id;
    }
    if (action === "PROGRESS_ACTIVITY_VIEW") {
      return (
        context?.assignedTrainerId === currentUser.id &&
        context?.hasSharedConsent === true
      );
    }
    return false;
  }

  // Member can only view/edit their own data
  if (currentUser.role === Role.MEMBER) {
    if (context?.targetUserId) {
      return context.targetUserId === currentUser.id;
    }
    return true;
  }

  return false;
}
