import { dollarsToCents } from "./money";
import { createId } from "./ids";
import { isoNow, isValidYmd, monthKeyFromDate, todayYmd } from "./dates";
import { createEmptyState, stamp } from "./defaults";
import type {
  AppState,
  Bill,
  Category,
  Frequency,
  IncomeSource,
  Transaction,
} from "./types";
import { APP_VERSION, FREQUENCIES } from "./types";

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v);
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapFrequency(raw: unknown): Frequency {
  const v = String(raw || "monthly").toLowerCase();
  if (v === "yearly" || v === "annual" || v === "annually") return "annually";
  if (v === "bi-weekly" || v === "biweekly") return "biweekly";
  if (v === "one-time" || v === "onetime" || v === "once") return "once";
  if (FREQUENCIES.includes(v as Frequency)) return v as Frequency;
  return "monthly";
}

function uniqueId(prefix: string, existing: Set<string>, suggested?: unknown): string {
  const s = suggested != null ? String(suggested) : "";
  if (s && !existing.has(s)) {
    existing.add(s);
    return s;
  }
  let id = createId(prefix);
  while (existing.has(id)) id = createId(prefix);
  existing.add(id);
  return id;
}

function ymdOrToday(v: unknown): string {
  const s = str(v);
  return isValidYmd(s) ? s : todayYmd();
}

function ymdOrEmpty(v: unknown): string | null {
  const s = str(v);
  return isValidYmd(s) ? s : null;
}

interface LegacyPayload {
  buckets?: unknown[];
  recurringIncome?: unknown[];
  income?: unknown[];
  recurringBills?: unknown[];
  bills?: unknown[];
  transactions?: unknown[];
  selectedYear?: unknown;
  selectedMonth?: unknown;
}

export function isLegacyPayload(raw: unknown): boolean {
  const o = asRecord(raw);
  return (
    Array.isArray(o.buckets) &&
    (Array.isArray(o.recurringIncome) || Array.isArray(o.income) || Array.isArray(o.recurringBills) || Array.isArray(o.bills)) &&
    !Array.isArray(o.incomeSources)
  );
}

export function migrateLegacyPayload(raw: unknown): AppState {
  const o = asRecord(raw) as LegacyPayload;
  const state = createEmptyState();
  const ids = new Set<string>();
  const now = isoNow();

  const year = num(o.selectedYear, new Date().getFullYear());
  const month = num(o.selectedMonth, new Date().getMonth());
  if (year >= 2000 && month >= 0 && month <= 11) {
    state.currentMonth = monthKeyFromDate(new Date(year, month, 1));
  }

  const catByLegacyId = new Map<string, string>();
  const buckets = asArray<Record<string, unknown>>(o.buckets);
  if (buckets.length) {
    state.categories = buckets.map((b, index) => {
      const id = uniqueId("cat", ids, b.id);
      catByLegacyId.set(String(b.id ?? ""), id);
      const period = str(b.period) === "weekly" ? "weekly" : "monthly";
      return {
        id,
        name: str(b.name, "Category"),
        icon: period === "weekly" ? "📅" : "📦",
        color: "#1f6f5b",
        defaultBudgetCents: dollarsToCents(b.budgeted),
        rollover: false,
        recurring: true,
        sortOrder: index,
        kind: "expense" as const,
        createdAt: now,
        updatedAt: now,
      };
    });
    state.budgetMonths[state.currentMonth] = state.categories.map((c) => ({
      categoryId: c.id,
      budgetedCents: c.defaultBudgetCents,
      rolloverInCents: 0,
    }));
  }

  const incomes = asArray<Record<string, unknown>>(o.recurringIncome?.length ? o.recurringIncome : o.income);
  state.incomeSources = incomes.map((i) => ({
    id: uniqueId("inc", ids, i.id),
    name: str(i.name, "Income"),
    amountCents: dollarsToCents(i.amount),
    frequency: mapFrequency(i.frequency),
    nextDate: ymdOrToday(i.nextDate),
    startDate: ymdOrToday(i.nextDate || i.startDate),
    endDate: ymdOrEmpty(i.endDate),
    active: true,
    notes: "",
    accountId: state.accounts[0]?.id ?? null,
    ...stamp(),
  }));

  const bills = asArray<Record<string, unknown>>(o.recurringBills?.length ? o.recurringBills : o.bills);
  state.bills = bills.map((b) => {
    const freq = mapFrequency(b.frequency);
    let due = str(b.nextDate);
    if (!isValidYmd(due)) {
      const day = Math.max(1, Math.min(28, num(b.dueDay, 1)));
      const monthNum = freq === "annually" ? Math.max(1, Math.min(12, num(b.dueMonth, 1))) : new Date().getMonth() + 1;
      const yearNum = new Date().getFullYear();
      due = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (!isValidYmd(due)) due = todayYmd();
    }
    return {
      id: uniqueId("bill", ids, b.id),
      name: str(b.name, "Bill"),
      expectedCents: dollarsToCents(b.amount),
      dueDate: due,
      frequency: freq,
      categoryId: null,
      autopay: false,
      active: true,
      notes: "",
      accountId: state.accounts[0]?.id ?? null,
      debtId: null,
      paymentMethod: "",
      ...stamp(),
    } satisfies Bill;
  });

  const txs = asArray<Record<string, unknown>>(o.transactions);
  state.transactions = txs.map((t) => {
    const legacyBucket = String(t.bucketId ?? "");
    const categoryId = catByLegacyId.get(legacyBucket) ?? null;
    return {
      id: uniqueId("tx", ids, t.id),
      date: ymdOrToday(t.date),
      description: str(t.description, "Transaction"),
      amountCents: dollarsToCents(t.amount),
      type: "expense",
      categoryId,
      accountId: state.accounts[0]?.id ?? null,
      toAccountId: null,
      notes: "",
      billId: null,
      debtId: null,
      bucketId: null,
      toBucketId: null,
      savingsGoalId: null,
      incomeSourceId: null,
      expenseId: null,
      occurrenceKey: null,
      extraPrincipalCents: 0,
      interestCents: 0,
      principalCents: 0,
      ...stamp(),
    } satisfies Transaction;
  });

  if (state.incomeSources.length) {
    state.settings.paycheckIncomeId = state.incomeSources[0].id;
  }

  state.version = APP_VERSION;
  return sanitizeState(state);
}

