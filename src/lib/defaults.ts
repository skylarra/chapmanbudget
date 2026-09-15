import { createId } from "./ids";
import { isoNow, monthKeyFromDate, todayYmd } from "./dates";
import type { AppState, ExpenseBucket, SavingsBucket, Settings } from "./types";
import { APP_VERSION } from "./types";

export function defaultSettings(): Settings {
  return {
    currency: "USD",
    locale: "en-US",
    firstDayOfWeek: 0,
    theme: "system",
    lastBackupAt: null,
    paycheckIncomeId: null,
  };
}

const EXPENSE_SEEDS: { name: string; icon: string; color: string }[] = [
  { name: "Groceries", icon: "🛒", color: "#2f7d4a" },
  { name: "Eating Out", icon: "🍔", color: "#c05621" },
  { name: "Gas", icon: "⛽", color: "#9a6b12" },
  { name: "Household", icon: "🏠", color: "#3d5a80" },
  { name: "Child", icon: "🧸", color: "#b56576" },
  { name: "Fun", icon: "🎬", color: "#6d597a" },
  { name: "Miscellaneous", icon: "📦", color: "#6c757d" },
];

export function defaultExpenseBuckets(): ExpenseBucket[] {
  const now = isoNow();
  return EXPENSE_SEEDS.map((s, i) => ({
    id: createId("exp"),
    name: s.name,
    balanceCents: 0,
    targetCents: 0,
    rollover: true,
    spendingLimitCents: null,
    notes: "",
    color: s.color,
    icon: s.icon,
    sortOrder: i,
    createdAt: now,
    updatedAt: now,
  }));
}

export function defaultSavingsBuckets(): SavingsBucket[] {
  const now = isoNow();
  return [
    { name: "Emergency Fund", icon: "🚨", color: "#9b2226", goal: 800000 },
    { name: "Christmas", icon: "🎁", color: "#1f6f5b", goal: 80000 },
    { name: "Car Repairs", icon: "🔧", color: "#2c6e9a", goal: 100000 },
  ].map((s, i) => ({
    id: createId("sav"),
    name: s.name,
    balanceCents: 0,
    goalCents: s.goal,
    targetDate: null,
    autoContributionCents: 0,
    autoFrequency: "biweekly" as const,
    notes: "",
    color: s.color,
    icon: s.icon,
    sortOrder: i,
    createdAt: now,
    updatedAt: now,
  }));
}

export function createEmptyState(now = new Date()): AppState {
  return {
    version: APP_VERSION,
    settings: defaultSettings(),
    unassignedCents: 0,
    expenseBuckets: defaultExpenseBuckets(),
    savingsBuckets: defaultSavingsBuckets(),
    bills: [],
    incomeSources: [],
    transactions: [],
    months: {},
    currentMonth: monthKeyFromDate(now),
  };
}

export function stamp() {
  const now = isoNow();
  return { createdAt: now, updatedAt: now };
}

export function touch<T extends { updatedAt: string }>(item: T): T {
  return { ...item, updatedAt: isoNow() };
}

export { todayYmd };
