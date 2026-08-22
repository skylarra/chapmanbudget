import { monthBounds, addMonthsKey, todayYmd, daysBetween, formatMonthLabel } from "./dates";
import { addCents, type Cents } from "./money";
import { occurrenceKey } from "./ids";
import { listOccurrencesInRange, nextOccurrenceOnOrAfter, countOccurrencesInRange } from "./recurrence";
import { comparePayoffScenarios, projectPayoff, splitPayment, formatPayoffDate } from "./debt";
import type {
  AppState,
  ArchiveSummary,
  Bill,
  Category,
  IncomeSource,
  PaymentStatus,
  Transaction,
  TransactionType,
} from "./types";
import { isDebtPaymentType, isSpendingType } from "./types";

export interface ScheduledItem {
  key: string;
  kind: "income" | "bill" | "expense" | "debt" | "savings" | "bucket";
  sourceId: string;
  name: string;
  date: string;
  amountCents: Cents;
  status: PaymentStatus;
  actualCents: Cents | null;
  autopay?: boolean;
}

export function txsInRange(state: AppState, start: string, end: string): Transaction[] {
  return state.transactions.filter((t) => t.date >= start && t.date <= end);
}

export function sumByType(txs: Transaction[], types: TransactionType[]): Cents {
  return txs.filter((t) => types.includes(t.type)).reduce((s, t) => s + t.amountCents, 0);
}

export function spendingTxs(txs: Transaction[]): Transaction[] {
  return txs.filter((t) => isSpendingType(t.type));
}

export function incomeReceived(txs: Transaction[]): Cents {
  return sumByType(txs, ["income"]);
}

export function expenseTotal(txs: Transaction[]): Cents {
  return sumByType(txs, ["expense"]);
}

export function billPaymentTotal(txs: Transaction[]): Cents {
  return sumByType(txs, ["bill_payment"]);
}

export function savingsNet(txs: Transaction[]): Cents {
  return sumByType(txs, ["savings_contribution", "bucket_contribution"]) -
    sumByType(txs, ["savings_withdrawal", "bucket_withdrawal"]);
}

export function debtPaymentTotal(txs: Transaction[]): Cents {
  return txs.filter((t) => isDebtPaymentType(t.type)).reduce((s, t) => s + t.amountCents, 0);
}

export function allocationsForMonth(state: AppState, monthKey: string) {
  const existing = state.budgetMonths[monthKey];
  if (existing?.length) {
    const map = new Map(existing.map((a) => [a.categoryId, a]));
    return state.categories
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => map.get(c.id) ?? { categoryId: c.id, budgetedCents: c.defaultBudgetCents, rolloverInCents: 0 });
  }
  return state.categories
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({ categoryId: c.id, budgetedCents: c.defaultBudgetCents, rolloverInCents: 0 }));
}

export function spentByCategory(txs: Transaction[]): Record<string, Cents> {
  const out: Record<string, Cents> = {};
  for (const t of spendingTxs(txs)) {
    if (!t.categoryId) continue;
    out[t.categoryId] = (out[t.categoryId] || 0) + t.amountCents;
  }
  return out;
}

export function categoryRows(state: AppState, monthKey: string) {
  const { startYmd, endYmd } = monthBounds(monthKey);
  const txs = txsInRange(state, startYmd, endYmd);
  const spent = spentByCategory(txs);
  const alloc = allocationsForMonth(state, monthKey);
  return alloc.map((a) => {
    const category = state.categories.find((c) => c.id === a.categoryId);
    const budgeted = a.budgetedCents + a.rolloverInCents;
    const actual = spent[a.categoryId] || 0;
    return {
      category: category ?? ({ id: a.categoryId, name: "Unknown", icon: "❓", color: "#888" } as Category),
      budgetedCents: budgeted,
      spentCents: actual,
      remainingCents: budgeted - actual,
      rolloverInCents: a.rolloverInCents,
    };
  });
}

function overlayStatus(
  state: AppState,
  kind: ScheduledItem["kind"],
  sourceId: string,
  date: string,
  today: string,
): { status: PaymentStatus; actualCents: Cents | null; key: string } {
  const key = occurrenceKey(kind, sourceId, date);
  const over = state.occurrences[key];
  if (over?.status === "paid" || over?.status === "skipped" || over?.status === "received") {
    return { status: over.status, actualCents: over.actualCents, key };
  }
  if (state.transactions.some((t) => t.occurrenceKey === key)) {
    const tx = state.transactions.find((t) => t.occurrenceKey === key)!;
    return { status: kind === "income" ? "received" : "paid", actualCents: tx.amountCents, key };
  }
  if (date < today) return { status: kind === "income" ? "late" : "overdue", actualCents: over?.actualCents ?? null, key };
  if (date === today) return { status: "due", actualCents: null, key };
  return { status: kind === "income" ? "expected" : "upcoming", actualCents: null, key };
}

