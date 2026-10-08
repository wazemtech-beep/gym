import { PrismaClient, Role, AccountStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const prisma = new PrismaClient();

async function setupOwner() {
  console.log("==========================================");
  console.log("  OXGEN GYM - INITIAL OWNER SETUP SCRIPT  ");
  console.log("==========================================");

  try {
    // 1. Verify if an Owner already exists
    const existingOwner = await prisma.user.findFirst({
      where: { role: Role.OWNER },
    });

    if (existingOwner) {
      console.error(
        "\n❌ ERROR: Owner account pehle se exist karta hai (" +
          existingOwner.email +
          ").\n" +
          "Requirement ke mutabiq setup dobara run karke doosra owner account create nahi ho sakta!\n"
      );
      process.exit(1);
    }

    // 2. Parse arguments or use environment defaults
    const args = process.argv.slice(2);
    let email = "";
    let password = "";
    let name = "Gym Owner";
    let phone = "03001234567";

    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--email" && args[i + 1]) email = args[i + 1];
      if (args[i] === "--password" && args[i + 1]) password = args[i + 1];
      if (args[i] === "--name" && args[i + 1]) name = args[i + 1];
      if (args[i] === "--phone" && args[i + 1]) phone = args[i + 1];
    }

    if (!email) {
      email = process.env.INITIAL_OWNER_EMAIL || "owner@oxgengym.com";
    }
    if (!password) {
      password = process.env.INITIAL_OWNER_PASSWORD || "OxgenAdmin2026!";
    }

    if (!email.includes("@")) {
      console.error("❌ Valid email lazmi hai!");
      process.exit(1);
    }

    if (password.length < 8) {
      console.error("❌ Password kam az kam 8 characters ka hona chahiye!");
      process.exit(1);
    }

    console.log(`\n⏳ Creating Initial Owner account...`);
    console.log(`- Name:     ${name}`);
    console.log(`- Email:    ${email}`);
    console.log(`- Phone:    ${phone}`);
    console.log(`- Password: ${"*".repeat(password.length)}`);

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Create Owner in database with mustChangePassword = true
    const owner = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash,
        role: Role.OWNER,
        status: AccountStatus.ACTIVE,
        mustChangePassword: true, // First login par change karna lazmi hoga
      },
    });

    // 5. Initialize GymSettings if not present
    await prisma.gymSettings.upsert({
      where: { id: "default" },
      update: { isInitialSetupDone: false },
      create: {
        id: "default",
        gymName: "OXGEN GYM",
        contactEmail: email,
        contactPhone: phone,
        isInitialSetupDone: false,
      },
    });

    // 6. Record Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: owner.id,
        actorName: owner.name,
        actorRole: "OWNER",
        action: "INITIAL_OWNER_SETUP",
        entityType: "USER",
        entityId: owner.id,
        details: JSON.stringify({
          message: "Initial gym owner account created via secure setup script",
          email: owner.email,
          firstLoginPasswordChangeRequired: true,
        }),
      },
    });

    console.log("\n✅ SUCCESS: Initial Owner Account Kamiyabi Se Create Ho Gaya!");
    console.log("--------------------------------------------------");
    console.log(`ID:                     ${owner.id}`);
    console.log(`Email:                  ${owner.email}`);
    console.log(`Role:                   ${owner.role}`);
    console.log(`Status:                 ${owner.status}`);
    console.log(`Must Change Password:   YES (First login par naya password set hoga)`);
    console.log("--------------------------------------------------");
    console.log("Note: Koi public owner signup endpoint nahi hai.");
    console.log("Ab Owner login karke pehla password change karega aur gym details configure karega.\n");
  } catch (err) {
    console.error("❌ Setup execution error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupOwner();
