import { Prisma } from "@prisma/client";

/** A scheduled assignment is readable only during its effective period. */
export function effectiveTrainerAssignment(now = new Date()): Prisma.TrainerAssignmentWhereInput {
  return { isActive: true, startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }], trainer: { status: "ACTIVE" } };
}
