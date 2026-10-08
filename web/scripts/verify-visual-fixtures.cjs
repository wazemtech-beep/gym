require("dotenv").config({ quiet: true });
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const fs = require("node:fs/promises");
const path = require("node:path");
const db = new PrismaClient();
const file = path.join(process.cwd(), ".gym-cache", "visual-fixtures.json");
async function main() {
  try {
    if (process.argv.includes("--cleanup")) {
      const fixtures = JSON.parse(await fs.readFile(file, "utf8"));
      await db.auditLog.deleteMany({ where: { actorId: { in: fixtures.ids } } });
      await db.gymMember.deleteMany({ where: { userId: { in: fixtures.ids } } });
      await db.user.deleteMany({ where: { id: { in: fixtures.ids } } });
      await fs.unlink(file);
      console.log("Visual fixture cleanup complete");
    } else {
      const tag = "visual-" + Date.now();
      const password = "Visual-" + require("node:crypto").randomBytes(12).toString("hex");
      const passwordHash = await bcrypt.hash(password, 10);
      const owner = await db.user.create({ data: { name: "Verification owner", email: tag + "-owner@example.invalid", role: "OWNER", passwordHash } });
      const member = await db.user.create({ data: { name: "Verification member", email: tag + "-member@example.invalid", role: "MEMBER", passwordHash } });
      await db.gymMember.create({ data: { fullName: member.name, memberId: "OXG-V" + Date.now(), phone: "033" + require("node:crypto").randomInt(10000000, 99999999), userId: member.id, email: member.email } });
      const fixtures = { ids: [owner.id, member.id], ownerEmail: owner.email, memberEmail: member.email, password };
      await fs.writeFile(file, JSON.stringify(fixtures));
      console.log(JSON.stringify(fixtures));
    }
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.log(error.code || error.name); process.exitCode = 1; });
