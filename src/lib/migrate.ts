import { dollarsToCents } from "./money";
import { createId } from "./ids";
import { isoNow, isValidYmd, monthKeyFromDate, todayYmd } from "./dates";
import { createEmptyState, stamp } from "./defaults";
import type { AppState, Bill, ExpenseBucket, Frequency, IncomeSource, SavingsBucket, Transaction, TxType } from "./types";
import { APP_VERSION, FREQUENCIES } from "./types";

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function str(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v);
}
function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function ymd(v: unknown, fallback = todayYmd()): string {
  const s = str(v);
  return isValidYmd(s) ? s : fallback;
}
function ymdOpt(v: unknown): string | null {
  const s = str(v);
  return isValidYmd(s) ? s : null;
}
function freq(raw: unknown): Frequency {
  const v = str(raw, "monthly").toLowerCase().replace("bi-weekly", "biweekly").replace("yearly", "annually").replace("annual", "annually").replace("one-time", "once").replace("onetime", "once").replace("twice monthly", "twice_monthly").replace("twice-monthly", "twice_monthly");
  if (v === "twicemonthly" || v === "semi_monthly" || v === "semimonthly") return "twice_monthly";
  return FREQUENCIES.includes(v as Frequency) ? (v as Frequency) : "monthly";
}

function unique(prefix: string, used: Set<string>, suggested?: unknown): string {
  const s = suggested != null ? String(suggested) : "";
  if (s && !used.has(s)) {
    used.add(s);
    return s;
  }
  let id = createId(prefix);
  while (used.has(id)) id = createId(prefix);
  used.add(id);
  return id;
}

export function isLegacyBucketsFile(raw: unknown): boolean {
  const o = rec(raw);
  return Array.isArray(o.buckets) && (Array.isArray(o.recurringIncome) || Array.isArray(o.recurringBills)) && !Array.isArray(o.expenseBuckets) && !Array.isArray(o.incomeSources);
}

export function isV8State(raw: unknown): boolean {
  const o = rec(raw);
  return Array.isArray(o.categories) && Array.isArray(o.incomeSources) && Array.isArray(o.bills);
}

