export type RegistrationInput = {
  fullName: string; email: string; phone: string; password: string;
  dateOfBirth: string; address: string; emergencyContactName: string;
  emergencyContactPhone: string; fitnessGoal: string; limitations: string;
  joiningDate: string;
};
function phoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("92") && digits.length === 12 ? "0" + digits.slice(2) : digits;
}
export function validateRegistration(value: unknown): { success: true; data: RegistrationInput } | { success: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { success: false, error: "Please complete the form." };
  const body = value as Record<string, unknown>;
  const limits: Record<string, number> = { fullName: 100, email: 254, phone: 25, dateOfBirth: 10, joiningDate: 10, address: 500, emergencyContactName: 100, emergencyContactPhone: 25, fitnessGoal: 500, limitations: 1000 };
  const fields: Record<string, string> = {};
  for (const [key, limit] of Object.entries(limits)) {
    if (body[key] !== undefined && typeof body[key] !== "string") return { success: false, error: "Invalid form details." };
    fields[key] = String(body[key] || "").trim();
    if (fields[key].length > limit) return { success: false, error: "Please shorten " + key + "." };
  }
  fields.email = fields.email.toLowerCase(); fields.phone = phoneNumber(fields.phone); fields.emergencyContactPhone = phoneNumber(fields.emergencyContactPhone);
  if (fields.fullName.length < 2) return { success: false, error: "Enter your full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return { success: false, error: "Enter a valid email address." };
  if (!/^03\d{9}$/.test(fields.phone)) return { success: false, error: "Enter a valid mobile number, e.g. 03001234567." };
  if (fields.emergencyContactPhone && !/^03\d{9}$/.test(fields.emergencyContactPhone)) return { success: false, error: "Enter a valid emergency contact mobile." };
  if (Boolean(fields.emergencyContactName) !== Boolean(fields.emergencyContactPhone)) return { success: false, error: "Enter both emergency contact name and mobile." };
  if (fields.dateOfBirth) {
    const date = new Date(fields.dateOfBirth + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.dateOfBirth) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== fields.dateOfBirth || date > new Date() || date.getUTCFullYear() < 1900) return { success: false, error: "Enter a valid date of birth." };
  }
  if (fields.joiningDate) {
    const date = new Date(fields.joiningDate + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.joiningDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== fields.joiningDate || date.getUTCFullYear() < 1900) return { success: false, error: "Enter a valid joining date." };
  }
  if (typeof body.password !== "string" || body.password.length < 8 || new TextEncoder().encode(body.password).length > 72) return { success: false, error: "Use a password of at least 8 characters (up to 72 bytes)." };
  if (body.confirmPassword !== body.password) return { success: false, error: "Passwords do not match." };
  return { success: true, data: { ...fields, password: body.password } as RegistrationInput };
}
