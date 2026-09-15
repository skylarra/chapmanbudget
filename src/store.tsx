import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from "react";
import { createId, occurrenceKey } from "./lib/ids";
import { addMonthsKey, isoNow, monthBounds, todayYmd } from "./lib/dates";
import { type Cents } from "./lib/money";
import { createEmptyState, stamp, touch } from "./lib/defaults";
import { loadState, persistState, writeEmergencyBackup } from "./lib/storage";
import { advanceFrom } from "./lib/recurrence";
import type {
  AppState,
  Bill,
  ExpenseBucket,
  IncomeSource,
  PoolKind,
  SavingsBucket,
  Settings,
  Transaction,
} from "./lib/types";

type Action =
  | { type: "replace"; state: AppState }
  | { type: "setMonth"; monthKey: string }
  | { type: "settings"; patch: Partial<Settings> }
  | { type: "saveExpense"; bucket: ExpenseBucket }
  | { type: "deleteExpense"; id: string }
  | { type: "reorderExpense"; ids: string[] }
  | { type: "saveSavings"; bucket: SavingsBucket }
  | { type: "deleteSavings"; id: string }
  | { type: "saveBill"; bill: Bill }
  | { type: "deleteBill"; id: string }
  | { type: "saveIncome"; source: IncomeSource }
  | { type: "deleteIncome"; id: string }
  | { type: "addTx"; tx: Transaction; balances: BalancePatch }
  | { type: "deleteTx"; id: string }
  | { type: "updateTx"; tx: Transaction }
  | { type: "advanceBill"; id: string; nextDueDate: string }
  | { type: "advanceIncome"; id: string; nextDate: string }
  | { type: "setTargets"; monthKey: string; expenseTargets: Record<string, Cents> }
  | { type: "applyRollover"; monthKey: string }
  | { type: "reset" };

interface BalancePatch {
  unassignedDelta?: Cents;
  expense?: { id: string; delta: Cents };
  expenseTo?: { id: string; delta: Cents };
  savings?: { id: string; delta: Cents };
  savingsTo?: { id: string; delta: Cents };
}

function applyBalances(state: AppState, patch: BalancePatch): AppState {
  let next = { ...state, unassignedCents: state.unassignedCents + (patch.unassignedDelta || 0) };
  const bumpExp = (id: string, delta: Cents) => {
    next = {
      ...next,
      expenseBuckets: next.expenseBuckets.map((b) => (b.id === id ? touch({ ...b, balanceCents: b.balanceCents + delta }) : b)),
    };
  };
  const bumpSav = (id: string, delta: Cents) => {
    next = {
      ...next,
      savingsBuckets: next.savingsBuckets.map((b) => (b.id === id ? touch({ ...b, balanceCents: b.balanceCents + delta }) : b)),
    };
  };
  if (patch.expense) bumpExp(patch.expense.id, patch.expense.delta);
  if (patch.expenseTo) bumpExp(patch.expenseTo.id, patch.expenseTo.delta);
  if (patch.savings) bumpSav(patch.savings.id, patch.savings.delta);
  if (patch.savingsTo) bumpSav(patch.savingsTo.id, patch.savingsTo.delta);
  return next;
}

