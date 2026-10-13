import { prisma } from "./db";
import bcrypt from "bcryptjs";
import { Role, AccountStatus, type User } from "@prisma/client";
import { getGymAuth } from "@/lib/gymAuth";
import { validateLoginInput, type LoginPortal } from "@/lib/authValidation";

export const SESSION_COOKIE_NAME = "oxgen_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface AuthSessionData {
  sessionToken: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    memberId: string | null;
    role: Role;
    status: AccountStatus;
    mustChangePassword: boolean;
  };
}

/**
 * Normal Login Verification Flow:
 * 1. Identifier: Email ya Member ID (e.g. OXG-000001)
 * 2. Password match check
 * 3. Account active / suspended check
 * 4. Lockout check on repeated failed attempts
 * 5. Session token creation & audit logging
 */
type AuthFailure = { success: false; error: string; code: "INVALID_INPUT" | "INVALID_CREDENTIALS" | "WRONG_PORTAL" | "ACCOUNT_INACTIVE" | "LOCKED" | "ACCOUNT_CHANGED"; locked?: boolean; retryAfterSeconds?: number };

function lockedLogin(until: Date): AuthFailure {
  const retryAfterSeconds = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000));
  return { success: false, code: "LOCKED", error: "Zyada ghalat attempts ki wajah se account temporary lock hai. " + Math.ceil(retryAfterSeconds / 60) + " minute baad koshish karein.", locked: true, retryAfterSeconds };
}

export async function authenticateUser(
  identifier: string,
  plainPassword: string,
  meta?: { ipAddress?: string; userAgent?: string; portal?: LoginPortal }
): Promise<{ success: true; sessionData: AuthSessionData } | AuthFailure> {
  const validation = validateLoginInput({ identifier, password: plainPassword, portal: meta?.portal });
  if (!validation.success) return { success: false, code: "INVALID_INPUT", error: validation.error };
  const input = validation.data;
  const target = await prisma.user.findFirst({ where: { OR: [
    { email: { equals: input.identifier, mode: "insensitive" } },
    { memberId: { equals: input.identifier, mode: "insensitive" } },
  ] }, select: { id: true } });
  if (!target) return { success: false, code: "INVALID_CREDENTIALS", error: "Login details incorrect hain." };
  const context = await getGymAuth().$context;

  // Serialize attempts per account so simultaneous failures cannot lose increments.
  const verified = await prisma.$transaction<AuthFailure | { success: true; user: User }>(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${target.id} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: target.id } });
    if (!user) return { success: false, code: "INVALID_CREDENTIALS", error: "Login details incorrect hain." };
    if (user.email?.toLowerCase() !== input.identifier.toLowerCase() && user.memberId?.toLowerCase() !== input.identifier.toLowerCase()) return { success: false, code: "ACCOUNT_CHANGED", error: "Login identifier badal gaya. Dobara sign in karein." };
    if (input.portal === "member" && user.role !== Role.MEMBER) return { success: false, code: "WRONG_PORTAL", error: "Staff accounts ke liye staff sign in use karein." };
    if (input.portal === "admin" && user.role === Role.MEMBER) return { success: false, code: "WRONG_PORTAL", error: "Member accounts ke liye member sign in use karein." };
    const now = new Date();
    if (user.lockoutUntil && user.lockoutUntil > now) return lockedLogin(user.lockoutUntil);
    if (user.status !== AccountStatus.ACTIVE) return {
      success: false, code: "ACCOUNT_INACTIVE",
      error: user.status === AccountStatus.SUSPENDED ? "Aapka login suspend hai. Gym reception se rabta karein." : "Account activation pending hai. Activation link/code ke liye gym reception se rabta karein.",
    };
    if (!user.passwordHash) return { success: false, code: "ACCOUNT_INACTIVE", error: "Account ka password abhi set nahi hua. Gym reception se rabta karein." };
    const valid = await context.password.verify({ password: input.password, hash: user.passwordHash });
    if (!valid) {
      const attempts = (user.lockoutUntil && user.lockoutUntil <= now ? 0 : user.failedLoginAttempts) + 1;
      const lockoutUntil = attempts >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCKOUT_MINUTES * 60000) : null;
      await tx.user.update({ where: { id: user.id }, data: { failedLoginAttempts: attempts, lockoutUntil } });
      await tx.auditLog.create({ data: { actorId: user.id, actorName: user.name, actorRole: user.role, action: "LOGIN_FAILED", entityType: "USER", entityId: user.id, details: JSON.stringify({ attempt: attempts, locked: !!lockoutUntil, portal: input.portal || "api" }), ipAddress: meta?.ipAddress } });
      return lockoutUntil ? lockedLogin(lockoutUntil) : { success: false, code: "INVALID_CREDENTIALS", error: "Login details incorrect hain." };
    }
    return { success: true, user };
  }, { maxWait: 10000, timeout: 15000 });
  if (!verified.success) return verified;

  // The library creates its session outside the account lock; recheck before exposing it.
  const created = await context.internalAdapter.createSession(verified.user.id, false, { ipAddress: meta?.ipAddress || "", userAgent: meta?.userAgent || "" });
  if (!created) throw new Error("Session creation failed.");
  try {
    const finalized = await prisma.$transaction<AuthFailure | { success: true; user: User }>(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${verified.user.id} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: verified.user.id } });
      const session = await tx.session.findUnique({ where: { token: created.token }, select: { userId: true, expiresAt: true } });
      if (!user || user.status !== AccountStatus.ACTIVE || user.passwordHash !== verified.user.passwordHash || user.email !== verified.user.email || user.memberId !== verified.user.memberId || user.role !== verified.user.role || !session || session.userId !== user.id || session.expiresAt <= new Date()) return { success: false, code: "ACCOUNT_CHANGED", error: "Account details badal gayi hain. Dobara sign in karein." };
      if (user.lockoutUntil && user.lockoutUntil > new Date()) return lockedLogin(user.lockoutUntil);
      await tx.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockoutUntil: null } });
      await tx.auditLog.create({ data: { actorId: user.id, actorName: user.name, actorRole: user.role, action: "LOGIN_SUCCESS", entityType: "SESSION", entityId: created.id, details: JSON.stringify({ role: user.role, portal: input.portal || "api" }), ipAddress: meta?.ipAddress } });
      return { success: true, user };
    });
    if (!finalized.success) { await destroySession(created.token); return finalized; }
    const user = finalized.user;
    return { success: true, sessionData: { sessionToken: created.token, user: { id: user.id, name: user.name, email: user.email, memberId: user.memberId, role: user.role, status: user.status, mustChangePassword: user.mustChangePassword } } };
  } catch (error) { await destroySession(created.token); throw error; }
}

