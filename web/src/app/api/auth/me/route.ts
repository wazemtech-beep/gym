import { withReadCache } from "@/lib/serverReadCache";
import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasRolePermission, PermissionAction, hasUserPermission } from "@/lib/permissions";

const ALL_ACTIONS: PermissionAction[] = [
  "STAFF_CREATE_ROLE_CHANGE",
  "MEMBER_REGISTER_UPDATE",
  "MEMBERSHIP_ASSIGN_RENEW",
  "PAYMENT_RECORD_VERIFY",
  "PAYMENT_REVERSAL_REFUND",
  "FINANCIAL_REPORTS",
  "WORKOUT_DIET_ASSIGN",
  "PROGRESS_ACTIVITY_VIEW",
  "GYM_SETTINGS",
  "EXPENSES_MANAGE",
  "ATTENDANCE_MANAGE",
];

async function getHandler() {
  const current = await getCurrentSession();

  if (!current) {
    return NextResponse.json(
      { success: false, error: "Ghair tasdeeq shuda session." },
      { status: 401 }
    );
  }

  // Calculate permissions for current role
  const permissions: Record<string, boolean> = {};
  for (const action of ALL_ACTIONS) {
    permissions[action] = hasUserPermission(current.user, action);
  }

  return NextResponse.json({
    success: true,
    user: current.user,
    permissions,
  });
}

export const GET = withReadCache(getHandler);
