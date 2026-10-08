// Utility date and currency formatters for Pakistan locale (Asia/Karachi)

export function formatDateTime(
  dateInput: Date | string | number | null | undefined
): string {
  if (!dateInput) return "N/A";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "N/A";

  return date.toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(
  dateInput: Date | string | number | null | undefined
): string {
  if (!dateInput) return "N/A";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "N/A";

  return date.toLocaleDateString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatThermalDate(
  dateInput: Date | string | number | null | undefined
): string {
  if (!dateInput) return "N/A";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "N/A";

  const pad = (n: number) => String(n).padStart(2, "0");
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = pad(date.getMinutes());
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;

  return `${day}/${month}/${year} ${pad(hours)}:${minutes} ${ampm}`;
}

export function formatCurrency(amount: number | string | null | undefined): string {
  const val = typeof amount === "string" ? parseFloat(amount) : amount;
  if (val === null || val === undefined || isNaN(val)) return "Rs. 0";
  return `Rs. ${Math.round(val).toLocaleString()}`;
}
