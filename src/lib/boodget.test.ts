import { describe, expect, it } from "vitest";
import { addCents, dollarsToCents, formatMoney, parseDollarsToCents } from "./money";
import { advanceFrom, listOccurrencesInRange } from "./recurrence";
import { createEmptyState } from "./defaults";
import { hydrateFromUnknown, migrateLegacy } from "./migrate";
import { exportJson, previewImport } from "./importExport";
import { groupBillsByDate, recommendedPerPaycheck, safeToSpend } from "./calculations";

describe("money", () => {
  it("parses and formats cents without float drift", () => {
    expect(parseDollarsToCents("1,250.00")).toBe(125000);
    expect(parseDollarsToCents("42.67")).toBe(4267);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
    expect(addCents(40000, -4267)).toBe(35733);
    expect(formatMoney(125000)).toBe("$1,250.00");
  });
});

describe("recurrence", () => {
  it("supports weekly, biweekly, monthly, quarterly, yearly, twice monthly, and once", () => {
    expect(listOccurrencesInRange({ frequency: "once", nextDate: "2026-09-15" }, "2026-09-01", "2026-09-30")).toEqual(["2026-09-15"]);
    expect(listOccurrencesInRange({ frequency: "weekly", nextDate: "2026-09-03" }, "2026-09-01", "2026-09-30").length).toBeGreaterThan(3);
    expect(listOccurrencesInRange({ frequency: "biweekly", nextDate: "2026-09-04" }, "2026-09-01", "2026-09-30")).toEqual(["2026-09-04", "2026-09-18"]);
    expect(listOccurrencesInRange({ frequency: "monthly", nextDate: "2026-09-01" }, "2026-09-01", "2026-11-02")).toEqual(["2026-09-01", "2026-10-01", "2026-11-01"]);
    expect(listOccurrencesInRange({ frequency: "quarterly", nextDate: "2026-01-15" }, "2026-01-01", "2026-12-31")).toHaveLength(4);
    expect(listOccurrencesInRange({ frequency: "annually", nextDate: "2026-06-15", startDate: "2026-06-15" }, "2026-01-01", "2027-12-31")).toEqual(["2026-06-15", "2027-06-15"]);
    expect(listOccurrencesInRange({ frequency: "twice_monthly", nextDate: "2026-09-01", secondDay: 15 }, "2026-09-01", "2026-09-30")).toEqual(["2026-09-01", "2026-09-15"]);
  });

  it("does not duplicate dates", () => {
    const dates = listOccurrencesInRange({ frequency: "biweekly", nextDate: "2026-08-07" }, "2026-08-01", "2026-12-31");
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("advances the next occurrence after the current one", () => {
    expect(advanceFrom("2026-09-17", "monthly")).toBe("2026-10-17");
    expect(advanceFrom("2026-09-04", "biweekly")).toBe("2026-09-18");
    expect(advanceFrom("2026-09-01", "twice_monthly", 15)).toBe("2026-09-15");
    expect(advanceFrom("2026-09-15", "twice_monthly", 1)).toBe("2026-10-01");
  });
});

describe("bill funding and safe to spend", () => {
  it("recommends monthly × 12 ÷ 26 for bi-weekly paychecks", () => {
    expect(recommendedPerPaycheck({ amountCents: 120000, frequency: "monthly" }, "biweekly")).toBe(Math.round((120000 * 12) / 26));
    expect(recommendedPerPaycheck({ amountCents: 10000, frequency: "biweekly" }, "biweekly")).toBe(10000);
  });

  it("computes Safe to Spend as available minus bills and planned savings", () => {
    const state = createEmptyState(new Date(2026, 8, 14));
    state.unassignedCents = 150000;
    state.bills = [{
      id: "b1", name: "Electric", amountCents: 14500, frequency: "monthly", nextDueDate: "2026-09-14",
      secondDay: null, bucketId: null, active: true, notes: "", createdAt: "", updatedAt: "",
    }];
    state.savingsBuckets = state.savingsBuckets.map((s, i) => i === 0 ? { ...s, autoContributionCents: 7500, autoFrequency: "biweekly" } : s);
    const safe = safeToSpend(state, "2026-09-14");
    expect(safe.availableCents).toBe(150000);
    expect(safe.upcomingBillsCents).toBe(14500);
    expect(safe.plannedSavingsCents).toBe(7500);
    expect(safe.safeCents).toBe(150000 - 14500 - 7500);
  });

  it("groups bills by next due date with closest first", () => {
    const groups = groupBillsByDate([
      { id: "a", name: "Mortgage", amountCents: 125000, frequency: "monthly", nextDueDate: "2026-09-20", secondDay: null, bucketId: null, active: true, notes: "", createdAt: "", updatedAt: "" },
      { id: "b", name: "Electric", amountCents: 14500, frequency: "monthly", nextDueDate: "2026-09-14", secondDay: null, bucketId: null, active: true, notes: "", createdAt: "", updatedAt: "" },
      { id: "c", name: "Internet", amountCents: 6500, frequency: "monthly", nextDueDate: "2026-09-21", secondDay: null, bucketId: null, active: true, notes: "", createdAt: "", updatedAt: "" },
    ], "2026-09-14");
    expect(groups.map((g) => g.label)).toEqual(["TODAY", "SEP 20", "SEP 21"]);
    expect(groups[0].bills[0].name).toBe("Electric");
  });
});

describe("backup and migration", () => {
  it("round-trips JSON backups", () => {
    const state = createEmptyState(new Date(2026, 8, 1));
    const preview = previewImport(exportJson(state));
    expect(preview.valid).toBe(true);
    expect(preview.state?.expenseBuckets.length).toBe(state.expenseBuckets.length);
  });

  it("imports legacy Budget Buckets files", () => {
    const text = `---BEGIN_BUDGET_BUCKETS_JSON---
{"buckets":[{"id":1,"name":"Groceries","budgeted":400}],"recurringIncome":[{"id":2,"name":"Paycheck","amount":1500,"frequency":"biweekly","nextDate":"2026-09-18"}],"recurringBills":[{"id":3,"name":"Electric","amount":145,"frequency":"monthly","dueDay":14}],"transactions":[{"id":4,"bucketId":1,"amount":42.67,"description":"Store","date":"2026-09-03"}]}
---END_BUDGET_BUCKETS_JSON---`;
    const preview = previewImport(text);
    expect(preview.valid).toBe(true);
    expect(preview.kind).toBe("legacy");
    expect(preview.state?.expenseBuckets[0].name).toBe("Groceries");
    expect(preview.state?.transactions[0].amountCents).toBe(4267);
    expect(preview.state?.transactions[0].type).toBe("expense");
  });

  it("rejects garbage files", () => {
    expect(previewImport("not json").valid).toBe(false);
  });

  it("migrates legacy payload amounts to cents", () => {
    const state = migrateLegacy({
      buckets: [{ id: 1, name: "Gas", budgeted: 90 }],
      recurringIncome: [],
      recurringBills: [],
      transactions: [],
    });
    expect(state.expenseBuckets[0].targetCents).toBe(9000);
  });

  it("hydrates v9 state and ignores unknown fields", () => {
    const state = hydrateFromUnknown({ version: 9, unassignedCents: 30100, expenseBuckets: [], savingsBuckets: [], bills: [], incomeSources: [], transactions: [], months: {}, currentMonth: "2026-09" });
    expect(state.unassignedCents).toBe(30100);
    expect(state.version).toBe(9);
  });
});
