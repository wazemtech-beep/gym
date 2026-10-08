export type LoginPortal = "member" | "admin";

export const LOGIN_IDENTIFIER_MAX_LENGTH = 254;
export const LOGIN_PASSWORD_MAX_LENGTH = 128;

type LoginInput = { identifier: string; password: string; portal?: LoginPortal };
type ValidationResult = { success: true; data: LoginInput } | { success: false; error: string };

/** Passwords are never trimmed or changed; identifiers are case insensitive. */
export function validateLoginInput(value: unknown): ValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { success: false, error: "Email ya Member ID aur password enter karein." };
  const input = value as Record<string, unknown>;
  if (typeof input.identifier !== "string" || typeof input.password !== "string") return { success: false, error: "Email ya Member ID aur password enter karein." };
  const identifier = input.identifier.trim();
  if (!identifier || !input.password) return { success: false, error: "Email ya Member ID aur password enter karein." };
  if (identifier.length > LOGIN_IDENTIFIER_MAX_LENGTH || input.password.length > LOGIN_PASSWORD_MAX_LENGTH) return { success: false, error: "Login details bohat lambi hain." };
  const isMemberId = /^OXG-\d{6,18}$/i.test(identifier);
  const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identifier);
  if (!isMemberId && !isEmail) return { success: false, error: "Durust email ya Member ID enter karein, jaise OXG-000125." };
  if (input.portal !== undefined && input.portal !== "member" && input.portal !== "admin") return { success: false, error: "Invalid login portal." };
  return { success: true, data: { identifier: isMemberId ? identifier.toUpperCase() : identifier.toLowerCase(), password: input.password, portal: input.portal as LoginPortal | undefined } };
}
