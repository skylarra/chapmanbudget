import type { Cents } from "./money";

export type Frequency =
  | "once"
  | "weekly"
  | "biweekly"
  | "twice_monthly"
  | "monthly"
  | "quarterly"
  | "annually";

export type TxType = "expense" | "income" | "transfer";
export type PoolKind = "available" | "expense" | "savings";
export type ThemePreference = "light" | "dark" | "system";

export interface Settings {
  currency: string;
  locale: string;
  firstDayOfWeek: number;
  theme: ThemePreference;
  lastBackupAt: string | null;
  paycheckIncomeId: string | null;
}

export interface ExpenseBucket {
  id: string;
  name: string;
  balanceCents: Cents;
  targetCents: Cents;
  rollover: boolean;
  spendingLimitCents: Cents | null;
  notes: string;
  color: string;
  icon: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsBucket {
  id: string;
  name: string;
  balanceCents: Cents;
  goalCents: Cents;
  targetDate: string | null;
  autoContributionCents: Cents;
  autoFrequency: Frequency | null;
  notes: string;
  color: string;
  icon: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Bill {
  id: string;
  name: string;
  amountCents: Cents;
  frequency: Frequency;
  nextDueDate: string;
  secondDay: number | null;
  bucketId: string | null;
  active: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncomeSource {
  id: string;
  name: string;
  expectedCents: Cents;
  frequency: Frequency;
  nextDate: string;
  secondDay: number | null;
  active: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  date: string;
  amountCents: Cents;
  type: TxType;
  description: string;
  notes: string;
  expenseBucketId: string | null;
  savingsBucketId: string | null;
  incomeSourceId: string | null;
  billId: string | null;
  fromKind: PoolKind | null;
  fromId: string | null;
  toKind: PoolKind | null;
  toId: string | null;
  occurrenceKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonthRecord {
  monthKey: string;
  rolloverApplied: boolean;
  expenseTargets: Record<string, Cents>;
  notes: string;
}

export interface AppState {
  version: number;
  settings: Settings;
  unassignedCents: Cents;
  expenseBuckets: ExpenseBucket[];
  savingsBuckets: SavingsBucket[];
  bills: Bill[];
  incomeSources: IncomeSource[];
  transactions: Transaction[];
  months: Record<string, MonthRecord>;
  currentMonth: string;
}

export const APP_VERSION = 9;
export const STORAGE_KEY = "boodget:v9";
export const PREV_STORAGE_KEY = "boodget:v8";

export const FREQUENCIES: Frequency[] = [
  "once",
  "weekly",
  "biweekly",
  "twice_monthly",
  "monthly",
  "quarterly",
  "annually",
];

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  once: "One-time",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  twice_monthly: "Twice monthly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Yearly",
};
