import { createSmtpTransport } from "./smtpTransport";

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
export function passwordResetEmail(name: string, url: string) {
  const safeUrl = escape(url);
  return {
    subject: "Reset your OXGEN GYM password",
    text: `Hi ${name},\n\nReset your password: ${url}\n\nThis link expires in one hour and can only be used once. If you did not request this, ignore this email.`,
    html: `<!doctype html><html><body style="margin:0;background:#f5f5f0;font-family:Arial,sans-serif;color:#233025"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #e3e8de;border-radius:16px" cellpadding="0" cellspacing="0"><tr><td style="padding:28px 32px;background:#2d573e;color:#fff;font-weight:bold;font-size:20px">OXGEN GYM</td></tr><tr><td style="padding:32px"><h1 style="font-size:24px;margin:0 0 20px">Reset your password</h1><p>Hi ${escape(name)},</p><p style="line-height:1.6">Use the button below to choose a new password. This link expires in one hour and can only be used once.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#2d573e;color:#fff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:bold">Reset password</a></p><p style="font-size:13px;line-height:1.6;color:#677368">If the button does not work, open this link:<br><a href="${safeUrl}" style="color:#2d573e;word-break:break-all">${safeUrl}</a></p><p style="font-size:13px;color:#677368">Did not request this? You can safely ignore this email.</p></td></tr></table></td></tr></table></body></html>`,
  };
}
export function accountEmailConfigured() { return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS); }
export async function sendPasswordResetEmail(email: string, name: string, url: string) {
  if (!accountEmailConfigured()) throw new Error("SMTP_NOT_CONFIGURED");
  const transport = await createSmtpTransport();
  if (!transport) throw new Error("SMTP_NOT_CONFIGURED");
  try {
    const result = await transport.sendMail({ from: process.env.SMTP_FROM || `"OXGEN GYM" <${process.env.SMTP_USER}>`, to: email, ...passwordResetEmail(name, url) });
    if (!result.accepted?.length) throw new Error("SMTP_RECIPIENT_REJECTED");
  } finally { transport.close(); }
}
