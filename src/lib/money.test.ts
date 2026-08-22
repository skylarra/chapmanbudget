import { describe, expect, it } from "vitest";
import { addCents, dollarsToCents, formatMoney, parseDollarsToCents } from "./money";
import { listOccurrencesInRange, nextOccurrenceOnOrAfter } from "./recurrence";
import { comparePayoffScenarios, projectPayoff, splitPayment } from "./debt";
import { migrateLegacyPayload, sanitizeState } from "./migrate";
import { exportJson, previewImport, mergeStates } from "./importExport";
import { createEmptyState } from "./defaults";
import { expenseTotal, incomeReceived, isMonthLocked, monthSnapshot } from "./calculations";
import { isSpendingType, isTransferLike } from "./types";

describe("money", () => {
  it("parses dollars to cents without float drift", () => {
    expect(parseDollarsToCents("1,250.00")).toBe(125000);
    expect(parseDollarsToCents("164.32")).toBe(16432);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
    expect(addCents(199, 1)).toBe(200);
  });

  it("formats currency with two decimals", () => {
    expect(formatMoney(125000)).toBe("$1,250.00");
    expect(formatMoney(-16432)).toBe("-$164.32");
  });
});

describe("recurrence", () => {
  it("generates weekly, biweekly, monthly, quarterly, annual, and once dates", () => {
    expect(listOccurrencesInRange({ frequency: "once", nextDate: "2026-08-15" }, "2026-08-01", "2026-08-31")).toEqual(["2026-08-15"]);
    expect(listOccurrencesInRange({ frequency: "weekly", nextDate: "2026-08-03" }, "2026-08-01", "2026-08-31")).toHaveLength(5);
    expect(listOccurrencesInRange({ frequency: "biweekly", nextDate: "2026-08-07" }, "2026-08-01", "2026-08-31")).toEqual(["2026-08-07", "2026-08-21"]);
    expect(listOccurrencesInRange({ frequency: "monthly", nextDate: "2026-08-01" }, "2026-08-01", "2026-10-31")).toEqual(["2026-08-01", "2026-09-01", "2026-10-01"]);
    expect(listOccurrencesInRange({ frequency: "quarterly", nextDate: "2026-01-15" }, "2026-01-01", "2026-12-31")).toEqual(["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]);
    expect(listOccurrencesInRange({ frequency: "annually", nextDate: "2026-06-15", startDate: "2026-06-15" }, "2025-01-01", "2027-12-31")).toEqual(["2026-06-15", "2027-06-15"]);
  });

  it("does not create duplicate dates", () => {
    const a = listOccurrencesInRange({ frequency: "biweekly", nextDate: "2026-08-07" }, "2026-08-01", "2026-12-31");
    expect(new Set(a).size).toBe(a.length);
  });

  it("respects end dates and inactive flag", () => {
    expect(listOccurrencesInRange({ frequency: "weekly", nextDate: "2026-08-03", endDate: "2026-08-10" }, "2026-08-01", "2026-08-31")).toEqual(["2026-08-03", "2026-08-10"]);
    expect(listOccurrencesInRange({ frequency: "monthly", nextDate: "2026-08-01", active: false }, "2026-08-01", "2026-08-31")).toEqual([]);
  });

  it("finds the next occurrence on or after a date", () => {
    expect(nextOccurrenceOnOrAfter({ frequency: "monthly", nextDate: "2026-01-28" }, "2026-08-01")).toBe("2026-08-28");
  });
});

describe("debt payoff", () => {
  it("projects extra biweekly payments to save months and interest", () => {
    const base = {
      balanceCents: 14250000,
      aprBps: 425,
      paymentCents: 85000,
      frequency: "biweekly" as const,
      startDate: "2026-08-01",
    };
    const compare = comparePayoffScenarios(base, 10000);
    expect(compare.extra.feasible).toBe(true);
    expect(compare.current.feasible).toBe(true);
    expect(compare.monthsSaved).toBeGreaterThan(0);
    expect(compare.interestSavedCents).toBeGreaterThan(0);
    expect(compare.extra.payoffDate! < compare.current.payoffDate!).toBe(true);
  });

  it("labels impossible payments", () => {
    const result = projectPayoff({
      balanceCents: 10000000,
      aprBps: 2400,
      paymentCents: 1000,
      frequency: "monthly",
      startDate: "2026-08-01",
    });
    expect(result.feasible).toBe(false);
  });

  it("applies extra to principal", () => {
    const split = splitPayment(1000000, 85000, 5000, 425, "biweekly");
    expect(split.extraPrincipalCents).toBeGreaterThan(0);
    expect(split.newBalanceCents).toBeLessThan(1000000);
  });
});

describe("legacy migration and import", () => {
  it("migrates old Budget Buckets backups", () => {
    const state = migrateLegacyPayload({
      selectedYear: 2026,
      selectedMonth: 7,
      buckets: [{ id: 1, name: "Groceries", budgeted: 600, spent: 0, period: "monthly" }],
      recurringIncome: [{ id: 2, name: "Paycheck", amount: 1500, frequency: "biweekly", nextDate: "2026-08-14" }],
      recurringBills: [{ id: 3, name: "Electric", amount: 180, frequency: "monthly", dueDay: 15 }],
      transactions: [{ id: 4, bucketId: 1, amount: 42.5, description: "Store", date: "2026-08-03" }],
    });
    expect(state.categories[0].name).toBe("Groceries");
    expect(state.categories[0].defaultBudgetCents).toBe(60000);
    expect(state.incomeSources[0].amountCents).toBe(150000);
    expect(state.incomeSources[0].frequency).toBe("biweekly");
    expect(state.bills[0].expectedCents).toBe(18000);
    expect(state.transactions[0].amountCents).toBe(4250);
    expect(state.currentMonth).toBe("2026-08");
  });

  it("round-trips JSON export", () => {
    const state = createEmptyState(new Date(2026, 7, 1));
    const preview = previewImport(exportJson(state));
    expect(preview.valid).toBe(true);
    expect(preview.state?.categories.length).toBe(state.categories.length);
  });

  it("reads marker-wrapped legacy files", () => {
    const text = `---BEGIN_BUDGET_BUCKETS_JSON---
{"buckets":[{"id":1,"name":"Gas","budgeted":100}],"recurringIncome":[],"recurringBills":[],"transactions":[]}
---END_BUDGET_BUCKETS_JSON---`;
    const preview = previewImport(text);
    expect(preview.valid).toBe(true);
    expect(preview.kind).toBe("legacy");
  });

  it("rejects garbage imports", () => {
    expect(previewImport("not json").valid).toBe(false);
  });

  it("merges without duplicating transaction ids", () => {
    const a = createEmptyState();
    const b = createEmptyState();
    b.transactions = [{
      id: "tx_1", date: "2026-08-01", description: "A", amountCents: 100, type: "expense",
      categoryId: null, accountId: null, toAccountId: null, notes: "", billId: null, debtId: null,
      bucketId: null, toBucketId: null, savingsGoalId: null, incomeSourceId: null, expenseId: null,
      occurrenceKey: null, extraPrincipalCents: 0, interestCents: 0, principalCents: 0,
      createdAt: "", updatedAt: "",
    }];
    a.transactions = [b.transactions[0]];
    const merged = mergeStates(a, b);
    expect(merged.transactions.filter((t) => t.id === "tx_1")).toHaveLength(1);
  });
});

describe("financial rules", () => {
  it("does not treat transfers as spending", () => {
    expect(isTransferLike("transfer")).toBe(true);
    expect(isTransferLike("bucket_contribution")).toBe(true);
    expect(isSpendingType("transfer")).toBe(false);
    expect(isSpendingType("expense")).toBe(true);
    expect(isSpendingType("bill_payment")).toBe(true);
  });

  it("computes month snapshot from transactions only for actuals", () => {
    const state = sanitizeState(createEmptyState(new Date(2026, 7, 1)));
    state.currentMonth = "2026-08";
    state.transactions = [{
      id: "t1", date: "2026-08-02", description: "Pay", amountCents: 150000, type: "income",
      categoryId: null, accountId: state.accounts[0].id, toAccountId: null, notes: "", billId: null, debtId: null,
      bucketId: null, toBucketId: null, savingsGoalId: null, incomeSourceId: null, expenseId: null,
      occurrenceKey: "income:x:2026-08-02", extraPrincipalCents: 0, interestCents: 0, principalCents: 0,
      createdAt: "", updatedAt: "",
    }, {
      id: "t2", date: "2026-08-03", description: "Groceries", amountCents: 34200, type: "expense",
      categoryId: state.categories.find((c) => c.name === "Groceries")?.id ?? null, accountId: state.accounts[0].id,
      toAccountId: null, notes: "", billId: null, debtId: null, bucketId: null, toBucketId: null, savingsGoalId: null,
      incomeSourceId: null, expenseId: null, occurrenceKey: null, extraPrincipalCents: 0, interestCents: 0, principalCents: 0,
      createdAt: "", updatedAt: "",
    }, {
      id: "t3", date: "2026-08-04", description: "To savings", amountCents: 10000, type: "savings_contribution",
      categoryId: null, accountId: state.accounts[0].id, toAccountId: state.accounts[1].id, notes: "", billId: null, debtId: null,
      bucketId: null, toBucketId: null, savingsGoalId: "g1", incomeSourceId: null, expenseId: null,
      occurrenceKey: null, extraPrincipalCents: 0, interestCents: 0, principalCents: 0,
      createdAt: "", updatedAt: "",
    }];
    expect(incomeReceived(state.transactions)).toBe(150000);
    expect(expenseTotal(state.transactions)).toBe(34200);
    const snap = monthSnapshot(state, "2026-08", "2026-08-10");
    expect(snap.incomeReceivedCents).toBe(150000);
    expect(snap.expensesCents).toBe(34200);
    expect(snap.savingsCents).toBe(10000);
  });

  it("locks archived months", () => {
    const state = createEmptyState();
    state.archives.push({
      monthKey: state.currentMonth,
      archivedAt: "2026-08-31",
      readOnly: true,
      summary: {
        incomeCents: 0, expensesCents: 0, billsCents: 0, savingsCents: 0, debtPaymentsCents: 0,
        budgetedCents: 0, actualCents: 0, endingAccountBalances: [], endingDebtBalances: [], categoryActuals: [],
      },
    });
    expect(isMonthLocked(state, state.currentMonth)).toBe(true);
  });
});
