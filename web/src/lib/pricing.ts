import { DurationUnit } from "@prisma/client";

/**
 * Calculates the exact end date (last valid day) of a membership
 * based on Asia/Karachi calendar boundaries and fixed days rules.
 *
 * Requirements:
 * - 30 days: 5 October -> 5 October - 3 November
 * - 1 calendar month: 5 October -> 5 October - 4 November
 * - 3 calendar months: 5 October -> 5 October - 4 January
 * - 1 calendar month: 1 October -> 1 - 31 October
 */
export function calculateMembershipEndDate(
  startDateInput: Date | string,
  durationValue: number,
  durationUnit: DurationUnit
): Date {
  const start = new Date(startDateInput);
  // Ensure we are working with midnight boundary
  const local = new Date(start.getTime() + 18000000);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day = local.getUTCDate();

  if (durationUnit === "DAYS") {
    // Duration is in fixed days. Start date is Day 1.
    // Last valid day = start + (durationValue - 1) days
    const end = new Date(Date.UTC(year, month, day + (durationValue - 1), 23, 59, 59, 999) - 18000000);
    return end;
  }

  if (durationUnit === "CALENDAR_MONTHS") {
    // If starting on the 1st of a month:
    // e.g. 1 October + 1 month = end of October (31 October)
    // Formula: (month + durationValue), day 0 of that target gives last day of previous month
    if (day === 1) {
      const end = new Date(Date.UTC(year, month + durationValue, 0, 23, 59, 59, 999) - 18000000);
      return end;
    }

    // If starting on day > 1 (e.g. 5 October):
    // Target month is month + durationValue
    // Last valid day is (day - 1) in that target month
    // Handle month-end overflow (e.g. 31 Jan + 1 month -> last day of Feb)
    const targetMonth = month + durationValue;
    const daysInTargetMonth = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
    const targetDay = Math.min(day - 1, daysInTargetMonth);

    const end = new Date(Date.UTC(year, targetMonth, targetDay, 23, 59, 59, 999) - 18000000);
    return end;
  }

  if (durationUnit === "YEARS") {
    // e.g. 1 year starting 5 October 2026 -> 4 October 2027
    if (day === 1) {
      const end = new Date(Date.UTC(year + durationValue, month, 0, 23, 59, 59, 999) - 18000000);
      return end;
    }

    const targetYear = year + durationValue;
    const daysInTargetMonth = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
    const targetDay = Math.min(day - 1, daysInTargetMonth);

    const end = new Date(Date.UTC(targetYear, month, targetDay, 23, 59, 59, 999) - 18000000);
    return end;
  }

  // Fallback 30 days
  return new Date(Date.UTC(year, month, day + 29, 23, 59, 59, 999) - 18000000);
}

/**
 * Calculates itemized charges and total payable amount with discounts
 */
export function calculatePricingBreakdown(params: {
  membershipFee: number;
  admissionFee?: number;
  applyAdmissionFee?: boolean;
  discountType?: "FIXED" | "PERCENTAGE" | "NONE";
  discountValue?: number;
  admissionDiscountValue?: number;
}) {
  const {
    membershipFee,
    admissionFee = 0,
    applyAdmissionFee = false,
    discountType = "NONE",
    discountValue = 0,
    admissionDiscountValue = 0,
  } = params;

  // 1. Membership fee discount
  let computedDiscount = 0;
  if (discountType === "PERCENTAGE" && discountValue > 0) {
    const pct = Math.min(100, Math.max(0, discountValue));
    computedDiscount = Math.round((membershipFee * pct) / 100);
  } else if (discountType === "FIXED" && discountValue > 0) {
    computedDiscount = Math.min(membershipFee, discountValue);
  }

  const netMembershipFee = Math.max(0, membershipFee - computedDiscount);

  // 2. Admission fee & waiver
  const rawAdmissionFee = applyAdmissionFee ? admissionFee : 0;
  const netAdmissionFee = Math.max(0, rawAdmissionFee - (admissionDiscountValue || 0));

  // 3. Final total payable
  const totalPayable = netMembershipFee + netAdmissionFee;

  return {
    membershipFee,
    computedDiscount,
    netMembershipFee,
    rawAdmissionFee,
    admissionDiscountValue,
    netAdmissionFee,
    totalPayable,
  };
}
