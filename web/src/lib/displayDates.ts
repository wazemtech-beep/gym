const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const karachiOffset = 5 * 60 * 60 * 1000;

/** Fixed PKT output, independent of host timezone and browser ICU/locale. */
export function formatKarachiDate(value: Date | string, includeWeekday = true) {
  const local = new Date(new Date(value).getTime() + karachiOffset);
  if (!Number.isFinite(local.getTime())) return "—";
  const date = `${local.getUTCDate()} ${months[local.getUTCMonth()]} ${local.getUTCFullYear()}`;
  return includeWeekday ? `${weekdays[local.getUTCDay()]}, ${date}` : date;
}

export function formatKarachiPaymentDate(value: string) {
  const local = new Date(new Date(value).getTime() + karachiOffset);
  if (!Number.isFinite(local.getTime())) return "—";
  const hour = local.getUTCHours();
  return `${String(hour % 12 || 12).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}, ${local.getUTCDate()} ${months[local.getUTCMonth()]}`;
}
