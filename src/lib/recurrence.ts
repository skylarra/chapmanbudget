import { addDays, addMonthsClamped, clampDay, daysInMonth, isValidYmd, parseYmd, toYmd } from "./dates";
import type { Frequency } from "./types";

export interface RecurringLike {
  frequency: Frequency;
  nextDate?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  secondDay?: number | null;
  active?: boolean;
}

export function periodsPerYear(frequency: Frequency): number {
  switch (frequency) {
    case "weekly":
      return 52;
    case "biweekly":
      return 26;
    case "twice_monthly":
      return 24;
    case "monthly":
      return 12;
    case "quarterly":
      return 4;
    case "annually":
      return 1;
    default:
      return 1;
  }
}

function originYmd(item: RecurringLike): string | null {
  const ymd = item.startDate || item.nextDate || item.dueDate || "";
  return isValidYmd(ymd) ? ymd : null;
}

function twiceDays(item: RecurringLike): [number, number] {
  const origin = parseYmd(originYmd(item) || "") ?? new Date();
  const a = clampDay(origin.getDate(), 1, 28);
  const b = clampDay(item.secondDay ?? 15, 1, 28);
  return a <= b ? [a, b] : [b, a];
}

function dateOn(year: number, monthIndex: number, day: number): Date {
  const dim = daysInMonth(year, monthIndex);
  return new Date(year, monthIndex, Math.min(day, dim), 0, 0, 0, 0);
}

export function advanceFrom(ymd: string, frequency: Frequency, secondDay?: number | null): string {
  const d = parseYmd(ymd);
  if (!d) return ymd;
  if (frequency === "once") return ymd;
  if (frequency === "weekly") return toYmd(addDays(d, 7));
  if (frequency === "biweekly") return toYmd(addDays(d, 14));
  if (frequency === "monthly") return toYmd(addMonthsClamped(d, 1, d.getDate()));
  if (frequency === "quarterly") return toYmd(addMonthsClamped(d, 3, d.getDate()));
  if (frequency === "annually") return toYmd(addMonthsClamped(d, 12, d.getDate()));
  const [first, second] = twiceDays({ frequency, nextDate: ymd, secondDay: secondDay ?? 15 });
  const day = d.getDate();
  if (day < second && first !== second) return toYmd(dateOn(d.getFullYear(), d.getMonth(), second));
  const next = addMonthsClamped(d, 1, 1);
  return toYmd(dateOn(next.getFullYear(), next.getMonth(), first));
}

export function listOccurrencesInRange(item: RecurringLike, rangeStartYmd: string, rangeEndYmd: string): string[] {
  if (item.active === false) return [];
  if (!isValidYmd(rangeStartYmd) || !isValidYmd(rangeEndYmd) || rangeStartYmd > rangeEndYmd) return [];

  const startBound = item.startDate && isValidYmd(item.startDate) ? item.startDate : originYmd(item);
  const endBound = item.endDate && isValidYmd(item.endDate) ? item.endDate : null;

  if (item.frequency === "once") {
    const date = originYmd(item);
    if (!date || date < rangeStartYmd || date > rangeEndYmd) return [];
    return [date];
  }

  if (item.frequency === "twice_monthly") {
    const [first, second] = twiceDays(item);
    const start = parseYmd(rangeStartYmd)!;
    const end = parseYmd(rangeEndYmd)!;
    const out: string[] = [];
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      for (const day of first === second ? [first] : [first, second]) {
        const d = dateOn(cursor.getFullYear(), cursor.getMonth(), day);
        const ymd = toYmd(d);
        if (ymd >= rangeStartYmd && ymd <= rangeEndYmd && (!startBound || ymd >= startBound) && (!endBound || ymd <= endBound)) {
          out.push(ymd);
        }
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return out;
  }

  const origin = originYmd(item);
  const anchor = parseYmd(origin);
  if (!anchor) return [];
  const originalDay = anchor.getDate();
  const rangeStart = parseYmd(rangeStartYmd)!;
  const rangeEnd = parseYmd(rangeEndYmd)!;
  let cursor = new Date(anchor);
  cursor.setHours(0, 0, 0, 0);

  const step = item.frequency === "weekly" ? 7 : item.frequency === "biweekly" ? 14 : 0;
  if (step) {
    const deltaDays = Math.floor((rangeStart.getTime() - cursor.getTime()) / 86400000);
    if (deltaDays > 0) cursor = addDays(cursor, Math.floor(deltaDays / step) * step);
    while (cursor < rangeStart) cursor = addDays(cursor, step);
  } else {
    let guard = 0;
    while (cursor > rangeStart && guard < 600) {
      const prev =
        item.frequency === "monthly"
          ? addMonthsClamped(cursor, -1, originalDay)
          : item.frequency === "quarterly"
            ? addMonthsClamped(cursor, -3, originalDay)
            : addMonthsClamped(cursor, -12, originalDay);
      if (prev.getTime() === cursor.getTime()) break;
      cursor = prev;
      guard += 1;
    }
    guard = 0;
    while (cursor < rangeStart && guard < 600) {
      cursor =
        item.frequency === "monthly"
          ? addMonthsClamped(cursor, 1, originalDay)
          : item.frequency === "quarterly"
            ? addMonthsClamped(cursor, 3, originalDay)
            : addMonthsClamped(cursor, 12, originalDay);
      guard += 1;
    }
  }

  const out: string[] = [];
  let safety = 0;
  while (cursor <= rangeEnd && safety < 800) {
    const ymd = toYmd(cursor);
    if ((!startBound || ymd >= startBound) && (!endBound || ymd <= endBound) && ymd >= rangeStartYmd && ymd <= rangeEndYmd) {
      out.push(ymd);
    }
    cursor =
      step
        ? addDays(cursor, step)
        : item.frequency === "monthly"
          ? addMonthsClamped(cursor, 1, originalDay)
          : item.frequency === "quarterly"
            ? addMonthsClamped(cursor, 3, originalDay)
            : addMonthsClamped(cursor, 12, originalDay);
    safety += 1;
  }
  return out;
}

export function nextOccurrenceAfter(item: RecurringLike, afterYmd: string): string | null {
  if (item.active === false) return null;
  if (item.frequency === "once") {
    const date = originYmd(item);
    if (!date) return null;
    return date > afterYmd ? date : null;
  }
  return advanceFrom(afterYmd, item.frequency, item.secondDay);
}
