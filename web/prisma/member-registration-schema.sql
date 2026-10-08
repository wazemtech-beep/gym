-- Apply with the project's normal database migration process, then regenerate Prisma Client.
CREATE TABLE IF NOT EXISTS "MemberRegistrationRequest" (
  "id" TEXT PRIMARY KEY,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "passwordHash" TEXT,
  "photoUrl" TEXT,
  "joiningDate" TIMESTAMP(3),
  "dateOfBirth" TIMESTAMP(3),
  "address" TEXT,
  "emergencyContactName" TEXT,
  "emergencyContactPhone" TEXT,
  "fitnessGoal" TEXT,
  "limitations" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','APPROVED','REJECTED')),
  "rejectionReason" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "memberRecordId" TEXT,
  "ipHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "MemberRegistrationRequest" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
ALTER TABLE "MemberRegistrationRequest" ADD COLUMN IF NOT EXISTS "joiningDate" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "MemberRegistrationRequest_status_createdAt_idx" ON "MemberRegistrationRequest" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "MemberRegistrationRequest_email_status_idx" ON "MemberRegistrationRequest" ("email", "status");
CREATE INDEX IF NOT EXISTS "MemberRegistrationRequest_phone_status_idx" ON "MemberRegistrationRequest" ("phone", "status");
CREATE INDEX IF NOT EXISTS "MemberRegistrationRequest_ipHash_createdAt_idx" ON "MemberRegistrationRequest" ("ipHash", "createdAt");
-- Pending email/contact uniqueness also protects submissions from other app instances.
CREATE UNIQUE INDEX IF NOT EXISTS "MemberRegistrationRequest_pending_email_key" ON "MemberRegistrationRequest" (lower("email")) WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX IF NOT EXISTS "MemberRegistrationRequest_pending_phone_key" ON "MemberRegistrationRequest" ("phone") WHERE "status" = 'PENDING';
