type Reading = { date: Date } & Record<string, any>;
const metrics = ["weightKg", "waistCm", "chestCm", "hipsCm", "armsCm", "thighsCm"];

export function summarizeProgress(readings: Reading[], now = new Date()) {
  return Object.fromEntries(metrics.map(metric => {
    const entries = readings.filter(reading => typeof reading[metric] === "number" && Number.isFinite(reading[metric]));
    const summarize = (days: number) => {
      const recent = entries.filter(reading => reading.date.getTime() >= now.getTime() - days * 86400000 && reading.date <= now);
      return { readingCount: recent.length, average: recent.length ? Math.round(recent.reduce((sum, reading) => sum + reading[metric], 0) / recent.length * 100) / 100 : null };
    };
    const last = entries.at(-1);
    return [metric, { readingCount: entries.length, latestValue: last?.[metric] ?? null, latestDate: last?.date ?? null, week: summarize(7), month: summarize(30) }];
  }));
}
