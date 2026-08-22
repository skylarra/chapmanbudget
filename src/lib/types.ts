import type { Cents } from "./money";

export type Frequency = "once" | "weekly" | "biweekly" | "monthly" | "quarterly" | "annually";

export type AccountType = "checking" | "savings" | "credit" | "cash" | "other";

export type CategoryKind = "expense" | "income" | "savings" | "debt";

export type DebtType = "mortgage" | "refinance" | "auto" | "credit" | "personal" | "student" | "other";

export type TransactionType =
  | "income"
  | "expense"
  | "bill_payment"
  | "debt_payment"
  | "extra_debt_payment"
  | "principal_debt_payment"
  | "savings_contribution"
  | "savings_withdrawal"
  | "bucket_contribution"
  | "bucket_withdrawal"
  | "transfer";

export type PaymentStatus = "upcoming" | "due" | "overdue" | "paid" | "skipped" | "expected" | "received" | "late";

export type ThemePreference = "light" | "dark" | "system";

export interface Settings {
  currency: string;
  locale: string;
  firstDayOfWeek: number;
  firstDayOfMonth: number;
  dateFormat: "short" | "medium";
  theme: ThemePreference;
  defaultRollover: boolean;
  paycheckIncomeId: string | null;
  lastBackupAt: string | null;
  notifications: {
    upcomingBills: boolean;
    overdueBills: boolean;
    paydays: boolean;
  };
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  startingBalanceCents: Cents;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  defaultBudgetCents: Cents;
  rollover: boolean;
  recurring: boolean;
  sortOrder: number;
  kind: CategoryKind;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetAllocation {
  categoryId: string;
  budgetedCents: Cents;
  rolloverInCents: Cents;
}

export interface Bucket {
  id: string;
  name: string;
  goalCents: Cents;
  balanceCents: Cents;
  contributionCents: Cents;
  frequency: Frequency;
  nextDate: string | null;
  targetDate: string | null;
  notes: string;
  color: string;
  icon: string;
  accountId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncomeSource {
  id: string;
  name: string;
  amountCents: Cents;
  frequency: Frequency;
  nextDate: string;
  startDate: string;
  endDate: string | null;
  active: boolean;
  notes: string;
  accountId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Bill {
  id: string;
  name: string;
  expectedCents: Cents;
  dueDate: string;
  frequency: Frequency;
  categoryId: string | null;
  autopay: boolean;
  active: boolean;
  notes: string;
  accountId: string | null;
  debtId: string | null;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringExpense {
  id: string;
  name: string;
  amountCents: Cents;
  categoryId: string | null;
  frequency: Frequency;
  nextDate: string;
  startDate: string;
  endDate: string | null;
  active: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Debt {
  id: string;
  name: string;
  type: DebtType;
  originalBalanceCents: Cents;
  currentBalanceCents: Cents;
  originalLoanCents: Cents;
  aprBps: number;
  minimumPaymentCents: Cents;
  plannedPaymentCents: Cents;
  extraPaymentCents: Cents;
  frequency: Frequency;
  dueDate: string;
  creditLimitCents: Cents | null;
  startDate: string | null;
  originalPayoffDate: string | null;
  notes: string;
  accountId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amountCents: Cents;
  type: TransactionType;
  categoryId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  notes: string;
  billId: string | null;
  debtId: string | null;
  bucketId: string | null;
  toBucketId: string | null;
  savingsGoalId: string | null;
  incomeSourceId: string | null;
  expenseId: string | null;
  occurrenceKey: string | null;
  extraPrincipalCents: Cents;
  interestCents: Cents;
  principalCents: Cents;
  createdAt: string;
  updatedAt: string;
}

export interface OccurrenceOverride {
  key: string;
  status: PaymentStatus;
  actualCents: Cents | null;
  paidAt: string | null;
  transactionId: string | null;
  notes: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetCents: Cents;
  currentCents: Cents;
  targetDate: string | null;
  contributionCents: Cents;
  frequency: Frequency;
  nextDate: string | null;
  notes: string;
  accountId: string | null;
  bucketId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialGoal {
  id: string;
  name: string;
  kind: "save" | "payoff" | "custom";
  targetCents: Cents;
  currentCents: Cents;
  targetDate: string | null;
  linkedDebtId: string | null;
  linkedSavingsId: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaycheckAssignment {
  id: string;
  kind: "bill" | "category" | "bucket" | "debt" | "savings" | "expense";
  targetId: string;
  amountCents: Cents;
  label: string;
}

export interface PaycheckPlan {
  id: string;
  incomeSourceId: string;
  occurrenceDate: string;
  assignments: PaycheckAssignment[];
}

export interface MonthArchive {
  monthKey: string;
  archivedAt: string;
  readOnly: boolean;
  summary: ArchiveSummary;
}

export interface ArchiveSummary {
  incomeCents: Cents;
  expensesCents: Cents;
  billsCents: Cents;
  savingsCents: Cents;
  debtPaymentsCents: Cents;
  budgetedCents: Cents;
  actualCents: Cents;
  endingAccountBalances: { accountId: string; name: string; balanceCents: Cents }[];
  endingDebtBalances: { debtId: string; name: string; balanceCents: Cents }[];
  categoryActuals: { categoryId: string; name: string; budgetedCents: Cents; spentCents: Cents }[];
}

export interface NetWorthSnapshot {
  date: string;
  monthKey: string;
  assetsCents: Cents;
  liabilitiesCents: Cents;
  netCents: Cents;
}

export interface AppState {
  version: number;
  settings: Settings;
  accounts: Account[];
  categories: Category[];
  buckets: Bucket[];
  incomeSources: IncomeSource[];
  bills: Bill[];
  expenses: RecurringExpense[];
  debts: Debt[];
  transactions: Transaction[];
  occurrences: Record<string, OccurrenceOverride>;
  savingsGoals: SavingsGoal[];
  financialGoals: FinancialGoal[];
  budgetMonths: Record<string, BudgetAllocation[]>;
  archives: MonthArchive[];
  paycheckPlans: PaycheckPlan[];
  netWorthSnapshots: NetWorthSnapshot[];
  currentMonth: string;
}

export const APP_VERSION = 8;
export const STORAGE_KEY = "boodget:v8";
export const LEGACY_MARKER_START = "---BEGIN_BUDGET_BUCKETS_JSON---";
export const LEGACY_MARKER_END = "---END_BUDGET_BUCKETS_JSON---";

export const FREQUENCIES: Frequency[] = ["once", "weekly", "biweekly", "monthly", "quarterly", "annually"];

export const TRANSACTION_TYPES: TransactionType[] = [
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
];

export const DEBT_TYPES: DebtType[] = [
  "mortgage",
  "refinance",
  "auto",
  "credit",
  "personal",
  "student",
  "other",
];

export const ACCOUNT_TYPES: AccountType[] = ["checking", "savings", "credit", "cash", "other"];

export function isTransferLike(type: TransactionType): boolean {
  return (
    type === "transfer" ||
    type === "savings_contribution" ||
    type === "savings_withdrawal" ||
    type === "bucket_contribution" ||
    type === "bucket_withdrawal"
  );
}

export function isSpendingType(type: TransactionType): boolean {
  return type === "expense" || type === "bill_payment";
}

export function isDebtPaymentType(type: TransactionType): boolean {
  return type === "debt_payment" || type === "extra_debt_payment" || type === "principal_debt_payment";
}

export function isIncomeType(type: TransactionType): boolean {
  return type === "income";
}
