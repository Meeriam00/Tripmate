/** Date helpers that work on plain YYYY-MM-DD strings (no timezone drift). */

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isValidISO(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const { y, m, d } = parts(iso);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function formatDay(iso: string): string {
  if (!isValidISO(iso)) return iso;
  const { y, m, d } = parts(iso);
  const wd = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${wd} ${d} ${MONTHS[m - 1]}`;
}

export function formatShort(iso: string): string {
  if (!isValidISO(iso)) return iso;
  const { m, d } = parts(iso);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "14–18 May 2026", "28 May – 2 Jun 2026", "30 Dec 2026 – 3 Jan 2027". */
export function formatRange(start: string, end: string): string {
  if (!isValidISO(start)) return "";
  const a = parts(start);
  if (!isValidISO(end) || end === start) return `${a.d} ${MONTHS_LONG[a.m - 1]} ${a.y}`;
  const b = parts(end);
  if (a.y !== b.y) return `${a.d} ${MONTHS[a.m - 1]} ${a.y} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  if (a.m !== b.m) return `${a.d} ${MONTHS[a.m - 1]} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  return `${a.d}–${b.d} ${MONTHS_LONG[a.m - 1]} ${a.y}`;
}

export function nights(start: string, end: string): number {
  if (!isValidISO(start) || !isValidISO(end)) return 0;
  const a = parts(start);
  const b = parts(end);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}

export function addDays(iso: string, n: number): string {
  const { y, m, d } = parts(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
