import { addDays, daysBetween, formatMonthLabel, monthBounds, parseYmd, todayYmd, toYmd } from "./dates";
import type { Cents } from "./money";
import { periodsPerYear } from "./recurrence";
import type { AppState, Bill, ExpenseBucket, Frequency, IncomeSource, Transaction } from "./types";

export function totalExpenseBalances(state: AppState): Cents {
  return state.expenseBuckets.reduce((s, b) => s + b.balanceCents, 0);
}

export function totalSavings(state: AppState): Cents {
  return state.savingsBuckets.reduce((s, b) => s + b.balanceCents, 0);
}

export function totalMoney(state: AppState): Cents {
  return state.unassignedCents + totalExpenseBalances(state) + totalSavings(state);
}

export function mainIncomeSource(state: AppState): IncomeSource | null {
  if (state.settings.paycheckIncomeId) {
    const found = state.incomeSources.find((i) => i.id === state.settings.paycheckIncomeId && i.active);
    if (found) return found;
  }
  const active = state.incomeSources.filter((i) => i.active && i.frequency !== "once");
  if (!active.length) return state.incomeSources.find((i) => i.active) ?? null;
  return active.slice().sort((a, b) => b.expectedCents * periodsPerYear(b.frequency) - a.expectedCents * periodsPerYear(a.frequency))[0];
}

export function nextExpectedIncome(state: AppState, today = todayYmd()): IncomeSource | null {
  const upcoming = state.incomeSources
    .filter((i) => i.active && i.nextDate >= today)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate) || b.expectedCents - a.expectedCents);
  if (upcoming.length) return upcoming[0];
  const overdue = state.incomeSources.filter((i) => i.active).sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  return overdue[0] ?? null;
}

export function activeBillsSorted(state: AppState): Bill[] {
  return state.bills
    .filter((b) => b.active)
    .slice()
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate) || a.name.localeCompare(b.name));
}

export function upcomingBills(state: AppState, withinDays = 45, today = todayYmd()): Bill[] {
  const start = parseYmd(today) ?? new Date();
  const end = toYmd(addDays(start, withinDays));
  return activeBillsSorted(state).filter((b) => b.nextDueDate <= end);
}

export function billBucket(state: AppState, bill: Bill): ExpenseBucket | undefined {
  return bill.bucketId ? state.expenseBuckets.find((b) => b.id === bill.bucketId) : undefined;
}

export function billFunded(state: AppState, bill: Bill): boolean {
  const bucket = billBucket(state, bill);
  const inBucket = bucket?.balanceCents ?? 0;
  return inBucket + state.unassignedCents >= bill.amountCents;
}

export function billCoveredInBucket(state: AppState, bill: Bill): boolean {
  const bucket = billBucket(state, bill);
  return (bucket?.balanceCents ?? 0) >= bill.amountCents;
}

/** Recommended amount to set aside each paycheck for a bill. */
export function recommendedPerPaycheck(bill: Pick<Bill, "amountCents" | "frequency">, paycheckFrequency: Frequency): Cents {
  if (bill.frequency === "once") return bill.amountCents;
  const payPeriods = Math.max(1, periodsPerYear(paycheckFrequency === "once" ? "monthly" : paycheckFrequency));
  const annual = bill.amountCents * periodsPerYear(bill.frequency);
  return Math.round(annual / payPeriods);
}

export function upcomingBillReserve(state: AppState, today = todayYmd()): Cents {
  const bills = upcomingBills(state, 45, today);
  const remainingByBucket = new Map(state.expenseBuckets.map((b) => [b.id, b.balanceCents]));
  let need = 0;
  for (const bill of bills) {
    if (bill.bucketId && remainingByBucket.has(bill.bucketId)) {
      const have = remainingByBucket.get(bill.bucketId) || 0;
      const take = Math.min(have, bill.amountCents);
      remainingByBucket.set(bill.bucketId, have - take);
      need += bill.amountCents - take;
    } else {
      need += bill.amountCents;
    }
  }
  return need;
}

export function plannedSavingsReserve(state: AppState): Cents {
  const pay = mainIncomeSource(state);
  const payFreq = pay?.frequency ?? "biweekly";
  return state.savingsBuckets.reduce((sum, s) => {
    if (!s.autoContributionCents) return sum;
    if (!s.autoFrequency || s.autoFrequency === payFreq || s.autoFrequency === "once") return sum + s.autoContributionCents;
    const annual = s.autoContributionCents * periodsPerYear(s.autoFrequency);
    return sum + Math.round(annual / Math.max(1, periodsPerYear(payFreq)));
  }, 0);
}

export interface SafeToSpend {
  availableCents: Cents;
  upcomingBillsCents: Cents;
  plannedSavingsCents: Cents;
  otherReservedCents: Cents;
  safeCents: Cents;
}

export function safeToSpend(state: AppState, today = todayYmd()): SafeToSpend {
  const availableCents = state.unassignedCents;
  const upcomingBillsCents = upcomingBillReserve(state, today);
  const plannedSavingsCents = plannedSavingsReserve(state);
  const otherReservedCents = 0;
  const safeCents = availableCents - upcomingBillsCents - plannedSavingsCents - otherReservedCents;
  return { availableCents, upcomingBillsCents, plannedSavingsCents, otherReservedCents, safeCents };
}

export function txsInMonth(state: AppState, monthKey: string): Transaction[] {
  const { startYmd, endYmd } = monthBounds(monthKey);
  return state.transactions.filter((t) => t.date >= startYmd && t.date <= endYmd);
}

export function monthBucketActivity(state: AppState, monthKey: string) {
  const txs = txsInMonth(state, monthKey);
  return state.expenseBuckets.map((bucket) => {
    const spent = txs
      .filter((t) => t.type === "expense" && t.expenseBucketId === bucket.id)
      .reduce((s, t) => s + t.amountCents, 0);
    const funded = txs
      .filter((t) => t.type === "transfer" && t.toKind === "expense" && t.toId === bucket.id)
      .reduce((s, t) => s + t.amountCents, 0);
    const month = state.months[monthKey];
    const planned = month?.expenseTargets[bucket.id] ?? bucket.targetCents;
    return {
      bucket,
      plannedCents: planned,
      actualCents: spent,
      remainingCents: planned - spent,
      fundedCents: funded,
      overspent: spent > planned && planned > 0,
    };
  });
}

export function daysUntilDue(date: string, today = todayYmd()): number {
  return daysBetween(today, date);
}

export function groupBillsByDate(bills: Bill[], today = todayYmd()): { label: string; date: string; bills: Bill[] }[] {
  const groups: { label: string; date: string; bills: Bill[] }[] = [];
  const sorted = bills.slice().sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate) || a.name.localeCompare(b.name));
  for (const bill of sorted) {
    const label =
      bill.nextDueDate === today
        ? "TODAY"
        : bill.nextDueDate < today
          ? "OVERDUE"
          : formatGroupDate(bill.nextDueDate);
    const last = groups[groups.length - 1];
    if (last && last.date === bill.nextDueDate) last.bills.push(bill);
    else groups.push({ label, date: bill.nextDueDate, bills: [bill] });
  }
  return groups;
}

function formatGroupDate(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[m - 1]} ${d}`;
}

export function expenseSpent(bucket: ExpenseBucket, state: AppState, monthKey: string): Cents {
  return txsInMonth(state, monthKey)
    .filter((t) => t.type === "expense" && t.expenseBucketId === bucket.id)
    .reduce((s, t) => s + t.amountCents, 0);
}

export { formatMonthLabel };