export function sanitizeState(raw: unknown): AppState {
  const o = rec(raw);
  const base = createEmptyState();
  const used = new Set<string>();
  const settings = rec(o.settings);
  base.settings = {
    ...base.settings,
    currency: str(settings.currency, "USD") || "USD",
    locale: str(settings.locale, "en-US") || "en-US",
    firstDayOfWeek: Math.max(0, Math.min(6, num(settings.firstDayOfWeek, 0))),
    theme: settings.theme === "dark" || settings.theme === "light" ? settings.theme : "system",
    lastBackupAt: settings.lastBackupAt ? str(settings.lastBackupAt) : null,
    paycheckIncomeId: settings.paycheckIncomeId ? str(settings.paycheckIncomeId) : null,
  };
  base.unassignedCents = Math.round(num(o.unassignedCents, 0));

  const expenses = arr<Record<string, unknown>>(o.expenseBuckets);
  if (expenses.length) {
    base.expenseBuckets = expenses.map((b, i) => ({
      id: unique("exp", used, b.id),
      name: str(b.name, "Bucket"),
      balanceCents: Math.round(num(b.balanceCents, 0)),
      targetCents: Math.round(num(b.targetCents, 0)),
      rollover: bool(b.rollover, true),
      spendingLimitCents: b.spendingLimitCents == null ? null : Math.round(num(b.spendingLimitCents, 0)),
      notes: str(b.notes),
      color: str(b.color, "#1f6f5b"),
      icon: str(b.icon, "📦"),
      sortOrder: num(b.sortOrder, i),
      createdAt: str(b.createdAt, isoNow()),
      updatedAt: str(b.updatedAt, isoNow()),
    }));
  }

  const savings = arr<Record<string, unknown>>(o.savingsBuckets);
  if (savings.length) {
    base.savingsBuckets = savings.map((b, i) => ({
      id: unique("sav", used, b.id),
      name: str(b.name, "Savings"),
      balanceCents: Math.round(num(b.balanceCents, 0)),
      goalCents: Math.round(num(b.goalCents, 0)),
      targetDate: ymdOpt(b.targetDate),
      autoContributionCents: Math.round(num(b.autoContributionCents, 0)),
      autoFrequency: b.autoFrequency ? freq(b.autoFrequency) : "biweekly",
      notes: str(b.notes),
      color: str(b.color, "#1f6f5b"),
      icon: str(b.icon, "💰"),
      sortOrder: num(b.sortOrder, i),
      createdAt: str(b.createdAt, isoNow()),
      updatedAt: str(b.updatedAt, isoNow()),
    }));
  }

  base.bills = arr<Record<string, unknown>>(o.bills).map((b) => ({
    id: unique("bill", used, b.id),
    name: str(b.name, "Bill"),
    amountCents: Math.round(num(b.amountCents, num(b.expectedCents, 0))),
    frequency: freq(b.frequency),
    nextDueDate: ymd(b.nextDueDate || b.dueDate),
    secondDay: b.secondDay == null ? null : Math.round(num(b.secondDay, 15)),
    bucketId: b.bucketId ? str(b.bucketId) : null,
    active: bool(b.active, true),
    notes: str(b.notes),
    createdAt: str(b.createdAt, isoNow()),
    updatedAt: str(b.updatedAt, isoNow()),
  }));

  base.incomeSources = arr<Record<string, unknown>>(o.incomeSources).map((i) => ({
    id: unique("inc", used, i.id),
    name: str(i.name, "Income"),
    expectedCents: Math.round(num(i.expectedCents, num(i.amountCents, 0))),
    frequency: freq(i.frequency),
    nextDate: ymd(i.nextDate),
    secondDay: i.secondDay == null ? null : Math.round(num(i.secondDay, 15)),
    active: bool(i.active, true),
    notes: str(i.notes),
    createdAt: str(i.createdAt, isoNow()),
    updatedAt: str(i.updatedAt, isoNow()),
  }));

  const txType = (t: string): TxType => (t === "income" || t === "transfer" ? t : "expense");
  base.transactions = arr<Record<string, unknown>>(o.transactions)
    .filter((t) => {
      const type = str(t.type);
      return type === "income" || type === "expense" || type === "transfer" || type === "bill_payment" || type === "savings_contribution" || type === "bucket_contribution";
    })
    .map((t) => ({
      id: unique("tx", used, t.id),
      date: ymd(t.date),
      amountCents: Math.round(num(t.amountCents, 0)),
      type: str(t.type) === "bill_payment" ? "expense" : str(t.type) === "savings_contribution" || str(t.type) === "bucket_contribution" ? "transfer" : txType(str(t.type)),
      description: str(t.description, "Transaction"),
      notes: str(t.notes),
      expenseBucketId: t.expenseBucketId ? str(t.expenseBucketId) : t.categoryId ? str(t.categoryId) : t.bucketId ? str(t.bucketId) : null,
      savingsBucketId: t.savingsBucketId ? str(t.savingsBucketId) : t.savingsGoalId ? str(t.savingsGoalId) : null,
      incomeSourceId: t.incomeSourceId ? str(t.incomeSourceId) : null,
      billId: t.billId ? str(t.billId) : null,
      fromKind: (t.fromKind as Transaction["fromKind"]) || null,
      fromId: t.fromId ? str(t.fromId) : null,
      toKind: (t.toKind as Transaction["toKind"]) || null,
      toId: t.toId ? str(t.toId) : null,
      occurrenceKey: t.occurrenceKey ? str(t.occurrenceKey) : null,
      createdAt: str(t.createdAt, isoNow()),
      updatedAt: str(t.updatedAt, isoNow()),
    }));

  const months: AppState["months"] = {};
  for (const [key, value] of Object.entries(rec(o.months))) {
    const m = rec(value);
    months[key] = {
      monthKey: key,
      rolloverApplied: bool(m.rolloverApplied, false),
      expenseTargets: Object.fromEntries(Object.entries(rec(m.expenseTargets)).map(([id, cents]) => [id, Math.round(num(cents, 0))])),
      notes: str(m.notes),
    };
  }
  base.months = months;
  const cm = str(o.currentMonth);
  base.currentMonth = /^\d{4}-\d{2}$/.test(cm) ? cm : monthKeyFromDate(new Date());
  base.version = APP_VERSION;
  return base;
}

