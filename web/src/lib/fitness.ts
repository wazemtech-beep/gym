import { FitnessDataCategory } from "@prisma/client";

/**
 * Returns today's date formatted as YYYY-MM-DD in Asia/Karachi timezone
 */
export function getKarachiTodayDate(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/**
 * Computes start and end date bounds (YYYY-MM-DD) for ranges relative to Asia/Karachi
 */
export function getKarachiDateRange(range: "today" | "week" | "month" | "custom", customStart?: string, customEnd?: string): { startDate: string; endDate: string; totalDays: number } {
  const todayStr = getKarachiTodayDate();
  const [year, month, day] = todayStr.split("-").map(Number);
  const today = new Date(Date.UTC(year, month - 1, day));

  if (range === "today") {
    return { startDate: todayStr, endDate: todayStr, totalDays: 1 };
  }

  if (range === "custom" && customStart && customEnd) {
    const s = new Date(customStart + "T00:00:00Z");
    const e = new Date(customEnd + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(customStart) || !/^\d{4}-\d{2}-\d{2}$/.test(customEnd) || !Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime()) || s > e || s.toISOString().slice(0, 10) !== customStart || e.toISOString().slice(0, 10) !== customEnd) throw new Error("Choose a valid date range.");
    const diffDays = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    return { startDate: customStart, endDate: customEnd, totalDays: diffDays };
  }

  if (range === "month") {
    const pastMonth = new Date(today);
    pastMonth.setUTCDate(today.getUTCDate() - 29); // 30-day window
    const startStr = pastMonth.toISOString().slice(0, 10);
    return { startDate: startStr, endDate: todayStr, totalDays: 30 };
  }

  // Default: "week" (last 7 days including today)
  const pastWeek = new Date(today);
  pastWeek.setUTCDate(today.getUTCDate() - 6); // 7-day window
  const startStr = pastWeek.toISOString().slice(0, 10);
  return { startDate: startStr, endDate: todayStr, totalDays: 7 };
}

export interface ActivitySummaryAggregate {
  totalSteps: number;
  availableDaysSteps: number;
  averageDailySteps: number | null; // NULL if availableDaysSteps === 0, NOT 0!
  totalDistanceKm: number;
  availableDaysDistance: number;
  averageDailyDistanceKm: number | null;
  totalActiveCalories: number;
  availableDaysCalories: number;
  averageDailyActiveCalories: number | null;
  totalWorkouts: number;
  totalWorkoutDurationMinutes: number;
  periodTotalDays: number;
}

/**
 * Computes weekly/monthly summary metrics adhering to OXGEN business rules:
 * - Missing days are NOT counted as 0
 * - Average is strictly total / availableDaysCount
 */
export function calculateActivityAggregates(
  summaries: Array<{
    date: string;
    steps: number | null;
    distanceKm: number | null;
    activeCalories: number | null;
    hasData: boolean;
  }>,
  workoutSessions: Array<{
    durationMinutes: number;
    activeCalories: number | null;
  }>,
  periodTotalDays: number = 7
): ActivitySummaryAggregate {
  let totalSteps = 0;
  let availableDaysSteps = 0;

  let totalDistanceKm = 0;
  let availableDaysDistance = 0;

  let totalActiveCalories = 0;
  let availableDaysCalories = 0;

  for (const s of summaries) {
    if (s.hasData && typeof s.steps === "number" && s.steps >= 0) {
      totalSteps += s.steps;
      availableDaysSteps += 1;
    }
    if (s.hasData && typeof s.distanceKm === "number" && s.distanceKm >= 0) {
      totalDistanceKm += s.distanceKm;
      availableDaysDistance += 1;
    }
    if (s.hasData && typeof s.activeCalories === "number" && s.activeCalories >= 0) {
      totalActiveCalories += s.activeCalories;
      availableDaysCalories += 1;
    }
  }

  const averageDailySteps = availableDaysSteps > 0 ? Math.round(totalSteps / availableDaysSteps) : null;
  const averageDailyDistanceKm = availableDaysDistance > 0 ? parseFloat((totalDistanceKm / availableDaysDistance).toFixed(2)) : null;
  const averageDailyActiveCalories = availableDaysCalories > 0 ? Math.round(totalActiveCalories / availableDaysCalories) : null;

  let totalWorkoutDurationMinutes = 0;
  for (const w of workoutSessions) {
    totalWorkoutDurationMinutes += w.durationMinutes || 0;
  }

  return {
    totalSteps,
    availableDaysSteps,
    averageDailySteps,
    totalDistanceKm: parseFloat(totalDistanceKm.toFixed(2)),
    availableDaysDistance,
    averageDailyDistanceKm,
    totalActiveCalories: Math.round(totalActiveCalories),
    availableDaysCalories,
    averageDailyActiveCalories,
    totalWorkouts: workoutSessions.length,
    totalWorkoutDurationMinutes,
    periodTotalDays,
  };
}

export const ALL_FITNESS_CATEGORIES: FitnessDataCategory[] = [
  FitnessDataCategory.STEPS,
  FitnessDataCategory.DISTANCE,
  FitnessDataCategory.EXERCISE_SESSIONS,
  FitnessDataCategory.ACTIVE_CALORIES,
];

/**
 * Returns date ranges for current 7 days vs previous 7 days for comparison
 */
export function getTwoWeekComparisonRanges(): {
  currentWeek: { startDate: string; endDate: string };
  previousWeek: { startDate: string; endDate: string };
} {
  const todayStr = getKarachiTodayDate();
  const [year, month, day] = todayStr.split("-").map(Number);
  const today = new Date(Date.UTC(year, month - 1, day));

  // Current week: past 6 days + today = 7 days
  const currentStart = new Date(today);
  currentStart.setUTCDate(today.getUTCDate() - 6);

  // Previous week: 7 days before currentStart
  const prevEnd = new Date(currentStart);
  prevEnd.setUTCDate(currentStart.getUTCDate() - 1);

  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevEnd.getUTCDate() - 6);

  return {
    currentWeek: {
      startDate: currentStart.toISOString().slice(0, 10),
      endDate: todayStr,
    },
    previousWeek: {
      startDate: prevStart.toISOString().slice(0, 10),
      endDate: prevEnd.toISOString().slice(0, 10),
    },
  };
}

/**
 * Calculates date boundary based on member's selected historyRangeType
 */
export function calculateHistoryRangeStartDate(rangeType?: string | null): Date | null {
  if (!rangeType || rangeType === "ALL") return null;

  const now = new Date();
  if (rangeType === "LAST_30_DAYS") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  }
  if (rangeType === "LAST_90_DAYS") {
    const d = new Date(now);
    d.setDate(d.getDate() - 90);
    return d;
  }
  if (rangeType === "CONSENT_ONWARD") {
    return now;
  }
  return null;
}

