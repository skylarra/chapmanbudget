import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from "react";
import { createId, occurrenceKey } from "./lib/ids";
import { isoNow, todayYmd, addMonthsKey, monthBounds } from "./lib/dates";
import { parseDollarsToCents, type Cents } from "./lib/money";
import { createEmptyState, stamp, touch } from "./lib/defaults";
import { persistState, loadState, writeEmergencyBackup } from "./lib/storage";
import { mergeStates } from "./lib/importExport";
import {
  buildArchiveSummary,
  estimateDebtSplit,
  isMonthLocked,
  netWorth,
  allocationsForMonth,
} from "./lib/calculations";
import type {
  Account,
  AppState,
  Bill,
  Bucket,
  Category,
  Debt,
  FinancialGoal,
  IncomeSource,
  PaycheckPlan,
  RecurringExpense,
  SavingsGoal,
  Settings,
  Transaction,
  TransactionType,
} from "./lib/types";

type Action =
  | { type: "hydrate"; state: AppState }
  | { type: "replace"; state: AppState }
  | { type: "merge"; state: AppState }
  | { type: "patch"; patch: Partial<AppState> }
  | { type: "setMonth"; monthKey: string }
  | { type: "updateSettings"; patch: Partial<Settings> }
  | { type: "setCategories"; categories: Category[] }
  | { type: "upsertCategory"; category: Category }
  | { type: "deleteCategory"; id: string }
  | { type: "setBudget"; monthKey: string; categoryId: string; budgetedCents: Cents }
  | { type: "reorderCategories"; ids: string[] }
  | { type: "upsertAccount"; account: Account }
  | { type: "deleteAccount"; id: string }
  | { type: "upsertBucket"; bucket: Bucket }
  | { type: "deleteBucket"; id: string }
  | { type: "upsertIncome"; source: IncomeSource }
  | { type: "deleteIncome"; id: string }
  | { type: "upsertBill"; bill: Bill }
  | { type: "deleteBill"; id: string }
  | { type: "upsertExpense"; expense: RecurringExpense }
  | { type: "deleteExpense"; id: string }
  | { type: "upsertDebt"; debt: Debt }
  | { type: "deleteDebt"; id: string }
  | { type: "upsertSavings"; goal: SavingsGoal }
  | { type: "deleteSavings"; id: string }
  | { type: "upsertGoal"; goal: FinancialGoal }
  | { type: "deleteGoal"; id: string }
  | { type: "addTransaction"; tx: Transaction; sideEffects?: SideEffects }
  | { type: "updateTransaction"; tx: Transaction }
  | { type: "deleteTransaction"; id: string }
  | { type: "bulkDeleteTransactions"; ids: string[] }
  | { type: "setOccurrence"; key: string; status: AppState["occurrences"][string]["status"]; actualCents: Cents | null; transactionId: string | null }
  | { type: "setPaycheckPlan"; plan: PaycheckPlan }
  | { type: "archiveMonth"; monthKey: string }
  | { type: "unlockArchive"; monthKey: string }
  | { type: "markBackup"; at: string }
  | { type: "resetAll" };