export function billOccurrences(state: AppState, start: string, end: string, today = todayYmd()): ScheduledItem[] {
  const items: ScheduledItem[] = [];
  for (const bill of state.bills.filter((b) => b.active)) {
    for (const date of listOccurrencesInRange(asRecurring(bill), start, end)) {
      const { status, actualCents, key } = overlayStatus(state, "bill", bill.id, date, today);
      items.push({
        key,
        kind: "bill",
        sourceId: bill.id,
        name: bill.name,
        date,
        amountCents: actualCents ?? bill.expectedCents,
        status,
        actualCents,
        autopay: bill.autopay,
      });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export function incomeOccurrences(state: AppState, start: string, end: string, today = todayYmd()): ScheduledItem[] {
  const items: ScheduledItem[] = [];
  for (const src of state.incomeSources.filter((i) => i.active)) {
    for (const date of listOccurrencesInRange(src, start, end)) {
      const { status, actualCents, key } = overlayStatus(state, "income", src.id, date, today);
      items.push({
        key,
        kind: "income",
        sourceId: src.id,
        name: src.name,
        date,
        amountCents: actualCents ?? src.amountCents,
        status,
        actualCents,
      });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

export function expenseOccurrences(state: AppState, start: string, end: string, today = todayYmd()): ScheduledItem[] {
  const items: ScheduledItem[] = [];
  for (const exp of state.expenses.filter((e) => e.active)) {
    for (const date of listOccurrencesInRange(exp, start, end)) {
      const { status, actualCents, key } = overlayStatus(state, "expense", exp.id, date, today);
      items.push({
        key,
        kind: "expense",
        sourceId: exp.id,
        name: exp.name,
        date,
        amountCents: actualCents ?? exp.amountCents,
        status,
        actualCents,
      });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

function asRecurring(bill: Bill) {
  return { frequency: bill.frequency, nextDate: bill.dueDate, startDate: bill.dueDate, endDate: null, active: bill.active };
}

export function accountBalance(state: AppState, accountId: string): Cents {
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) return 0;
  let bal = account.startingBalanceCents;
  for (const t of state.transactions) {
    if (t.accountId === accountId) {
      if (t.type === "income" || t.type === "savings_withdrawal" || t.type === "bucket_withdrawal") {
        bal += t.amountCents;
      } else if (t.type === "transfer") {
        bal -= t.amountCents;
      } else {
        bal -= t.amountCents;
      }
    }
    if (t.toAccountId === accountId && (t.type === "transfer" || t.type === "savings_contribution" || t.type === "bucket_contribution")) {
      bal += t.amountCents;
    }
  }
  return bal;
}

export function allAccountBalances(state: AppState) {
  return state.accounts.map((a) => ({ ...a, balanceCents: accountBalance(state, a.id) }));
}

export function availableMoney(state: AppState): Cents {
  return allAccountBalances(state)
    .filter((a) => a.type === "checking" || a.type === "cash")
    .reduce((s, a) => s + a.balanceCents, 0);
}

export function savingsBalance(state: AppState): Cents {
  const accountSavings = allAccountBalances(state)
    .filter((a) => a.type === "savings")
    .reduce((s, a) => s + a.balanceCents, 0);
  const goals = state.savingsGoals.reduce((s, g) => s + g.currentCents, 0);
  const buckets = state.buckets.reduce((s, b) => s + b.balanceCents, 0);
  return Math.max(accountSavings, goals + buckets);
}

export function totalDebt(state: AppState): Cents {
  return state.debts.reduce((s, d) => s + Math.max(0, d.currentBalanceCents), 0);
}

export function assetsTotal(state: AppState): Cents {
  return allAccountBalances(state)
    .filter((a) => a.type !== "credit")
    .reduce((s, a) => s + Math.max(0, a.balanceCents), 0) +
    state.buckets.reduce((s, b) => s + Math.max(0, b.balanceCents), 0);
}

export function netWorth(state: AppState): { assets: Cents; liabilities: Cents; net: Cents } {
  const assets = assetsTotal(state);
  const liabilities = totalDebt(state);
  return { assets, liabilities, net: assets - liabilities };
}

export interface MonthSnapshot {
  monthKey: string;
  incomeExpectedCents: Cents;
  incomeReceivedCents: Cents;
  billsDueCents: Cents;
  billsPaidCents: Cents;
  expensesCents: Cents;
  savingsCents: Cents;
  debtPaymentsCents: Cents;
  budgetedCents: Cents;
  remainingToBudgetCents: Cents;
  unallocatedCents: Cents;
  bucketAllocatedCents: Cents;
  availableCents: Cents;
}

export function monthSnapshot(state: AppState, monthKey: string, today = todayYmd()): MonthSnapshot {
  const { startYmd, endYmd } = monthBounds(monthKey);
  const txs = txsInRange(state, startYmd, endYmd);
  const incomes = incomeOccurrences(state, startYmd, endYmd, today);
  const bills = billOccurrences(state, startYmd, endYmd, today);
  const cats = categoryRows(state, monthKey);
  const incomeReceivedCents = incomeReceived(txs);
  const incomeExpectedCents = incomes.reduce((s, i) => s + i.amountCents, 0);
  const billsDueCents = bills.reduce((s, b) => s + b.amountCents, 0);
  const billsPaidCents = bills.filter((b) => b.status === "paid").reduce((s, b) => s + b.amountCents, 0);
  const expensesCents = expenseTotal(txs);
  const savingsCents = savingsNet(txs);
  const debtPaymentsCents = debtPaymentTotal(txs);
  const budgetedCents = cats.reduce((s, c) => s + c.budgetedCents, 0);
  const bucketAllocatedCents = state.buckets.reduce((s, b) => s + b.balanceCents, 0);
  const availableCents = availableMoney(state);
  return {
    monthKey,
    incomeExpectedCents,
    incomeReceivedCents,
    billsDueCents,
    billsPaidCents,
    expensesCents,
    savingsCents,
    debtPaymentsCents,
    budgetedCents,
    remainingToBudgetCents: incomeReceivedCents - budgetedCents,
    unallocatedCents: availableCents - bucketAllocatedCents,
    bucketAllocatedCents,
    availableCents,
  };
}

export function expectedRemainingIncome(state: AppState, monthKey: string, today = todayYmd()): Cents {
  const { startYmd, endYmd } = monthBounds(monthKey);
  return incomeOccurrences(state, startYmd, endYmd, today)
    .filter((i) => i.status === "expected" || i.status === "upcoming" || i.status === "due" || i.status === "late")
    .reduce((s, i) => s + i.amountCents, 0);
}

export function overdueItems(state: AppState, today = todayYmd()): ScheduledItem[] {
  const start = addMonthsKey(state.currentMonth, -6) + "-01";
  const bills = billOccurrences(state, start, today, today).filter((b) => b.status === "overdue");
  const incomes = incomeOccurrences(state, start, today, today).filter((i) => i.status === "late");
  const expenses = expenseOccurrences(state, start, today, today).filter((e) => e.status === "overdue");
  return [...bills, ...incomes, ...expenses].sort((a, b) => a.date.localeCompare(b.date));
}

export function upcomingWithinDays(state: AppState, days: number, today = todayYmd()): ScheduledItem[] {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);
  const end = endDate.toISOString().slice(0, 10);
  const bills = billOccurrences(state, today, end, today).filter((b) => b.status === "upcoming" || b.status === "due");
  return bills;
}

export function nextPaycheck(state: AppState, today = todayYmd()): ScheduledItem | null {
  const far = addMonthsKey(state.currentMonth, 6) + "-28";
  const items = incomeOccurrences(state, today, far, today).filter(
    (i) => i.status === "expected" || i.status === "upcoming" || i.status === "due",
  );
  return items[0] ?? null;
}

export function nextBill(state: AppState, today = todayYmd()): ScheduledItem | null {
  const far = addMonthsKey(state.currentMonth, 6) + "-28";
  const items = billOccurrences(state, today, far, today).filter((b) => b.status !== "paid" && b.status !== "skipped");
  return items[0] ?? null;
}

export function mainIncomeSource(state: AppState): IncomeSource | null {
  if (state.settings.paycheckIncomeId) {
    const found = state.incomeSources.find((i) => i.id === state.settings.paycheckIncomeId && i.active);
    if (found) return found;
  }
  const active = state.incomeSources.filter((i) => i.active && i.frequency !== "once");
  if (!active.length) return state.incomeSources.find((i) => i.active) ?? null;
  const { startYmd, endYmd } = monthBounds(state.currentMonth);
  return active.slice().sort((a, b) => {
    const av = a.amountCents * Math.max(1, countOccurrencesInRange(a, startYmd, endYmd));
    const bv = b.amountCents * Math.max(1, countOccurrencesInRange(b, startYmd, endYmd));
    return bv - av;
  })[0];
}

export function paycheckOccurrences(state: AppState, start: string, end: string) {
  const main = mainIncomeSource(state);
  if (!main) return [];
  return listOccurrencesInRange(main, start, end).map((date) => ({
    source: main,
    date,
    amountCents: main.amountCents,
  }));
}

export interface DebtView {
  debt: AppState["debts"][number];
  utilization: number | null;
  availableCreditCents: Cents | null;
  currentPayoff: ReturnType<typeof projectPayoff>;
  extraPayoff: ReturnType<typeof projectPayoff>;
  compare: ReturnType<typeof comparePayoffScenarios>;
  originalPayoffLabel: string;
  projectedPayoffLabel: string;
}

export function debtViews(state: AppState, today = todayYmd()): DebtView[] {
  return state.debts.map((debt) => {
    const utilization =
      debt.type === "credit" && debt.creditLimitCents && debt.creditLimitCents > 0
        ? (debt.currentBalanceCents / debt.creditLimitCents) * 100
        : null;
    const availableCreditCents =
      debt.type === "credit" && debt.creditLimitCents != null
        ? Math.max(0, debt.creditLimitCents - debt.currentBalanceCents)
        : null;
    const base = {
      balanceCents: debt.currentBalanceCents,
      aprBps: debt.aprBps,
      paymentCents: debt.plannedPaymentCents || debt.minimumPaymentCents,
      frequency: debt.frequency,
      startDate: nextOccurrenceOnOrAfter({ frequency: debt.frequency, nextDate: debt.dueDate, active: true }, today) || today,
    };
    const currentPayoff = projectPayoff({ ...base, extraCents: 0 });
    const extraPayoff = projectPayoff({ ...base, extraCents: debt.extraPaymentCents });
    const compare = comparePayoffScenarios(base, debt.extraPaymentCents);
    return {
      debt,
      utilization,
      availableCreditCents,
      currentPayoff,
      extraPayoff,
      compare,
      originalPayoffLabel: debt.originalPayoffDate ? formatPayoffDate(debt.originalPayoffDate) : "—",
      projectedPayoffLabel: formatPayoffDate(extraPayoff.payoffDate || currentPayoff.payoffDate),
    };
  });
}

export function debtFreeProjection(state: AppState, today = todayYmd()) {
  const views = debtViews(state, today);
  const dates = views.map((v) => v.extraPayoff.payoffDate || v.currentPayoff.payoffDate).filter(Boolean) as string[];
  const latest = dates.sort().at(-1) ?? null;
  const original = state.debts.reduce((s, d) => s + Math.max(d.originalBalanceCents, d.originalLoanCents, d.currentBalanceCents), 0);
  const current = totalDebt(state);
  const progress = original > 0 ? Math.min(100, ((original - current) / original) * 100) : 0;
  return { latest, progress, original, current, views };
}

export function monthDebtReduction(state: AppState, monthKey: string): { principal: Cents; interest: Cents; extra: Cents; total: Cents } {
  const { startYmd, endYmd } = monthBounds(monthKey);
  const txs = txsInRange(state, startYmd, endYmd).filter((t) => isDebtPaymentType(t.type));
  return {
    principal: txs.reduce((s, t) => s + (t.principalCents || 0), 0),
    interest: txs.reduce((s, t) => s + (t.interestCents || 0), 0),
    extra: txs.reduce((s, t) => s + (t.extraPrincipalCents || 0), 0),
    total: txs.reduce((s, t) => s + t.amountCents, 0),
  };
}

export function buildArchiveSummary(state: AppState, monthKey: string): ArchiveSummary {
  const snap = monthSnapshot(state, monthKey);
  const cats = categoryRows(state, monthKey);
  return {
    incomeCents: snap.incomeReceivedCents,
    expensesCents: snap.expensesCents,
    billsCents: snap.billsPaidCents,
    savingsCents: snap.savingsCents,
    debtPaymentsCents: snap.debtPaymentsCents,
    budgetedCents: snap.budgetedCents,
    actualCents: snap.expensesCents + snap.billsPaidCents,
    endingAccountBalances: allAccountBalances(state).map((a) => ({
      accountId: a.id,
      name: a.name,
      balanceCents: a.balanceCents,
    })),
    endingDebtBalances: state.debts.map((d) => ({
      debtId: d.id,
      name: d.name,
      balanceCents: d.currentBalanceCents,
    })),
    categoryActuals: cats.map((c) => ({
      categoryId: c.category.id,
      name: c.category.name,
      budgetedCents: c.budgetedCents,
      spentCents: c.spentCents,
    })),
  };
}

export function historySeries(state: AppState, months: number) {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i -= 1) keys.push(addMonthsKey(state.currentMonth, -i));
  return keys.map((monthKey) => {
    const archive = state.archives.find((a) => a.monthKey === monthKey);
    if (archive) {
      return {
        monthKey,
        label: formatMonthLabel(monthKey),
        income: archive.summary.incomeCents,
        expenses: archive.summary.expensesCents + archive.summary.billsCents,
        savings: archive.summary.savingsCents,
        debt: archive.summary.debtPaymentsCents,
        net: archive.summary.incomeCents - archive.summary.expensesCents - archive.summary.billsCents,
      };
    }
    const snap = monthSnapshot(state, monthKey);
    return {
      monthKey,
      label: formatMonthLabel(monthKey),
      income: snap.incomeReceivedCents,
      expenses: snap.expensesCents + snap.billsPaidCents,
      savings: snap.savingsCents,
      debt: snap.debtPaymentsCents,
      net: snap.incomeReceivedCents - snap.expensesCents - snap.billsPaidCents,
    };
  });
}

export function compareMonths(state: AppState, aKey: string, bKey: string) {
  const a = monthSnapshot(state, aKey);
  const b = monthSnapshot(state, bKey);
  const aCats = categoryRows(state, aKey);
  const bCats = categoryRows(state, bKey);
  const names = new Map<string, string>();
  for (const row of [...aCats, ...bCats]) names.set(row.category.id, row.category.name);
  const catIds = new Set([...aCats.map((c) => c.category.id), ...bCats.map((c) => c.category.id)]);
  const categories = [...catIds].map((id) => {
    const av = aCats.find((c) => c.category.id === id)?.spentCents || 0;
    const bv = bCats.find((c) => c.category.id === id)?.spentCents || 0;
    return { id, name: names.get(id) || "Category", a: av, b: bv, diff: bv - av };
  });
  return {
    a,
    b,
    incomeDiff: b.incomeReceivedCents - a.incomeReceivedCents,
    expenseDiff: b.expensesCents - a.expensesCents,
    savingsDiff: b.savingsCents - a.savingsCents,
    debtDiff: b.debtPaymentsCents - a.debtPaymentsCents,
    categories,
  };
}

export function suggestedContribution(target: Cents, current: Cents, targetDate: string | null, today = todayYmd()): Cents {
  const remaining = Math.max(0, target - current);
  if (!targetDate || targetDate <= today) return remaining;
  const days = Math.max(1, daysBetween(today, targetDate));
  const months = Math.max(1, Math.round(days / 30.44));
  return Math.ceil(remaining / months);
}

export function estimateDebtSplit(state: AppState, debtId: string, amountCents: Cents, extraCents: Cents, principalOnly: boolean) {
  const debt = state.debts.find((d) => d.id === debtId);
  if (!debt) return { interestCents: 0, principalCents: amountCents, extraPrincipalCents: extraCents, newBalanceCents: 0 };
  return splitPayment(debt.currentBalanceCents, amountCents, extraCents, debt.aprBps, debt.frequency, principalOnly);
}

export function globalSearch(state: AppState, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [] as { kind: string; id: string; title: string; subtitle: string }[];
  const out: { kind: string; id: string; title: string; subtitle: string }[] = [];
  const push = (kind: string, id: string, title: string, subtitle: string) => {
    if (title.toLowerCase().includes(q) || subtitle.toLowerCase().includes(q)) out.push({ kind, id, title, subtitle });
  };
  for (const t of state.transactions) push("transaction", t.id, t.description, t.date);
  for (const b of state.bills) push("bill", b.id, b.name, b.notes);
  for (const e of state.expenses) push("expense", e.id, e.name, e.notes);
  for (const i of state.incomeSources) push("income", i.id, i.name, i.notes);
  for (const d of state.debts) push("debt", d.id, d.name, d.notes);
  for (const g of state.savingsGoals) push("savings", g.id, g.name, g.notes);
  for (const b of state.buckets) push("bucket", b.id, b.name, b.notes);
  return out.slice(0, 30);
}

export function isMonthLocked(state: AppState, monthKey: string): boolean {
  return state.archives.some((a) => a.monthKey === monthKey && a.readOnly);
}

export { addCents };
