import { addDays, addMonthsClamped, isValidYmd, parseYmd, toYmd } from "./dates";
import type { Frequency } from "./types";

export interface RecurringLike {
  frequency: Frequency;
  nextDate?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  active?: boolean;
}

const STEP_DAYS: Partial<Record<Frequency, number>> = {
  weekly: 7,
  biweekly: 14,
};

function anchorDate(item: RecurringLike): Date | null {
  const ymd = item.startDate || item.nextDate || item.dueDate || "";
  return parseYmd(ymd);
}

export function periodsPerYear(frequency: Frequency): number {
  switch (frequency) {
    case "weekly":
      return 52;
    case "biweekly":
      return 26;
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

function advance(date: Date, frequency: Frequency, originalDay: number): Date {
  if (frequency === "weekly") return addDays(date, 7);
  if (frequency === "biweekly") return addDays(date, 14);
  if (frequency === "monthly") return addMonthsClamped(date, 1, originalDay);
  if (frequency === "quarterly") return addMonthsClamped(date, 3, originalDay);
  if (frequency === "annually") return addMonthsClamped(date, 12, originalDay);
  return addDays(date, 1);
}

function rewind(date: Date, frequency: Frequency, originalDay: number): Date {
  if (frequency === "weekly") return addDays(date, -7);
  if (frequency === "biweekly") return addDays(date, -14);
  if (frequency === "monthly") return addMonthsClamped(date, -1, originalDay);
  if (frequency === "quarterly") return addMonthsClamped(date, -3, originalDay);
  if (frequency === "annually") return addMonthsClamped(date, -12, originalDay);
  return addDays(date, -1);
}

export function listOccurrencesInRange(
  item: RecurringLike,
  rangeStartYmd: string,
  rangeEndYmd: string,
): string[] {
  if (item.active === false) return [];
  if (!isValidYmd(rangeStartYmd) || !isValidYmd(rangeEndYmd)) return [];
  if (rangeStartYmd > rangeEndYmd) return [];

  const startBound = item.startDate && isValidYmd(item.startDate) ? item.startDate : null;
  const endBound = item.endDate && isValidYmd(item.endDate) ? item.endDate : null;

  if (item.frequency === "once") {
    const date = item.nextDate || item.dueDate || item.startDate;
    if (!date || !isValidYmd(date)) return [];
    if (date < rangeStartYmd || date > rangeEndYmd) return [];
    if (startBound && date < startBound) return [];
    if (endBound && date > endBound) return [];
    return [date];
  }

  const anchor = anchorDate(item);
  if (!anchor) return [];
  const originalDay = anchor.getDate();
  const rangeStart = parseYmd(rangeStartYmd)!;
  const rangeEnd = parseYmd(rangeEndYmd)!;

  let cursor = new Date(anchor);
  cursor.setHours(0, 0, 0, 0);

  const step = STEP_DAYS[item.frequency];
  if (step) {
    const startMs = rangeStart.getTime();
    const deltaDays = Math.floor((startMs - cursor.getTime()) / 86400000);
    if (deltaDays > 0) {
      const jumps = Math.floor(deltaDays / step);
      cursor = addDays(cursor, jumps * step);
    }
    while (cursor < rangeStart) cursor = addDays(cursor, step);
  } else {
    let guard = 0;
    while (cursor > rangeStart && guard < 600) {
      const prev = rewind(cursor, item.frequency, originalDay);
      if (prev.getTime() === cursor.getTime()) break;
      cursor = prev;
      guard += 1;
    }
    guard = 0;
    while (cursor < rangeStart && guard < 600) {
      cursor = advance(cursor, item.frequency, originalDay);
      guard += 1;
    }
  }

  const out: string[] = [];
  let safety = 0;
  while (cursor <= rangeEnd && safety < 800) {
    const ymd = toYmd(cursor);
    const afterStart = !startBound || ymd >= startBound;
    const beforeEnd = !endBound || ymd <= endBound;
    if (afterStart && beforeEnd && ymd >= rangeStartYmd && ymd <= rangeEndYmd) {
      out.push(ymd);
    }
    cursor = advance(cursor, item.frequency, originalDay);
    safety += 1;
  }
  return out;
}

export function nextOccurrenceOnOrAfter(item: RecurringLike, fromYmd: string): string | null {
  if (item.active === false) return null;
  if (item.frequency === "once") {
    const date = item.nextDate || item.dueDate || item.startDate;
    if (!date || !isValidYmd(date)) return null;
    return date >= fromYmd ? date : null;
  }
  const far = addDays(parseYmd(fromYmd) ?? new Date(), 370 * 5);
  const dates = listOccurrencesInRange(item, fromYmd, toYmd(far));
  return dates[0] ?? null;
}

export function countOccurrencesInRange(item: RecurringLike, start: string, end: string): number {
  return listOccurrencesInRange(item, start, end).length;
}