interface SideEffects {
  debtBalanceDelta?: { debtId: string; newBalance: Cents };
  bucketDelta?: { bucketId: string; delta: Cents };
  savingsDelta?: { goalId: string; delta: Cents };
  toBucketDelta?: { bucketId: string; delta: Cents };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
    case "replace":
      return action.state;
    case "merge":
      return mergeStates(state, action.state);
    case "patch":
      return { ...state, ...action.patch };
    case "setMonth":
      return { ...state, currentMonth: action.monthKey };
    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case "setCategories":
      return { ...state, categories: action.categories };
    case "upsertCategory": {
      const exists = state.categories.some((c) => c.id === action.category.id);
      return {
        ...state,
        categories: exists
          ? state.categories.map((c) => (c.id === action.category.id ? action.category : c))
          : [...state.categories, action.category],
      };
    }
    case "deleteCategory":
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.id),
      };
    case "setBudget": {
      const rows = allocationsForMonth(state, action.monthKey).map((r) =>
        r.categoryId === action.categoryId ? { ...r, budgetedCents: action.budgetedCents } : r,
      );
      return { ...state, budgetMonths: { ...state.budgetMonths, [action.monthKey]: rows } };
    }
    case "reorderCategories":
      return {
        ...state,
        categories: action.ids
          .map((id, i) => {
            const c = state.categories.find((x) => x.id === id);
            return c ? { ...c, sortOrder: i, updatedAt: isoNow() } : null;
          })
          .filter((c): c is Category => Boolean(c)),
      };
    case "upsertAccount": {
      const exists = state.accounts.some((a) => a.id === action.account.id);
      return {
        ...state,
        accounts: exists
          ? state.accounts.map((a) => (a.id === action.account.id ? action.account : a))
          : [...state.accounts, action.account],
      };
    }
    case "deleteAccount":
      return { ...state, accounts: state.accounts.filter((a) => a.id !== action.id) };
    case "upsertBucket": {
      const exists = state.buckets.some((b) => b.id === action.bucket.id);
      return {
        ...state,
        buckets: exists
          ? state.buckets.map((b) => (b.id === action.bucket.id ? action.bucket : b))
          : [...state.buckets, action.bucket],
      };
    }
    case "deleteBucket":
      return { ...state, buckets: state.buckets.filter((b) => b.id !== action.id) };
    case "upsertIncome": {
      const exists = state.incomeSources.some((i) => i.id === action.source.id);
      return {
        ...state,
        incomeSources: exists
          ? state.incomeSources.map((i) => (i.id === action.source.id ? action.source : i))
          : [...state.incomeSources, action.source],
      };
    }
    case "deleteIncome":
      return { ...state, incomeSources: state.incomeSources.filter((i) => i.id !== action.id) };
    case "upsertBill": {
      const exists = state.bills.some((b) => b.id === action.bill.id);
      return {
        ...state,
        bills: exists ? state.bills.map((b) => (b.id === action.bill.id ? action.bill : b)) : [...state.bills, action.bill],
      };
    }
    case "deleteBill":
      return { ...state, bills: state.bills.filter((b) => b.id !== action.id) };
    case "upsertExpense": {
      const exists = state.expenses.some((e) => e.id === action.expense.id);
      return {
        ...state,
        expenses: exists
          ? state.expenses.map((e) => (e.id === action.expense.id ? action.expense : e))
          : [...state.expenses, action.expense],
      };
    }
    case "deleteExpense":
      return { ...state, expenses: state.expenses.filter((e) => e.id !== action.id) };
    case "upsertDebt": {
      const exists = state.debts.some((d) => d.id === action.debt.id);
      return {
        ...state,
        debts: exists ? state.debts.map((d) => (d.id === action.debt.id ? action.debt : d)) : [...state.debts, action.debt],
      };
    }
    case "deleteDebt":
      return { ...state, debts: state.debts.filter((d) => d.id !== action.id) };
    case "upsertSavings": {
      const exists = state.savingsGoals.some((g) => g.id === action.goal.id);
      return {
        ...state,
        savingsGoals: exists
          ? state.savingsGoals.map((g) => (g.id === action.goal.id ? action.goal : g))
          : [...state.savingsGoals, action.goal],
      };
    }
    case "deleteSavings":
      return { ...state, savingsGoals: state.savingsGoals.filter((g) => g.id !== action.id) };
    case "upsertGoal": {
      const exists = state.financialGoals.some((g) => g.id === action.goal.id);
      return {
        ...state,
        financialGoals: exists
          ? state.financialGoals.map((g) => (g.id === action.goal.id ? action.goal : g))
          : [...state.financialGoals, action.goal],
      };
    }
    case "deleteGoal":
      return { ...state, financialGoals: state.financialGoals.filter((g) => g.id !== action.id) };
    case "addTransaction": {
      if (action.tx.occurrenceKey && state.transactions.some((t) => t.occurrenceKey === action.tx.occurrenceKey)) {
        return state;
      }
      let next: AppState = { ...state, transactions: [...state.transactions, action.tx] };
      const fx = action.sideEffects;
      if (fx?.debtBalanceDelta) {
        next = {
          ...next,
          debts: next.debts.map((d) =>
            d.id === fx.debtBalanceDelta!.debtId ? touch({ ...d, currentBalanceCents: Math.max(0, fx.debtBalanceDelta!.newBalance) }) : d,
          ),
        };
      }
      if (fx?.bucketDelta) {
        next = {
          ...next,
          buckets: next.buckets.map((b) =>
            b.id === fx.bucketDelta!.bucketId ? touch({ ...b, balanceCents: Math.max(0, b.balanceCents + fx.bucketDelta!.delta) }) : b,
          ),
        };
      }
      if (fx?.toBucketDelta) {
        next = {
          ...next,
          buckets: next.buckets.map((b) =>
            b.id === fx.toBucketDelta!.bucketId ? touch({ ...b, balanceCents: Math.max(0, b.balanceCents + fx.toBucketDelta!.delta) }) : b,
          ),
        };
      }
      if (fx?.savingsDelta) {
        next = {
          ...next,
          savingsGoals: next.savingsGoals.map((g) =>
            g.id === fx.savingsDelta!.goalId ? touch({ ...g, currentCents: Math.max(0, g.currentCents + fx.savingsDelta!.delta) }) : g,
          ),
        };
      }
      return next;
    }
    case "updateTransaction":
      return { ...state, transactions: state.transactions.map((t) => (t.id === action.tx.id ? action.tx : t)) };
    case "deleteTransaction":
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.id) };
    case "bulkDeleteTransactions": {
      const ids = new Set(action.ids);
      return { ...state, transactions: state.transactions.filter((t) => !ids.has(t.id)) };
    }
    case "setOccurrence":
      return {
        ...state,
        occurrences: {
          ...state.occurrences,
          [action.key]: {
            key: action.key,
            status: action.status,
            actualCents: action.actualCents,
            paidAt: action.status === "paid" || action.status === "received" ? todayYmd() : null,
            transactionId: action.transactionId,
            notes: state.occurrences[action.key]?.notes ?? "",
          },
        },
      };
    case "setPaycheckPlan": {
      const exists = state.paycheckPlans.some(
        (p) => p.incomeSourceId === action.plan.incomeSourceId && p.occurrenceDate === action.plan.occurrenceDate,
      );
      return {
        ...state,
        paycheckPlans: exists
          ? state.paycheckPlans.map((p) =>
              p.incomeSourceId === action.plan.incomeSourceId && p.occurrenceDate === action.plan.occurrenceDate
                ? action.plan
                : p,
            )
          : [...state.paycheckPlans, action.plan],
      };
    }
    case "archiveMonth": {
      const summary = buildArchiveSummary(state, action.monthKey);
      const archives = state.archives.filter((a) => a.monthKey !== action.monthKey);
      archives.push({ monthKey: action.monthKey, archivedAt: isoNow(), readOnly: true, summary });
      const nextMonth = addMonthsKey(action.monthKey, 1);
      const currentAlloc = allocationsForMonth(state, action.monthKey);
      const spentMap: Record<string, number> = {};
      const { startYmd, endYmd } = monthBounds(action.monthKey);
      for (const t of state.transactions) {
        if (t.date >= startYmd && t.date <= endYmd && (t.type === "expense" || t.type === "bill_payment") && t.categoryId) {
          spentMap[t.categoryId] = (spentMap[t.categoryId] || 0) + t.amountCents;
        }
      }
      const nextAlloc = currentAlloc.map((row) => {
        const cat = state.categories.find((c) => c.id === row.categoryId);
        const rollover = cat?.rollover || state.settings.defaultRollover;
        const remaining = row.budgetedCents + row.rolloverInCents - (spentMap[row.categoryId] || 0);
        return {
          categoryId: row.categoryId,
          budgetedCents: cat?.defaultBudgetCents ?? row.budgetedCents,
          rolloverInCents: rollover ? Math.max(0, remaining) : 0,
        };
      });
      const nw = netWorth(state);
      return {
        ...state,
        archives,
        currentMonth: nextMonth,
        budgetMonths: { ...state.budgetMonths, [nextMonth]: nextAlloc },
        netWorthSnapshots: [
          ...state.netWorthSnapshots.filter((s) => s.monthKey !== action.monthKey),
          {
            date: todayYmd(),
            monthKey: action.monthKey,
            assetsCents: nw.assets,
            liabilitiesCents: nw.liabilities,
            netCents: nw.net,
          },
        ],
      };
    }
    case "unlockArchive":
      return {
        ...state,
        archives: state.archives.map((a) => (a.monthKey === action.monthKey ? { ...a, readOnly: false } : a)),
      };
    case "markBackup":
      return { ...state, settings: { ...state.settings, lastBackupAt: action.at } };
    case "resetAll":
      return createEmptyState();
    default:
      return state;
  }
}

