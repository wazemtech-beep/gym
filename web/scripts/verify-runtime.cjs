require("dotenv").config({ quiet: true });
const { PrismaClient, Prisma } = require("@prisma/client");

async function schemaAudit() {
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("connection_limit", "1");
  const db = new PrismaClient({ datasourceUrl: url.toString(), log: [] });
  try {
    const columns = await db.$queryRaw`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema = current_schema()`;
    const tables = new Map();
    for (const row of columns) {
      if (!tables.has(row.table_name)) tables.set(row.table_name, new Set());
      tables.get(row.table_name).add(row.column_name);
    }
    if (process.argv.includes("--repair-registration") && tables.has("MemberRegistrationRequest")) {
      await db.$transaction([
        db.$executeRaw`ALTER TABLE "MemberRegistrationRequest" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT`,
        db.$executeRaw`ALTER TABLE "MemberRegistrationRequest" ADD COLUMN IF NOT EXISTS "joiningDate" TIMESTAMP(3)`,
      ]);
      tables.get("MemberRegistrationRequest").add("photoUrl");
      tables.get("MemberRegistrationRequest").add("joiningDate");
      console.log(JSON.stringify({ check: "registration-schema-repair", status: "applied", dataDeleted: false }));
    }
    const missing = [];
    for (const model of Prisma.dmmf.datamodel.models) {
      const table = model.dbName || model.name;
      if (!tables.has(table)) { missing.push(table); continue; }
      for (const field of model.fields.filter(field => field.kind !== "object")) {
        if (!tables.get(table).has(field.dbName || field.name)) missing.push(table + "." + (field.dbName || field.name));
      }
    }
    console.log(JSON.stringify({ check: "database-schema", models: Prisma.dmmf.datamodel.models.length, missing }));
    if (missing.length) process.exitCode = 2;
    const counts = {};
    for (const model of ["user", "gymMember", "membership", "invoice", "payment"]) counts[model] = await db[model].count();
    console.log(JSON.stringify({ check: "database-reads", counts }));
  } catch (error) { console.log(JSON.stringify({ check: "database", error: error.code || error.name })); process.exitCode = 1; }
  finally { await db.$disconnect(); }
}

async function smtpAudit() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) { console.log(JSON.stringify({ check: "smtp", status: "not-configured" })); return; }
  require("tsx/cjs");
  const { createSmtpTransport } = require("../src/lib/smtpTransport.ts");
  const transport = await createSmtpTransport();
  let deadline;
  try { await Promise.race([transport.verify(), new Promise((_, reject) => { deadline = setTimeout(() => { const error = new Error("SMTP_TIMEOUT"); error.code = "ETIMEDOUT"; reject(error); }, 30000); })]); console.log(JSON.stringify({ check: "smtp-authentication", status: "passed", emailsSent: 0 })); }
  catch (error) { console.log(JSON.stringify({ check: "smtp-authentication", status: "failed", code: error.code, responseCode: error.responseCode })); process.exitCode = 1; }
  finally { clearTimeout(deadline); transport.close(); }
}

(async () => { if (!process.argv.includes("--smtp-only")) await schemaAudit(); if (process.argv.includes("--smtp") || process.argv.includes("--smtp-only")) await smtpAudit(); })().then(() => process.exit(process.exitCode || 0)).catch(error => { console.log(JSON.stringify({ check: "verification", error: error.name })); process.exit(1); });
