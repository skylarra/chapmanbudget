import { createId } from "./ids";
import { isoNow, todayYmd, monthKeyFromDate } from "./dates";
import type { Account, AppState, Category, Settings } from "./types";
import { APP_VERSION } from "./types";

export const DEFAULT_CATEGORIES: Omit<Category, "id" | "createdAt" | "updatedAt">[] = [
  { name: "Mortgage", icon: "🏠", color: "#3b6d5a", defaultBudgetCents: 0, rollover: false, recurring: true, sortOrder: 0, kind: "expense" },
  { name: "Refinance loan", icon: "🏦", color: "#4b6b8a", defaultBudgetCents: 0, rollover: false, recurring: true, sortOrder: 1, kind: "expense" },
  { name: "Utilities", icon: "💡", color: "#c9a227", defaultBudgetCents: 0, rollover: false, recurring: true, sortOrder: 2, kind: "expense" },
  { name: "Groceries", icon: "🛒", color: "#2f7d4a", defaultBudgetCents: 0, rollover: true, recurring: true, sortOrder: 3, kind: "expense" },
  { name: "Gas", icon: "⛽", color: "#c05621", defaultBudgetCents: 0, rollover: false, recurring: true, sortOrder: 4, kind: "expense" },
  { name: "Insurance", icon: "🛡️", color: "#3d5a80", defaultBudgetCents: 0, rollover: false, recurring: true, sortOrder: 5, kind: "expense" },
  { name: "Child expenses", icon: "🧸", color: "#b56576", defaultBudgetCents: 0, rollover: true, recurring: true, sortOrder: 6, kind: "expense" },
  { name: "Pets", icon: "🐾", color: "#6d597a", defaultBudgetCents: 0, rollover: true, recurring: true, sortOrder: 7, kind: "expense" },
  { name: "Subscriptions", icon: "📺", color: "#457b9d", defaultBudgetCents: 0, rollover: false, recurring: true, sortOrder: 8, kind: "expense" },
  { name: "Entertainment", icon: "🎬", color: "#9b5de5", defaultBudgetCents: 0, rollover: false, recurring: false, sortOrder: 9, kind: "expense" },
  { name: "Household", icon: "🧹", color: "#588157", defaultBudgetCents: 0, rollover: true, recurring: true, sortOrder: 10, kind: "expense" },
  { name: "Shopping", icon: "🛍️", color: "#e07a5f", defaultBudgetCents: 0, rollover: false, recurring: false, sortOrder: 11, kind: "expense" },
  { name: "Savings", icon: "💰", color: "#1f6f5b", defaultBudgetCents: 0, rollover: true, recurring: true, sortOrder: 12, kind: "savings" },
  { name: "Emergency fund", icon: "🚨", color: "#9b2226", defaultBudgetCents: 0, rollover: true, recurring: true, sortOrder: 13, kind: "savings" },
  { name: "Vacation", icon: "✈️", color: "#0077b6", defaultBudgetCents: 0, rollover: true, recurring: true, sortOrder: 14, kind: "savings" },
  { name: "Business", icon: "💼", color: "#264653", defaultBudgetCents: 0, rollover: false, recurring: false, sortOrder: 15, kind: "expense" },
  { name: "Miscellaneous", icon: "📦", color: "#6c757d", defaultBudgetCents: 0, rollover: false, recurring: false, sortOrder: 16, kind: "expense" },
];

export function defaultSettings(): Settings {
  return {
    currency: "USD",
    locale: "en-US",
    firstDayOfWeek: 1,
    firstDayOfMonth: 1,
    dateFormat: "medium",
    theme: "system",
    defaultRollover: false,
    paycheckIncomeId: null,
    lastBackupAt: null,
    notifications: {
      upcomingBills: false,
      overdueBills: false,
      paydays: false,
    },
  };
}

export function defaultAccounts(): Account[] {
  const now = isoNow();
  return [
    { id: createId("acct"), name: "Checking", type: "checking", startingBalanceCents: 0, createdAt: now, updatedAt: now },
    { id: createId("acct"), name: "Savings", type: "savings", startingBalanceCents: 0, createdAt: now, updatedAt: now },
    { id: createId("acct"), name: "Cash", type: "cash", startingBalanceCents: 0, createdAt: now, updatedAt: now },
  ];
}

export function defaultCategories(): Category[] {
  const now = isoNow();
  return DEFAULT_CATEGORIES.map((c) => ({
    ...c,
    id: createId("cat"),
    createdAt: now,
    updatedAt: now,
  }));
}

export function createEmptyState(now = new Date()): AppState {
  return {
    version: APP_VERSION,
    settings: defaultSettings(),
    accounts: defaultAccounts(),
    categories: defaultCategories(),
    buckets: [],
    incomeSources: [],
    bills: [],
    expenses: [],
    debts: [],
    transactions: [],
    occurrences: {},
    savingsGoals: [],
    financialGoals: [],
    budgetMonths: {},
    archives: [],
    paycheckPlans: [],
    netWorthSnapshots: [],
    currentMonth: monthKeyFromDate(now),
  };
}

export function stamp(): { createdAt: string; updatedAt: string } {
  const now = isoNow();
  return { createdAt: now, updatedAt: now };
}

export function touch<T extends { updatedAt: string }>(item: T): T {
  return { ...item, updatedAt: isoNow() };
}

export function todayStamp() {
  return { date: todayYmd(), ...stamp() };
}