function baseTx(partial: Partial<Transaction> & Pick<Transaction, "description" | "amountCents" | "type">): Transaction {
  return {
    id: createId("tx"),
    date: todayYmd(),
    categoryId: null,
    accountId: null,
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
    ...partial,
  };
}

interface StoreApi {
  state: AppState;
  dispatch: Dispatch<Action>;
  locked: boolean;
  loadError?: string;
  setMonth: (key: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  saveCategory: (category: Category) => void;
  removeCategory: (id: string) => void;
  setBudget: (categoryId: string, budgetedCents: Cents) => void;
  reorderCategories: (ids: string[]) => void;
  saveAccount: (account: Account) => void;
  removeAccount: (id: string) => void;
  saveBucket: (bucket: Bucket) => void;
  removeBucket: (id: string) => void;
  saveIncome: (source: IncomeSource) => void;
  removeIncome: (id: string) => void;
  saveBill: (bill: Bill) => void;
  removeBill: (id: string) => void;
  saveExpense: (expense: RecurringExpense) => void;
  removeExpense: (id: string) => void;
  saveDebt: (debt: Debt) => void;
  removeDebt: (id: string) => void;
  saveSavings: (goal: SavingsGoal) => void;
  removeSavings: (id: string) => void;
  saveGoal: (goal: FinancialGoal) => void;
  removeGoal: (id: string) => void;
  addTx: (tx: Partial<Transaction> & Pick<Transaction, "description" | "amountCents" | "type">) => Transaction | null;
  updateTx: (tx: Transaction) => void;
  removeTx: (id: string) => void;
  bulkRemoveTx: (ids: string[]) => void;
  duplicateTx: (id: string) => void;
  markBillPaid: (billId: string, date: string, actualCents: Cents, accountId: string | null) => void;
  skipOccurrence: (kind: "bill" | "income" | "expense", sourceId: string, date: string) => void;
  markIncomeReceived: (sourceId: string, date: string, actualCents: Cents, accountId: string | null) => void;
  recordDebtPayment: (opts: {
    debtId: string;
    date: string;
    scheduledCents: Cents;
    extraCents: Cents;
    principalOnly: boolean;
    accountId: string | null;
    occurrenceDate?: string;
  }) => void;
  transferBuckets: (fromId: string, toId: string, amountCents: Cents, date: string) => void;
  contributeBucket: (bucketId: string, amountCents: Cents, date: string, accountId: string | null, withdraw?: boolean) => void;
  contributeSavings: (goalId: string, amountCents: Cents, date: string, accountId: string | null, withdraw?: boolean) => void;
  transferAccounts: (fromId: string, toId: string, amountCents: Cents, date: string) => void;
  archiveMonth: () => void;
  unlockMonth: (monthKey: string) => void;
  replaceAll: (incoming: AppState) => void;
  mergeIn: (incoming: AppState) => void;
  resetAll: () => void;
  markBackupNow: () => void;
  savePaycheckPlan: (plan: PaycheckPlan) => void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const loaded = useRef(loadState());
  const [state, dispatch] = useReducer(reducer, loaded.current.state);
  const persistTimer = useRef<number | null>(null);

  useEffect(() => {
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => persistState(state), 120);
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, [state]);

  const locked = isMonthLocked(state, state.currentMonth);

  const api = useMemo<StoreApi>(() => {
    const guard = () => locked;

    return {
      state,
      dispatch,
      locked,
      loadError: loaded.current.error,
      setMonth: (monthKey) => dispatch({ type: "setMonth", monthKey }),
      updateSettings: (patch) => dispatch({ type: "updateSettings", patch }),
      saveCategory: (category) => dispatch({ type: "upsertCategory", category: touch(category) }),
      removeCategory: (id) => dispatch({ type: "deleteCategory", id }),
      setBudget: (categoryId, budgetedCents) =>
        dispatch({ type: "setBudget", monthKey: state.currentMonth, categoryId, budgetedCents }),
      reorderCategories: (ids) => dispatch({ type: "reorderCategories", ids }),
      saveAccount: (account) => dispatch({ type: "upsertAccount", account: touch(account) }),
      removeAccount: (id) => dispatch({ type: "deleteAccount", id }),
      saveBucket: (bucket) => dispatch({ type: "upsertBucket", bucket: touch(bucket) }),
      removeBucket: (id) => dispatch({ type: "deleteBucket", id }),
      saveIncome: (source) => dispatch({ type: "upsertIncome", source: touch(source) }),
      removeIncome: (id) => dispatch({ type: "deleteIncome", id }),
      saveBill: (bill) => dispatch({ type: "upsertBill", bill: touch(bill) }),
      removeBill: (id) => dispatch({ type: "deleteBill", id }),
      saveExpense: (expense) => dispatch({ type: "upsertExpense", expense: touch(expense) }),
      removeExpense: (id) => dispatch({ type: "deleteExpense", id }),
      saveDebt: (debt) => dispatch({ type: "upsertDebt", debt: touch(debt) }),
      removeDebt: (id) => dispatch({ type: "deleteDebt", id }),
      saveSavings: (goal) => dispatch({ type: "upsertSavings", goal: touch(goal) }),
      removeSavings: (id) => dispatch({ type: "deleteSavings", id }),
      saveGoal: (goal) => dispatch({ type: "upsertGoal", goal: touch(goal) }),
      removeGoal: (id) => dispatch({ type: "deleteGoal", id }),
      addTx: (partial) => {
        if (guard()) return null;
        const tx = baseTx(partial);
        dispatch({ type: "addTransaction", tx });
        return tx;
      },
      updateTx: (tx) => {
        if (guard()) return;
        dispatch({ type: "updateTransaction", tx: touch(tx) });
      },
      removeTx: (id) => {
        if (guard()) return;
        dispatch({ type: "deleteTransaction", id });
      },
      bulkRemoveTx: (ids) => {
        if (guard()) return;
        dispatch({ type: "bulkDeleteTransactions", ids });
      },
      duplicateTx: (id) => {
        if (guard()) return;
        const src = state.transactions.find((t) => t.id === id);
        if (!src) return;
        dispatch({
          type: "addTransaction",
          tx: { ...src, id: createId("tx"), occurrenceKey: null, date: todayYmd(), ...stamp() },
        });
      },
      markBillPaid: (billId, date, actualCents, accountId) => {
        if (guard()) return;
        const bill = state.bills.find((b) => b.id === billId);
        if (!bill) return;
        const key = occurrenceKey("bill", billId, date);
        if (state.transactions.some((t) => t.occurrenceKey === key)) return;
        const tx = baseTx({
          description: bill.name,
          amountCents: actualCents,
          type: "bill_payment",
          date,
          billId,
          categoryId: bill.categoryId,
          accountId: accountId ?? bill.accountId,
          occurrenceKey: key,
        });
        const sideEffects: SideEffects = {};
        if (bill.debtId) {
          const split = estimateDebtSplit(state, bill.debtId, actualCents, 0, false);
          tx.debtId = bill.debtId;
          tx.interestCents = split.interestCents;
          tx.principalCents = split.principalCents;
          sideEffects.debtBalanceDelta = { debtId: bill.debtId, newBalance: split.newBalanceCents };
        }
        dispatch({ type: "addTransaction", tx, sideEffects });
        dispatch({ type: "setOccurrence", key, status: "paid", actualCents, transactionId: tx.id });
      },
      skipOccurrence: (kind, sourceId, date) => {
        if (guard()) return;
        const key = occurrenceKey(kind, sourceId, date);
        dispatch({ type: "setOccurrence", key, status: "skipped", actualCents: null, transactionId: null });
      },
      markIncomeReceived: (sourceId, date, actualCents, accountId) => {
        if (guard()) return;
        const src = state.incomeSources.find((i) => i.id === sourceId);
        if (!src) return;
        const key = occurrenceKey("income", sourceId, date);
        if (state.transactions.some((t) => t.occurrenceKey === key)) return;
        const tx = baseTx({
          description: src.name,
          amountCents: actualCents,
          type: "income",
          date,
          incomeSourceId: sourceId,
          accountId: accountId ?? src.accountId,
          occurrenceKey: key,
        });
        dispatch({ type: "addTransaction", tx });
        dispatch({ type: "setOccurrence", key, status: "received", actualCents, transactionId: tx.id });
      },
      recordDebtPayment: ({ debtId, date, scheduledCents, extraCents, principalOnly, accountId, occurrenceDate }) => {
        if (guard()) return;
        const debt = state.debts.find((d) => d.id === debtId);
        if (!debt) return;
        const key = occurrenceDate ? occurrenceKey("debt", debtId, occurrenceDate) : null;
        if (key && state.transactions.some((t) => t.occurrenceKey === key) && extraCents === 0 && !principalOnly) return;
        const split = estimateDebtSplit(state, debtId, scheduledCents, extraCents, principalOnly);
        let type: TransactionType = "debt_payment";
        if (principalOnly) type = "principal_debt_payment";
        else if (extraCents > 0 && scheduledCents === 0) type = "extra_debt_payment";
        else if (extraCents > 0) type = "extra_debt_payment";
        const total = scheduledCents + extraCents;
        const tx = baseTx({
          description: principalOnly ? `${debt.name} principal` : extraCents && !scheduledCents ? `${debt.name} extra` : debt.name,
          amountCents: total,
          type,
          date,
          debtId,
          accountId,
          occurrenceKey: type === "debt_payment" ? key : extraCents && scheduledCents ? `${key || createId("debt")}:extra` : key,
          extraPrincipalCents: split.extraPrincipalCents,
          interestCents: split.interestCents,
          principalCents: split.principalCents,
        });
        dispatch({
          type: "addTransaction",
          tx,
          sideEffects: { debtBalanceDelta: { debtId, newBalance: split.newBalanceCents } },
        });
        if (key && type === "debt_payment") {
          dispatch({ type: "setOccurrence", key, status: "paid", actualCents: total, transactionId: tx.id });
        }
      },
      transferBuckets: (fromId, toId, amountCents, date) => {
        if (guard() || fromId === toId || amountCents <= 0) return;
        const from = state.buckets.find((b) => b.id === fromId);
        const to = state.buckets.find((b) => b.id === toId);
        if (!from || !to) return;
        const tx = baseTx({
          description: `${from.name} → ${to.name}`,
          amountCents,
          type: "transfer",
          date,
          bucketId: fromId,
          toBucketId: toId,
        });
        dispatch({
          type: "addTransaction",
          tx,
          sideEffects: {
            bucketDelta: { bucketId: fromId, delta: -amountCents },
            toBucketDelta: { bucketId: toId, delta: amountCents },
          },
        });
      },
      contributeBucket: (bucketId, amountCents, date, accountId, withdraw = false) => {
        if (guard() || amountCents <= 0) return;
        const bucket = state.buckets.find((b) => b.id === bucketId);
        if (!bucket) return;
        const tx = baseTx({
          description: withdraw ? `From ${bucket.name}` : `To ${bucket.name}`,
          amountCents,
          type: withdraw ? "bucket_withdrawal" : "bucket_contribution",
          date,
          bucketId,
          accountId,
        });
        dispatch({
          type: "addTransaction",
          tx,
          sideEffects: { bucketDelta: { bucketId, delta: withdraw ? -amountCents : amountCents } },
        });
      },
      contributeSavings: (goalId, amountCents, date, accountId, withdraw = false) => {
        if (guard() || amountCents <= 0) return;
        const goal = state.savingsGoals.find((g) => g.id === goalId);
        if (!goal) return;
        const tx = baseTx({
          description: withdraw ? `From ${goal.name}` : `To ${goal.name}`,
          amountCents,
          type: withdraw ? "savings_withdrawal" : "savings_contribution",
          date,
          savingsGoalId: goalId,
          accountId,
          toAccountId: withdraw ? accountId : goal.accountId,
        });
        dispatch({
          type: "addTransaction",
          tx,
          sideEffects: { savingsDelta: { goalId, delta: withdraw ? -amountCents : amountCents } },
        });
      },
      transferAccounts: (fromId, toId, amountCents, date) => {
        if (guard() || fromId === toId || amountCents <= 0) return;
        const from = state.accounts.find((a) => a.id === fromId);
        const to = state.accounts.find((a) => a.id === toId);
        if (!from || !to) return;
        const tx = baseTx({
          description: `${from.name} → ${to.name}`,
          amountCents,
          type: "transfer",
          date,
          accountId: fromId,
          toAccountId: toId,
        });
        dispatch({ type: "addTransaction", tx });
      },
      archiveMonth: () => dispatch({ type: "archiveMonth", monthKey: state.currentMonth }),
      unlockMonth: (monthKey) => dispatch({ type: "unlockArchive", monthKey }),
      replaceAll: (incoming) => {
        writeEmergencyBackup(state);
        dispatch({ type: "replace", state: incoming });
      },
      mergeIn: (incoming) => {
        writeEmergencyBackup(state);
        dispatch({ type: "merge", state: incoming });
      },
      resetAll: () => {
        writeEmergencyBackup(state);
        dispatch({ type: "resetAll" });
      },
      markBackupNow: () => dispatch({ type: "markBackup", at: isoNow() }),
      savePaycheckPlan: (plan) => dispatch({ type: "setPaycheckPlan", plan }),
    };
  }, [state, locked]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function useMoney() {
  const { state } = useStore();
  return {
    currency: state.settings.currency,
    locale: state.settings.locale,
  };
}

export { parseDollarsToCents, createId, stamp, touch };