/**
 * Validate current active session token
 */
export async function validateSession(token: string) {
  if (!token || token.length < 20 || token.length > 256 || !/^[a-zA-Z0-9_-]+$/.test(token)) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          memberId: true,
          role: true,
          status: true,
          mustChangePassword: true,
          avatarUrl: true,
          permissionGrants: true,
        },
      },
    },
  });

  if (!session) return null;

  // Check expiry
  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Check if user is suspended
  if (session.user.status !== AccountStatus.ACTIVE) {
    return null;
  }

  // Better Auth's Prisma adapter uses this same Session row. Its second
  // findSession call only reread the already-validated session/user; expiry,
  // revocation, activation and current permission checks above remain live.

  return {
    session,
    user: session.user,
  };
}

/**
 * Checks if a session has had recent password re-authentication (within 15 minutes)
 */
export function isSessionReauthenticated(session: { reauthenticatedAt?: Date | null }): boolean {
  if (!session?.reauthenticatedAt) return false;
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  return session.reauthenticatedAt > fifteenMinutesAgo;
}

/**
 * Verifies user password for sensitive settings change and stamps reauthenticatedAt on active session
 */
export async function verifyPasswordReauth(
  userId: string,
  plainPassword: string,
  sessionToken: string
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) {
    return { success: false, error: "User nahi mila." };
  }

  const isValid = await bcrypt.compare(plainPassword, user.passwordHash);
  if (!isValid) {
    return { success: false, error: "Password durust nahi hai." };
  }

  await prisma.session.update({
    where: { token: sessionToken },
    data: { reauthenticatedAt: new Date() },
  });

  return { success: true };
}

/**
 * Single Session Logout
 */
export async function destroySession(token: string) {
  try {
    await prisma.session.delete({
      where: { token },
    });
  } catch {
    // Session already deleted or doesn't exist
  }
}

/**
 * "Logout All Devices" / Revoke all sessions for a user
 */
export async function revokeAllUserSessions(userId: string) {
  await prisma.session.deleteMany({
    where: { userId },
  });
}

/**
 * First Login Initial Password Change OR Regular Password Reset
 */
export async function changeUserPassword(
  userId: string,
  newPassword: string,
  currentPassword?: string,
  skipCurrentCheck = false
): Promise<{ success: boolean; error?: string }> {
  if (newPassword.length < 8) {
    return {
      success: false,
      error: "Naya password kam az kam 8 characters ka hona chahiye.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return { success: false, error: "User nahi mila." };
  }

  // If not first login, verify current password
  if (!skipCurrentCheck && !user.mustChangePassword) {
    if (!currentPassword || !user.passwordHash) {
      return { success: false, error: "Maujooda password faraham karein." };
    }
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      return { success: false, error: "Maujooda password durust nahi hai." };
    }
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(newPassword, salt);

  // Update password and clear mustChangePassword flag
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });

  // Revoke all older sessions on password change as per requirement.txt
  await revokeAllUserSessions(userId);

  // Audit log
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "PASSWORD_CHANGED",
      entityType: "USER",
      entityId: user.id,
      details: JSON.stringify({
        wasFirstLogin: user.mustChangePassword,
        allOldSessionsRevoked: true,
      }),
    },
  });

  return { success: true };
}
