-- Additive schema update. Review and apply during deployment, before regenerating Prisma Client.
ALTER TABLE "GymMember" ADD COLUMN IF NOT EXISTS "admissionFeePreviouslyPaid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GymMember" ADD COLUMN IF NOT EXISTS "admissionHistoryNote" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Expense_employeeId_fkey') THEN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
