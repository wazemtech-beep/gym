import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import nodemailer from "nodemailer";

export async function createSmtpTransport() {
  const user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  // Use the operating system resolver; direct DNS resolution can hang on networks
  // where TCP/TLS SMTP works. Keep hostname verification against the original host.
  const address = isIP(host) ? host : (await lookup(host)).address;
  return nodemailer.createTransport({ host: address, port, secure: port === 465, tls: { servername: host }, auth: { user, pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 });
}
