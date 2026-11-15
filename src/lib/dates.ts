/** Dates as plain "YYYY-MM-DD" strings, formatted in Azerbaijani. */

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
const WEEKDAYS = ["bazar", "bazar ertəsi", "çərşənbə axşamı", "çərşənbə", "cümə axşamı", "cümə", "şənbə"];

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isISO(s: string | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function parts(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

/** "14 iyul" */
export function formatDay(s: string): string {
  if (!isISO(s)) return "";
  const { m, d } = parts(s);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "14 iyul, cümə" */
export function formatDayLong(s: string): string {
  if (!isISO(s)) return "";
  const { y, m, d } = parts(s);
  return `${d} ${MONTHS[m - 1]}, ${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
}

/** "10–13 iyul 2026", "30 iyun – 3 iyul 2026", "30 dekabr 2026 – 2 yanvar 2027" */
export function formatRange(start: string, end: string): string {
  if (!isISO(start)) return "";
  const a = parts(start);
  if (!isISO(end) || end === start) return `${a.d} ${MONTHS[a.m - 1]} ${a.y}`;
  const b = parts(end);
  if (a.y !== b.y) return `${a.d} ${MONTHS[a.m - 1]} ${a.y} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  if (a.m !== b.m) return `${a.d} ${MONTHS[a.m - 1]} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  return `${a.d}–${b.d} ${MONTHS[a.m - 1]} ${a.y}`;
}

/** Number of calendar days a trip covers, inclusive (10–13 iyul = 4 gün). */
export function tripDays(start: string, end: string): number {
  if (!isISO(start) || !isISO(end)) return 0;
  const a = parts(start);
  const b = parts(end);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000) + 1;
}

export function addDays(s: string, n: number): string {
  const { y, m, d } = parts(s);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** "indicə", "5 dəqiqə əvvəl", "3 saat əvvəl", "dünən", "4 gün əvvəl", else "14 iyul". */
export function timeAgo(at: number, now = Date.now()): string {
  const min = Math.floor((now - at) / 60_000);
  if (min < 1) return "indicə";
  if (min < 60) return `${min} dəqiqə əvvəl`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} saat əvvəl`;
  const d = Math.floor(h / 24);
  if (d === 1) return "dünən";
  if (d < 7) return `${d} gün əvvəl`;
  const dt = new Date(at);
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

/** Epoch ms → local "YYYY-MM-DD". */
export function localISO(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