export function sanitizeState(raw: AppState | Record<string, unknown>): AppState {
  const base = createEmptyState();
  const o = asRecord(raw);
  const ids = new Set<string>();

  const settingsIn = asRecord(o.settings);
  const notifications = asRecord(settingsIn.notifications);
  base.settings = {
    ...base.settings,
    currency: str(settingsIn.currency, "USD") || "USD",
    locale: str(settingsIn.locale, "en-US") || "en-US",
    firstDayOfWeek: Math.max(0, Math.min(6, num(settingsIn.firstDayOfWeek, 1))),
    firstDayOfMonth: Math.max(1, Math.min(28, num(settingsIn.firstDayOfMonth, 1))),
    dateFormat: settingsIn.dateFormat === "short" ? "short" : "medium",
    theme: settingsIn.theme === "dark" || settingsIn.theme === "light" ? settingsIn.theme : "system",
    defaultRollover: bool(settingsIn.defaultRollover, false),
    paycheckIncomeId: settingsIn.paycheckIncomeId ? str(settingsIn.paycheckIncomeId) : null,
    lastBackupAt: settingsIn.lastBackupAt ? str(settingsIn.lastBackupAt) : null,
    notifications: {
      upcomingBills: bool(notifications.upcomingBills, false),
      overdueBills: bool(notifications.overdueBills, false),
      paydays: bool(notifications.paydays, false),
    },
  };

  const takeId = (prefix: string, value: unknown) => uniqueId(prefix, ids, value);

  base.accounts = asArray<Record<string, unknown>>(o.accounts).map((a) => ({
    id: takeId("acct", a.id),
    name: str(a.name, "Account"),
    type: (["checking", "savings", "credit", "cash", "other"].includes(str(a.type)) ? str(a.type) : "checking") as AppState["accounts"][number]["type"],
    startingBalanceCents: Math.round(num(a.startingBalanceCents, 0)),
    createdAt: str(a.createdAt, isoNow()),
    updatedAt: str(a.updatedAt, isoNow()),
  })) as AppState["accounts"];
  if (!base.accounts.length) base.accounts = createEmptyState().accounts;

  base.categories = asArray<Record<string, unknown>>(o.categories).map((c, i) => ({
    id: takeId("cat", c.id),
    name: str(c.name, "Category"),
    icon: str(c.icon, "📦"),
    color: str(c.color, "#1f6f5b"),
    defaultBudgetCents: Math.round(num(c.defaultBudgetCents, 0)),
    rollover: bool(c.rollover, false),
    recurring: bool(c.recurring, true),
    sortOrder: num(c.sortOrder, i),
    kind: (["expense", "income", "savings", "debt"].includes(str(c.kind)) ? str(c.kind) : "expense") as Category["kind"],
    createdAt: str(c.createdAt, isoNow()),
    updatedAt: str(c.updatedAt, isoNow()),
  }));
  if (!base.categories.length) base.categories = createEmptyState().categories;

  base.buckets = asArray<Record<string, unknown>>(o.buckets).map((b) => ({
    id: takeId("bkt", b.id),
    name: str(b.name, "Bucket"),
    goalCents: Math.round(num(b.goalCents, 0)),
    balanceCents: Math.round(num(b.balanceCents, 0)),
    contributionCents: Math.round(num(b.contributionCents, 0)),
    frequency: mapFrequency(b.frequency),
    nextDate: ymdOrEmpty(b.nextDate),
    targetDate: ymdOrEmpty(b.targetDate),
    notes: str(b.notes),
    color: str(b.color, "#1f6f5b"),
    icon: str(b.icon, "🪣"),
    accountId: b.accountId ? str(b.accountId) : null,
    createdAt: str(b.createdAt, isoNow()),
    updatedAt: str(b.updatedAt, isoNow()),
  }));

  base.incomeSources = asArray<Record<string, unknown>>(o.incomeSources).map((i) => ({
    id: takeId("inc", i.id),
    name: str(i.name, "Income"),
    amountCents: Math.round(num(i.amountCents, 0)),
    frequency: mapFrequency(i.frequency),
    nextDate: ymdOrToday(i.nextDate),
    startDate: ymdOrToday(i.startDate || i.nextDate),
    endDate: ymdOrEmpty(i.endDate),
    active: bool(i.active, true),
    notes: str(i.notes),
    accountId: i.accountId ? str(i.accountId) : null,
    createdAt: str(i.createdAt, isoNow()),
    updatedAt: str(i.updatedAt, isoNow()),
  })) as IncomeSource[];

  base.bills = asArray<Record<string, unknown>>(o.bills).map((b) => ({
    id: takeId("bill", b.id),
    name: str(b.name, "Bill"),
    expectedCents: Math.round(num(b.expectedCents, 0)),
    dueDate: ymdOrToday(b.dueDate),
    frequency: mapFrequency(b.frequency),
    categoryId: b.categoryId ? str(b.categoryId) : null,
    autopay: bool(b.autopay, false),
    active: bool(b.active, true),
    notes: str(b.notes),
    accountId: b.accountId ? str(b.accountId) : null,
    debtId: b.debtId ? str(b.debtId) : null,
    paymentMethod: str(b.paymentMethod),
    createdAt: str(b.createdAt, isoNow()),
    updatedAt: str(b.updatedAt, isoNow()),
  })) as Bill[];

  base.expenses = asArray<Record<string, unknown>>(o.expenses).map((e) => ({
    id: takeId("exp", e.id),
    name: str(e.name, "Expense"),
    amountCents: Math.round(num(e.amountCents, 0)),
    categoryId: e.categoryId ? str(e.categoryId) : null,
    frequency: mapFrequency(e.frequency),
    nextDate: ymdOrToday(e.nextDate),
    startDate: ymdOrToday(e.startDate || e.nextDate),
    endDate: ymdOrEmpty(e.endDate),
    active: bool(e.active, true),
    notes: str(e.notes),
    createdAt: str(e.createdAt, isoNow()),
    updatedAt: str(e.updatedAt, isoNow()),
  }));

  base.debts = asArray<Record<string, unknown>>(o.debts).map((d) => ({
    id: takeId("debt", d.id),
    name: str(d.name, "Debt"),
    type: (["mortgage", "refinance", "auto", "credit", "personal", "student", "other"].includes(str(d.type))
      ? str(d.type)
      : "other") as AppState["debts"][number]["type"],
    originalBalanceCents: Math.round(num(d.originalBalanceCents, 0)),
    currentBalanceCents: Math.round(num(d.currentBalanceCents, 0)),
    originalLoanCents: Math.round(num(d.originalLoanCents, num(d.originalBalanceCents, 0))),
    aprBps: Math.round(num(d.aprBps, 0)),
    minimumPaymentCents: Math.round(num(d.minimumPaymentCents, 0)),
    plannedPaymentCents: Math.round(num(d.plannedPaymentCents, num(d.minimumPaymentCents, 0))),
    extraPaymentCents: Math.round(num(d.extraPaymentCents, 0)),
    frequency: mapFrequency(d.frequency || "monthly"),
    dueDate: ymdOrToday(d.dueDate),
    creditLimitCents: d.creditLimitCents == null ? null : Math.round(num(d.creditLimitCents, 0)),
    startDate: ymdOrEmpty(d.startDate),
    originalPayoffDate: ymdOrEmpty(d.originalPayoffDate),
    notes: str(d.notes),
    accountId: d.accountId ? str(d.accountId) : null,
    createdAt: str(d.createdAt, isoNow()),
    updatedAt: str(d.updatedAt, isoNow()),
  }));

  base.transactions = asArray<Record<string, unknown>>(o.transactions).map((t) => ({
    id: takeId("tx", t.id),
    date: ymdOrToday(t.date),
    description: str(t.description, "Transaction"),
    amountCents: Math.round(num(t.amountCents, 0)),
    type: (validTxType(str(t.type)) ? str(t.type) : "expense") as Transaction["type"],
    categoryId: t.categoryId ? str(t.categoryId) : null,
    accountId: t.accountId ? str(t.accountId) : null,
    toAccountId: t.toAccountId ? str(t.toAccountId) : null,
    notes: str(t.notes),
    billId: t.billId ? str(t.billId) : null,
    debtId: t.debtId ? str(t.debtId) : null,
    bucketId: t.bucketId ? str(t.bucketId) : null,
    toBucketId: t.toBucketId ? str(t.toBucketId) : null,
    savingsGoalId: t.savingsGoalId ? str(t.savingsGoalId) : null,
    incomeSourceId: t.incomeSourceId ? str(t.incomeSourceId) : null,
    expenseId: t.expenseId ? str(t.expenseId) : null,
    occurrenceKey: t.occurrenceKey ? str(t.occurrenceKey) : null,
    extraPrincipalCents: Math.round(num(t.extraPrincipalCents, 0)),
    interestCents: Math.round(num(t.interestCents, 0)),
    principalCents: Math.round(num(t.principalCents, 0)),
    createdAt: str(t.createdAt, isoNow()),
    updatedAt: str(t.updatedAt, isoNow()),
  }));

  const occ = asRecord(o.occurrences);
  const occurrences: AppState["occurrences"] = {};
  for (const [key, value] of Object.entries(occ)) {
    const item = asRecord(value);
    occurrences[key] = {
      key,
      status: str(item.status, "upcoming") as AppState["occurrences"][string]["status"],
      actualCents: item.actualCents == null ? null : Math.round(num(item.actualCents, 0)),
      paidAt: item.paidAt ? str(item.paidAt) : null,
      transactionId: item.transactionId ? str(item.transactionId) : null,
      notes: str(item.notes),
    };
  }
  base.occurrences = occurrences;

  base.savingsGoals = asArray<Record<string, unknown>>(o.savingsGoals).map((g) => ({
    id: takeId("sav", g.id),
    name: str(g.name, "Savings goal"),
    targetCents: Math.round(num(g.targetCents, 0)),
    currentCents: Math.round(num(g.currentCents, 0)),
    targetDate: ymdOrEmpty(g.targetDate),
    contributionCents: Math.round(num(g.contributionCents, 0)),
    frequency: mapFrequency(g.frequency || "monthly"),
    nextDate: ymdOrEmpty(g.nextDate),
    notes: str(g.notes),
    accountId: g.accountId ? str(g.accountId) : null,
    bucketId: g.bucketId ? str(g.bucketId) : null,
    createdAt: str(g.createdAt, isoNow()),
    updatedAt: str(g.updatedAt, isoNow()),
  }));

  base.financialGoals = asArray<Record<string, unknown>>(o.financialGoals).map((g) => ({
    id: takeId("goal", g.id),
    name: str(g.name, "Goal"),
    kind: (["save", "payoff", "custom"].includes(str(g.kind)) ? str(g.kind) : "custom") as AppState["financialGoals"][number]["kind"],
    targetCents: Math.round(num(g.targetCents, 0)),
    currentCents: Math.round(num(g.currentCents, 0)),
    targetDate: ymdOrEmpty(g.targetDate),
    linkedDebtId: g.linkedDebtId ? str(g.linkedDebtId) : null,
    linkedSavingsId: g.linkedSavingsId ? str(g.linkedSavingsId) : null,
    notes: str(g.notes),
    createdAt: str(g.createdAt, isoNow()),
    updatedAt: str(g.updatedAt, isoNow()),
  }));

  const budgetMonths: AppState["budgetMonths"] = {};
  const bm = asRecord(o.budgetMonths);
  for (const [month, rows] of Object.entries(bm)) {
    budgetMonths[month] = asArray<Record<string, unknown>>(rows).map((r) => ({
      categoryId: str(r.categoryId),
      budgetedCents: Math.round(num(r.budgetedCents, 0)),
      rolloverInCents: Math.round(num(r.rolloverInCents, 0)),
    }));
  }
  base.budgetMonths = budgetMonths;

  base.archives = asArray<Record<string, unknown>>(o.archives).map((a) => ({
    monthKey: str(a.monthKey),
    archivedAt: str(a.archivedAt, isoNow()),
    readOnly: bool(a.readOnly, true),
    summary: (asRecord(a.summary) as unknown as AppState["archives"][number]["summary"]) || emptyArchiveSummary(),
  }));

  base.paycheckPlans = asArray<Record<string, unknown>>(o.paycheckPlans).map((p) => ({
    id: takeId("pay", p.id),
    incomeSourceId: str(p.incomeSourceId),
    occurrenceDate: ymdOrToday(p.occurrenceDate),
    assignments: asArray<Record<string, unknown>>(p.assignments).map((asg) => ({
      id: takeId("asg", asg.id),
      kind: str(asg.kind, "bill") as AppState["paycheckPlans"][number]["assignments"][number]["kind"],
      targetId: str(asg.targetId),
      amountCents: Math.round(num(asg.amountCents, 0)),
      label: str(asg.label),
    })),
  }));

  base.netWorthSnapshots = asArray<Record<string, unknown>>(o.netWorthSnapshots).map((s) => ({
    date: ymdOrToday(s.date),
    monthKey: str(s.monthKey, monthKeyFromDate(new Date())),
    assetsCents: Math.round(num(s.assetsCents, 0)),
    liabilitiesCents: Math.round(num(s.liabilitiesCents, 0)),
    netCents: Math.round(num(s.netCents, 0)),
  }));

  const cm = str(o.currentMonth);
  base.currentMonth = /^\d{4}-\d{2}$/.test(cm) ? cm : monthKeyFromDate(new Date());
  base.version = APP_VERSION;
  return base;
}

function validTxType(t: string): boolean {
  return [
    "income",
    "expense",
    "bill_payment",
    "debt_payment",
    "extra_debt_payment",
    "principal_debt_payment",
    "savings_contribution",
    "savings_withdrawal",
    "bucket_contribution",
    "bucket_withdrawal",
    "transfer",
  ].includes(t);
}

function emptyArchiveSummary(): AppState["archives"][number]["summary"] {
  return {
    incomeCents: 0,
    expensesCents: 0,
    billsCents: 0,
    savingsCents: 0,
    debtPaymentsCents: 0,
    budgetedCents: 0,
    actualCents: 0,
    endingAccountBalances: [],
    endingDebtBalances: [],
    categoryActuals: [],
  };
}

export function hydrateFromUnknown(raw: unknown): AppState {
  const o = asRecord(raw);
  if (Array.isArray(o.incomeSources) || Array.isArray(o.categories) && Array.isArray(o.bills) && o.version) {
    return sanitizeState(o);
  }
  if (isLegacyPayload(raw)) return migrateLegacyPayload(raw);
  return sanitizeState(o);
}
