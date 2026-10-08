const offset = 5 * 60 * 60 * 1000;
const day = 24 * 60 * 60 * 1000;

/** Inclusive Karachi calendar boundaries, independent of server timezone. */
export function getDateRangeForPeriod(period: string, customStart?: string, customEnd?: string) {
  const local = new Date(Date.now() + offset);
  const startToday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offset;
  let start = startToday;
  let end = startToday + day - 1;
  if (period === "yesterday") { start -= day; end -= day; }
  if (period === "this_week") start -= ((local.getUTCDay() + 6) % 7) * day;
  if (period === "this_month") start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - offset;
  if (period === "last_month") { start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1) - offset; end = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - offset - 1; }
  if (period === "all") start = 0;
  if (period === "custom") {
    if (!customStart || !customEnd || !/^\d{4}-\d{2}-\d{2}$/.test(customStart) || !/^\d{4}-\d{2}-\d{2}$/.test(customEnd)) throw new Error("Valid start and end dates are required.");
    start = Date.parse(`${customStart}T00:00:00+05:00`);
    end = Date.parse(`${customEnd}T23:59:59.999+05:00`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || new Date(start + offset).toISOString().slice(0, 10) !== customStart || new Date(end + offset).toISOString().slice(0, 10) !== customEnd) throw new Error("Invalid date range.");
  }
  return { start: new Date(start), end: new Date(end) };
}

export function karachiDateInput() {
  return new Date(Date.now() + offset).toISOString().slice(0, 10);
}