function reverseTx(state: AppState, tx: Transaction): AppState {
  if (tx.type === "income") return applyBalances(state, { unassignedDelta: -tx.amountCents });
  if (tx.type === "expense") {
    if (tx.expenseBucketId) return applyBalances(state, { expense: { id: tx.expenseBucketId, delta: tx.amountCents } });
    return applyBalances(state, { unassignedDelta: tx.amountCents });
  }
  const patch: BalancePatch = {};
  if (tx.fromKind === "available") patch.unassignedDelta = (patch.unassignedDelta || 0) + tx.amountCents;
  if (tx.fromKind === "expense" && tx.fromId) patch.expense = { id: tx.fromId, delta: tx.amountCents };
  if (tx.fromKind === "savings" && tx.fromId) patch.savings = { id: tx.fromId, delta: tx.amountCents };
  if (tx.toKind === "available") patch.unassignedDelta = (patch.unassignedDelta || 0) - tx.amountCents;
  if (tx.toKind === "expense" && tx.toId) patch.expenseTo = { id: tx.toId, delta: -tx.amountCents };
  if (tx.toKind === "savings" && tx.toId) patch.savingsTo = { id: tx.toId, delta: -tx.amountCents };
  return applyBalances(state, patch);
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "replace":
      return action.state;
    case "reset":
      return createEmptyState();
    case "setMonth":
      return { ...state, currentMonth: action.monthKey };
    case "settings":
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case "saveExpense": {
      const exists = state.expenseBuckets.some((b) => b.id === action.bucket.id);
      return {
        ...state,
        expenseBuckets: exists
          ? state.expenseBuckets.map((b) => (b.id === action.bucket.id ? action.bucket : b))
          : [...state.expenseBuckets, action.bucket],
      };
    }
    case "deleteExpense":
      return { ...state, expenseBuckets: state.expenseBuckets.filter((b) => b.id !== action.id) };
    case "reorderExpense":
      return {
        ...state,
        expenseBuckets: action.ids
          .map((id, i) => {
            const b = state.expenseBuckets.find((x) => x.id === id);
            return b ? { ...b, sortOrder: i, updatedAt: isoNow() } : null;
          })
          .filter((b): b is ExpenseBucket => Boolean(b)),
      };
    case "saveSavings": {
      const exists = state.savingsBuckets.some((b) => b.id === action.bucket.id);
      return {
        ...state,
        savingsBuckets: exists
          ? state.savingsBuckets.map((b) => (b.id === action.bucket.id ? action.bucket : b))
          : [...state.savingsBuckets, action.bucket],
      };
    }
    case "deleteSavings":
      return { ...state, savingsBuckets: state.savingsBuckets.filter((b) => b.id !== action.id) };
    case "saveBill": {
      const exists = state.bills.some((b) => b.id === action.bill.id);
      return { ...state, bills: exists ? state.bills.map((b) => (b.id === action.bill.id ? action.bill : b)) : [...state.bills, action.bill] };
    }
    case "deleteBill":
      return { ...state, bills: state.bills.filter((b) => b.id !== action.id) };
    case "saveIncome": {
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
    case "addTx": {
      if (action.tx.occurrenceKey && state.transactions.some((t) => t.occurrenceKey === action.tx.occurrenceKey)) return state;
      return applyBalances({ ...state, transactions: [...state.transactions, action.tx] }, action.balances);
    }
    case "deleteTx": {
      const tx = state.transactions.find((t) => t.id === action.id);
      if (!tx) return state;
      return reverseTx({ ...state, transactions: state.transactions.filter((t) => t.id !== action.id) }, tx);
    }
    case "updateTx":
      return { ...state, transactions: state.transactions.map((t) => (t.id === action.tx.id ? action.tx : t)) };
    case "advanceBill":
      return {
        ...state,
        bills: state.bills.map((b) => (b.id === action.id ? touch({ ...b, nextDueDate: action.nextDueDate }) : b)),
      };
    case "advanceIncome":
      return {
        ...state,
        incomeSources: state.incomeSources.map((i) => (i.id === action.id ? touch({ ...i, nextDate: action.nextDate }) : i)),
      };
    case "setTargets": {
      const current = state.months[action.monthKey] ?? { monthKey: action.monthKey, rolloverApplied: false, expenseTargets: {}, notes: "" };
      return { ...state, months: { ...state.months, [action.monthKey]: { ...current, expenseTargets: action.expenseTargets } } };
    }
    case "applyRollover": {
      const prevKey = addMonthsKey(action.monthKey, -1);
      const prev = state.months[prevKey];
      const { startYmd, endYmd } = monthBounds(prevKey);
      const targets: Record<string, Cents> = {};
      for (const bucket of state.expenseBuckets) {
        const planned = prev?.expenseTargets[bucket.id] ?? bucket.targetCents;
        const spent = state.transactions
          .filter((t) => t.type === "expense" && t.expenseBucketId === bucket.id && t.date >= startYmd && t.date <= endYmd)
          .reduce((s, t) => s + t.amountCents, 0);
        const leftover = Math.max(0, planned - spent);
        targets[bucket.id] = bucket.targetCents + (bucket.rollover ? leftover : 0);
      }
      return {
        ...state,
        months: {
          ...state.months,
          [action.monthKey]: {
            monthKey: action.monthKey,
            rolloverApplied: true,
            expenseTargets: targets,
            notes: "",
          },
        },
      };
    }
    default:
      return state;
  }
}

function baseTx(partial: Partial<Transaction> & Pick<Transaction, "amountCents" | "type" | "description">): Transaction {
  return {
    id: createId("tx"),
    date: todayYmd(),
    notes: "",
    expenseBucketId: null,
    savingsBucketId: null,
    incomeSourceId: null,
    billId: null,
    fromKind: null,
    fromId: null,
    toKind: null,
    toId: null,
    occurrenceKey: null,
    ...stamp(),
    ...partial,
  };
}