export function migrateLegacy(raw: unknown): AppState {
  const o = rec(raw);
  const state = createEmptyState();
  const used = new Set<string>();
  const year = num(o.selectedYear, new Date().getFullYear());
  const month = num(o.selectedMonth, new Date().getMonth());
  if (year >= 2000 && month >= 0 && month <= 11) state.currentMonth = monthKeyFromDate(new Date(year, month, 1));

  const buckets = arr<Record<string, unknown>>(o.buckets);
  if (buckets.length) {
    state.expenseBuckets = buckets.map((b, i) => ({
      id: unique("exp", used, b.id),
      name: str(b.name, "Bucket"),
      balanceCents: 0,
      targetCents: dollarsToCents(b.budgeted),
      rollover: str(b.period) !== "weekly",
      spendingLimitCents: null,
      notes: "",
      color: "#1f6f5b",
      icon: str(b.period) === "weekly" ? "📅" : "📦",
      sortOrder: i,
      ...stamp(),
    }));
  }

  const idMap = new Map<string, string>();
  buckets.forEach((b, i) => idMap.set(String(b.id), state.expenseBuckets[i]?.id));

  const incomeRows = arr<Record<string, unknown>>(o.recurringIncome);
  const incomeFallback = arr<Record<string, unknown>>(o.income);
  state.incomeSources = (incomeRows.length ? incomeRows : incomeFallback).map((i) => ({
    id: unique("inc", used, i.id),
    name: str(i.name, "Income"),
    expectedCents: dollarsToCents(i.amount),
    frequency: freq(i.frequency),
    nextDate: ymd(i.nextDate),
    secondDay: null,
    active: true,
    notes: "",
    ...stamp(),
  })) as IncomeSource[];

  const billRows = arr<Record<string, unknown>>(o.recurringBills);
  const billFallback = arr<Record<string, unknown>>(o.bills);
  state.bills = (billRows.length ? billRows : billFallback).map((b) => {
    let due = str(b.nextDate);
    if (!isValidYmd(due)) {
      const day = Math.max(1, Math.min(28, num(b.dueDay, 1)));
      const m = freq(b.frequency) === "annually" ? Math.max(1, Math.min(12, num(b.dueMonth, 1))) : new Date().getMonth() + 1;
      due = `${new Date().getFullYear()}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (!isValidYmd(due)) due = todayYmd();
    }
    return {
      id: unique("bill", used, b.id),
      name: str(b.name, "Bill"),
      amountCents: dollarsToCents(b.amount),
      frequency: freq(b.frequency),
      nextDueDate: due,
      secondDay: null,
      bucketId: null,
      active: true,
      notes: "",
      ...stamp(),
    } satisfies Bill;
  });

  state.transactions = arr<Record<string, unknown>>(o.transactions).map((t) => ({
    id: unique("tx", used, t.id),
    date: ymd(t.date),
    amountCents: dollarsToCents(t.amount),
    type: "expense" as const,
    description: str(t.description, "Transaction"),
    notes: "",
    expenseBucketId: idMap.get(String(t.bucketId ?? "")) ?? null,
    savingsBucketId: null,
    incomeSourceId: null,
    billId: null,
    fromKind: "expense" as const,
    fromId: idMap.get(String(t.bucketId ?? "")) ?? null,
    toKind: null,
    toId: null,
    occurrenceKey: null,
    ...stamp(),
  }));

  if (state.incomeSources[0]) state.settings.paycheckIncomeId = state.incomeSources[0].id;
  state.version = APP_VERSION;
  return state;
}

export function migrateV8(raw: unknown): AppState {
  const o = rec(raw);
  const state = createEmptyState();
  const used = new Set<string>();
  const cats = arr<Record<string, unknown>>(o.categories);
  const savingsCats = cats.filter((c) => str(c.kind) === "savings");
  const expenseCats = cats.filter((c) => str(c.kind) !== "savings");
  if (expenseCats.length) {
    state.expenseBuckets = expenseCats.map((c, i) => ({
      id: unique("exp", used, c.id),
      name: str(c.name, "Bucket"),
      balanceCents: 0,
      targetCents: Math.round(num(c.defaultBudgetCents, 0)),
      rollover: bool(c.rollover, true),
      spendingLimitCents: null,
      notes: "",
      color: str(c.color, "#1f6f5b"),
      icon: str(c.icon, "📦"),
      sortOrder: num(c.sortOrder, i),
      createdAt: str(c.createdAt, isoNow()),
      updatedAt: str(c.updatedAt, isoNow()),
    })) as ExpenseBucket[];
  }
  const v8Buckets = arr<Record<string, unknown>>(o.buckets);
  const v8Goals = arr<Record<string, unknown>>(o.savingsGoals);
  const mergedSav: Record<string, unknown>[] = [
    ...savingsCats.map((c) => ({ ...c, goalCents: c.defaultBudgetCents, balanceCents: 0 })),
    ...v8Buckets,
    ...v8Goals,
  ];
  if (mergedSav.length) {
    state.savingsBuckets = mergedSav.map((b, i) => ({
      id: unique("sav", used, b.id),
      name: str(b.name, "Savings"),
      balanceCents: Math.round(num(b.balanceCents, num(b.currentCents, 0))),
      goalCents: Math.round(num(b.goalCents, num(b.targetCents, 0))),
      targetDate: ymdOpt(b.targetDate),
      autoContributionCents: Math.round(num(b.contributionCents, num(b.autoContributionCents, 0))),
      autoFrequency: b.frequency ? freq(b.frequency) : "monthly",
      notes: str(b.notes),
      color: str(b.color, "#1f6f5b"),
      icon: str(b.icon, "💰"),
      sortOrder: i,
      createdAt: str(b.createdAt, isoNow()),
      updatedAt: str(b.updatedAt, isoNow()),
    })) as SavingsBucket[];
  }
  const sanitized = sanitizeState({
    ...o,
    expenseBuckets: state.expenseBuckets,
    savingsBuckets: state.savingsBuckets,
    unassignedCents: arr<Record<string, unknown>>(o.accounts)
      .filter((a) => str(a.type) === "checking" || str(a.type) === "cash")
      .reduce((s, a) => s + Math.round(num(a.startingBalanceCents, 0)), 0),
  });
  return sanitized;
}

export function hydrateFromUnknown(raw: unknown): AppState {
  const o = rec(raw);
  if (Array.isArray(o.expenseBuckets) || Number(o.version) >= 9) return sanitizeState(raw);
  if (isV8State(raw)) return migrateV8(raw);
  if (isLegacyBucketsFile(raw)) return migrateLegacy(raw);
  return sanitizeState(raw);
}
