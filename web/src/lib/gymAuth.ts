import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

let instance: ReturnType<typeof createGymAuth> | undefined;

/** Better Auth manages credential verification and sessions; gym role/activation policy stays in auth.ts. */
function createGymAuth() {
    const secret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || process.env.SESSION_SECRET;
    if (!secret && process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET is required in production.");
    return betterAuth({
      secret: secret || randomBytes(32).toString("hex"),
      baseURL: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000",
      database: prismaAdapter(prisma, { provider: "postgresql" }),
      emailAndPassword: { enabled: true, disableSignUp: true, password: { hash: password => bcrypt.hash(password, 12), verify: ({ hash, password }) => bcrypt.compare(password, hash) } },
      user: { fields: { image: "avatarUrl" } },
      session: { expiresIn: 30 * 24 * 60 * 60, cookieCache: { enabled: false } },
    });
}

export function getGymAuth() { return instance ??= createGymAuth(); }