export interface StoreApi {
  state: AppState;
  dispatch: Dispatch<Action>;
  loadError?: string;
  setMonth: (key: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  saveExpenseBucket: (bucket: ExpenseBucket) => void;
  removeExpenseBucket: (id: string) => void;
  saveSavingsBucket: (bucket: SavingsBucket) => void;
  removeSavingsBucket: (id: string) => void;
  saveBill: (bill: Bill) => void;
  removeBill: (id: string) => void;
  saveIncome: (source: IncomeSource) => void;
  removeIncome: (id: string) => void;
  addExpense: (opts: { amountCents: Cents; description: string; date: string; bucketId: string; notes?: string }) => void;
  addIncome: (opts: {
    amountCents: Cents;
    description: string;
    date: string;
    sourceId: string | null;
    notes?: string;
    advance?: boolean;
  }) => void;
  transfer: (opts: {
    amountCents: Cents;
    date: string;
    fromKind: PoolKind;
    fromId: string | null;
    toKind: PoolKind;
    toId: string | null;
    notes?: string;
  }) => void;
  payBill: (billId: string, actualCents: Cents, date: string) => void;
  skipBill: (billId: string) => void;
  budgetPaycheck: (opts: {
    amountCents: Cents;
    date: string;
    sourceId: string | null;
    description: string;
    lines: { kind: "expense" | "savings"; id: string; amountCents: Cents; label: string }[];
  }) => void;
  removeTx: (id: string) => void;
  setBucketTarget: (bucketId: string, targetCents: Cents) => void;
  replaceAll: (incoming: AppState) => void;
  resetAll: () => void;
  markBackupNow: () => void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const loaded = useRef(loadState());
  const [state, dispatch] = useReducer(reducer, loaded.current.state);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => persistState(state), 100);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [state]);

  useEffect(() => {
    const rec = state.months[state.currentMonth];
    if (!rec?.rolloverApplied) dispatch({ type: "applyRollover", monthKey: state.currentMonth });
  }, [state.currentMonth, state.months]);

  const api = useMemo<StoreApi>(() => {
    return {
      state,
      dispatch,
      loadError: loaded.current.error,
      setMonth: (monthKey) => dispatch({ type: "setMonth", monthKey }),
      updateSettings: (patch) => dispatch({ type: "settings", patch }),
      saveExpenseBucket: (bucket) => dispatch({ type: "saveExpense", bucket: touch(bucket) }),
      removeExpenseBucket: (id) => dispatch({ type: "deleteExpense", id }),
      saveSavingsBucket: (bucket) => dispatch({ type: "saveSavings", bucket: touch(bucket) }),
      removeSavingsBucket: (id) => dispatch({ type: "deleteSavings", id }),
      saveBill: (bill) => dispatch({ type: "saveBill", bill: touch(bill) }),
      removeBill: (id) => dispatch({ type: "deleteBill", id }),
      saveIncome: (source) => dispatch({ type: "saveIncome", source: touch(source) }),
      removeIncome: (id) => dispatch({ type: "deleteIncome", id }),
      addExpense: ({ amountCents, description, date, bucketId, notes }) => {
        const tx = baseTx({
          amountCents,
          type: "expense",
          description,
          date,
          notes: notes || "",
          expenseBucketId: bucketId,
          fromKind: "expense",
          fromId: bucketId,
        });
        dispatch({ type: "addTx", tx, balances: { expense: { id: bucketId, delta: -amountCents } } });
      },
      addIncome: ({ amountCents, description, date, sourceId, notes, advance }) => {
        const source = sourceId ? state.incomeSources.find((i) => i.id === sourceId) : null;
        const key = source ? occurrenceKey("income", source.id, source.nextDate) : null;
        const tx = baseTx({
          amountCents,
          type: "income",
          description: description || source?.name || "Income",
          date,
          notes: notes || "",
          incomeSourceId: sourceId,
          toKind: "available",
          occurrenceKey: key,
        });
        dispatch({ type: "addTx", tx, balances: { unassignedDelta: amountCents } });
        if (advance && source && source.frequency !== "once") {
          dispatch({ type: "advanceIncome", id: source.id, nextDate: advanceFrom(source.nextDate, source.frequency, source.secondDay) });
        }
      },
      transfer: ({ amountCents, date, fromKind, fromId, toKind, toId, notes }) => {
        if (amountCents <= 0 || (fromKind === toKind && fromId === toId)) return;
        const label = (kind: PoolKind, id: string | null) => {
          if (kind === "available") return "Available";
          if (kind === "expense") return state.expenseBuckets.find((b) => b.id === id)?.name || "Bucket";
          return state.savingsBuckets.find((b) => b.id === id)?.name || "Savings";
        };
        const tx = baseTx({
          amountCents,
          type: "transfer",
          description: `${label(fromKind, fromId)} → ${label(toKind, toId)}`,
          date,
          notes: notes || "",
          fromKind,
          fromId,
          toKind,
          toId,
          expenseBucketId: toKind === "expense" ? toId : fromKind === "expense" ? fromId : null,
          savingsBucketId: toKind === "savings" ? toId : fromKind === "savings" ? fromId : null,
        });
        const balances: BalancePatch = {};
        if (fromKind === "available") balances.unassignedDelta = -amountCents;
        if (fromKind === "expense" && fromId) balances.expense = { id: fromId, delta: -amountCents };
        if (fromKind === "savings" && fromId) balances.savings = { id: fromId, delta: -amountCents };
        if (toKind === "available") balances.unassignedDelta = (balances.unassignedDelta || 0) + amountCents;
        if (toKind === "expense" && toId) balances.expenseTo = { id: toId, delta: amountCents };
        if (toKind === "savings" && toId) balances.savingsTo = { id: toId, delta: amountCents };
        dispatch({ type: "addTx", tx, balances });
      },
      payBill: (billId, actualCents, date) => {
        const bill = state.bills.find((b) => b.id === billId);
        if (!bill) return;
        const key = occurrenceKey("bill", bill.id, bill.nextDueDate);
        const bucketId = bill.bucketId;
        const tx = baseTx({
          amountCents: actualCents,
          type: "expense",
          description: bill.name,
          date,
          billId: bill.id,
          expenseBucketId: bucketId,
          fromKind: bucketId ? "expense" : "available",
          fromId: bucketId,
          occurrenceKey: key,
        });
        const balances: BalancePatch = bucketId
          ? { expense: { id: bucketId, delta: -actualCents } }
          : { unassignedDelta: -actualCents };
        dispatch({ type: "addTx", tx, balances });
        if (bill.frequency === "once") dispatch({ type: "saveBill", bill: touch({ ...bill, active: false }) });
        else dispatch({ type: "advanceBill", id: bill.id, nextDueDate: advanceFrom(bill.nextDueDate, bill.frequency, bill.secondDay) });
      },
      skipBill: (billId) => {
        const bill = state.bills.find((b) => b.id === billId);
        if (!bill) return;
        if (bill.frequency === "once") dispatch({ type: "saveBill", bill: touch({ ...bill, active: false }) });
        else dispatch({ type: "advanceBill", id: bill.id, nextDueDate: advanceFrom(bill.nextDueDate, bill.frequency, bill.secondDay) });
      },
      budgetPaycheck: ({ amountCents, date, sourceId, description, lines }) => {
        const source = sourceId ? state.incomeSources.find((i) => i.id === sourceId) : null;
        const key = source ? occurrenceKey("income", source.id, date) : occurrenceKey("income", "adhoc", date + amountCents);
        const incomeTx = baseTx({
          amountCents,
          type: "income",
          description: description || source?.name || "Paycheck",
          date,
          incomeSourceId: sourceId,
          toKind: "available",
          occurrenceKey: key,
        });
        dispatch({ type: "addTx", tx: incomeTx, balances: { unassignedDelta: amountCents } });
        if (source && source.frequency !== "once") {
          dispatch({ type: "advanceIncome", id: source.id, nextDate: advanceFrom(source.nextDate, source.frequency, source.secondDay) });
        }
        for (const line of lines) {
          if (line.amountCents <= 0) continue;
          const toKind = line.kind === "expense" ? "expense" : "savings";
          const tx = baseTx({
            amountCents: line.amountCents,
            type: "transfer",
            description: `Paycheck → ${line.label}`,
            date,
            fromKind: "available",
            fromId: null,
            toKind,
            toId: line.id,
            expenseBucketId: line.kind === "expense" ? line.id : null,
            savingsBucketId: line.kind === "savings" ? line.id : null,
          });
          const balances: BalancePatch = { unassignedDelta: -line.amountCents };
          if (line.kind === "expense") balances.expenseTo = { id: line.id, delta: line.amountCents };
          else balances.savingsTo = { id: line.id, delta: line.amountCents };
          dispatch({ type: "addTx", tx, balances });
        }
      },
      removeTx: (id) => dispatch({ type: "deleteTx", id }),
      setBucketTarget: (bucketId, targetCents) => {
        const bucket = state.expenseBuckets.find((b) => b.id === bucketId);
        if (bucket) dispatch({ type: "saveExpense", bucket: touch({ ...bucket, targetCents }) });
        const month = state.months[state.currentMonth] ?? { monthKey: state.currentMonth, rolloverApplied: true, expenseTargets: {}, notes: "" };
        dispatch({
          type: "setTargets",
          monthKey: state.currentMonth,
          expenseTargets: { ...month.expenseTargets, [bucketId]: targetCents },
        });
      },
      replaceAll: (incoming) => {
        writeEmergencyBackup(state);
        dispatch({ type: "replace", state: incoming });
      },
      resetAll: () => {
        writeEmergencyBackup(state);
        dispatch({ type: "reset" });
      },
      markBackupNow: () => dispatch({ type: "settings", patch: { lastBackupAt: isoNow() } }),
    };
  }, [state]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export { createId, stamp, touch };
