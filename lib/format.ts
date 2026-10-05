const TZ = "Europe/Stockholm";

const nf = new Intl.NumberFormat("sv-SE");
export const num = (n: number | string | null | undefined) =>
  n === null || n === undefined || n === "" ? "–" : nf.format(Number(n));

const kr = new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 });
export const sek = (n: number) => kr.format(n);

function toDate(d: Date | string) {
  // "YYYY-MM-DD" tolkas som lokalt datum, inte UTC-midnatt
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00`) : new Date(d);
}

/** 30 sep */
export function shortDate(d: Date | string | null | undefined) {
  if (!d) return "–";
  const date = toDate(d);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date
    .toLocaleDateString("sv-SE", {
      day: "numeric",
      month: "short",
      year: sameYear ? undefined : "numeric",
      timeZone: TZ,
    })
    .replace(".", "");
}

/** 30 sep 14:05 */
export function dateTime(d: Date | string | null | undefined) {
  if (!d) return "–";
  const date = toDate(d);
  return `${shortDate(date)} ${date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", timeZone: TZ })}`;
}

/** Dagens datum i Stockholm som YYYY-MM-DD */
export function todayISO() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
}

export function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Lägger till månader. 31 jan + 1 månad blir 28/29 feb, inte 3 mars. */
export function addMonthsISO(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = total % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Hur många dagar sedan (positivt) eller kvar (negativt) */
export function daysFromToday(iso: string) {
  const a = new Date(`${todayISO()}T12:00:00Z`).getTime();
  const b = new Date(`${iso}T12:00:00Z`).getTime();
  return Math.round((a - b) / 86_400_000);
}

export function relativeDays(iso: string | null) {
  if (!iso) return "";
  const d = daysFromToday(iso);
  if (d === 0) return "idag";
  if (d === 1) return "igår";
  if (d === -1) return "imorgon";
  return d > 0 ? `för ${d} dagar sedan` : `om ${-d} dagar`;
}
