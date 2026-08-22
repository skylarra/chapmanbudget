/** Local-date helpers. All dates are YYYY-MM-DD in local time. */

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY = /^\d{4}-\d{2}$/;

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function todayYmd(now = new Date()): string {
  return toYmd(now);
}

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseYmd(ymd: string | null | undefined): Date | null {
  if (!ymd || !YMD.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export function isValidYmd(ymd: string | null | undefined): boolean {
  return parseYmd(ymd) !== null;
}

export function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function monthKeyFromYmd(ymd: string): string {
  if (MONTH_KEY.test(ymd)) return ymd;
  return ymd.slice(0, 7);
}

export function parseMonthKey(key: string): { year: number; monthIndex: number } | null {
  if (!MONTH_KEY.test(key)) return null;
  const year = Number(key.slice(0, 4));
  const monthIndex = Number(key.slice(5, 7)) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return { year, monthIndex };
}

export function addMonthsKey(key: string, delta: number): string {
  const parsed = parseMonthKey(key);
  if (!parsed) return key;
  const d = new Date(parsed.year, parsed.monthIndex + delta, 1);
  return monthKeyFromDate(d);
}

export function monthBounds(monthKey: string): { start: Date; end: Date; startYmd: string; endYmd: string } {
  const parsed = parseMonthKey(monthKey) ?? { year: new Date().getFullYear(), monthIndex: new Date().getMonth() };
  const start = new Date(parsed.year, parsed.monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(parsed.year, parsed.monthIndex + 1, 0, 23, 59, 59, 999);
  return { start, end, startYmd: toYmd(start), endYmd: toYmd(end) };
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addMonthsClamped(d: Date, months: number, day = d.getDate()): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const dim = daysInMonth(target.getFullYear(), target.getMonth());
  target.setDate(Math.min(day, dim));
  target.setHours(0, 0, 0, 0);
  return target;
}

export function compareYmd(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function isInRangeYmd(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function daysBetween(a: string, b: string): number {
  const da = parseYmd(a);
  const db = parseYmd(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function formatNiceDate(ymd: string, locale = "en-US"): string {
  const d = parseYmd(ymd);
  if (!d) return ymd || "";
  return d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
}

export function formatMonthLabel(monthKey: string, locale = "en-US"): string {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return monthKey;
  return new Date(parsed.year, parsed.monthIndex, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

export function weekdayOf(ymd: string): number {
  return parseYmd(ymd)?.getDay() ?? 0;
}

export function startOfWeek(d: Date, firstDay = 1): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = (day - firstDay + 7) % 7;
  date.setDate(date.getDate() - diff);
  return date;
}

export function endOfWeek(d: Date, firstDay = 1): Date {
  const start = startOfWeek(d, firstDay);
  const end = addDays(start, 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function clampDay(day: number, min = 1, max = 28): number {
  const n = Number(day);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function isoNow(): string {
  return new Date().toISOString();
}
