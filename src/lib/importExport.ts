import { LEGACY_MARKER_END, LEGACY_MARKER_START, type AppState, type Transaction } from "./types";
import { hydrateFromUnknown, isLegacyPayload, migrateLegacyPayload, sanitizeState } from "./migrate";
import { formatMoney } from "./money";
import { createEmptyState } from "./defaults";

export interface ImportPreview {
  valid: boolean;
  error?: string;
  kind: "current" | "legacy" | "unknown";
  counts: Record<string, number>;
  exportedAt?: string;
  state?: AppState;
}

export function extractJsonFromText(text: string): unknown {
  const startIdx = text.indexOf(LEGACY_MARKER_START);
  const endIdx = text.indexOf(LEGACY_MARKER_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return JSON.parse(text.slice(startIdx + LEGACY_MARKER_START.length, endIdx).trim());
  }
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw new Error("No JSON found in that file.");
  }
}

export function previewImport(text: string): ImportPreview {
  try {
    const raw = extractJsonFromText(text);
    if (isLegacyPayload(raw)) {
      const state = migrateLegacyPayload(raw);
      return {
        valid: true,
        kind: "legacy",
        exportedAt: typeof (raw as { exportedAt?: string }).exportedAt === "string" ? (raw as { exportedAt: string }).exportedAt : undefined,
        counts: summarize(state),
        state,
      };
    }
    const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    if (!rec || typeof rec !== "object") {
      return { valid: false, kind: "unknown", error: "File is not a budget backup.", counts: {} };
    }
    const state = sanitizeState(rec);
    return {
      valid: true,
      kind: "current",
      exportedAt: typeof rec.exportedAt === "string" ? rec.exportedAt : undefined,
      counts: summarize(state),
      state,
    };
  } catch (err) {
    return {
      valid: false,
      kind: "unknown",
      error: err instanceof Error ? err.message : "Could not read that file.",
      counts: {},
    };
  }
}

function summarize(state: AppState): Record<string, number> {
  return {
    accounts: state.accounts.length,
    categories: state.categories.length,
    buckets: state.buckets.length,
    incomeSources: state.incomeSources.length,
    bills: state.bills.length,
    expenses: state.expenses.length,
    debts: state.debts.length,
    transactions: state.transactions.length,
    savingsGoals: state.savingsGoals.length,
    archives: state.archives.length,
  };
}

export function exportJson(state: AppState): string {
  return JSON.stringify(
    {
      ...state,
      app: "chapmanbudget",
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

export function exportLegacyCompatible(state: AppState): string {
  const payload = {
    version: state.version,
    exportedAt: new Date().toISOString(),
    buckets: state.categories.map((c) => ({
      id: c.id,
      name: c.name,
      budgeted: c.defaultBudgetCents / 100,
      spent: 0,
      period: "monthly",
    })),
    recurringIncome: state.incomeSources.map((i) => ({
      id: i.id,
      name: i.name,
      amount: i.amountCents / 100,
      frequency: i.frequency === "annually" ? "yearly" : i.frequency,
      nextDate: i.nextDate,
    })),
    recurringBills: state.bills.map((b) => ({
      id: b.id,
      name: b.name,
      amount: b.expectedCents / 100,
      frequency: b.frequency === "annually" ? "yearly" : b.frequency,
      nextDate: b.dueDate,
    })),
    transactions: state.transactions.map((t) => ({
      id: t.id,
      bucketId: t.categoryId,
      amount: t.amountCents / 100,
      description: t.description,
      date: t.date,
    })),
  };
  return `📌 BUDGET DATA BACKUP\nThis file contains a complete backup.\n\n${LEGACY_MARKER_START}\n${JSON.stringify(payload, null, 2)}\n${LEGACY_MARKER_END}\n`;
}

export function mergeStates(current: AppState, incoming: AppState): AppState {
  const mergeById = <T extends { id: string }>(a: T[], b: T[]): T[] => {
    const map = new Map(a.map((x) => [x.id, x]));
    for (const item of b) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return [...map.values()];
  };

  const txKeys = new Set(current.transactions.map(txKey));
  const txs = [...current.transactions];
  for (const t of incoming.transactions) {
    const k = txKey(t);
    if (txKeys.has(k) || current.transactions.some((x) => x.id === t.id)) continue;
    txKeys.add(k);
    txs.push(t);
  }

  return sanitizeState({
    ...current,
    accounts: mergeById(current.accounts, incoming.accounts),
    categories: mergeById(current.categories, incoming.categories),
    buckets: mergeById(current.buckets, incoming.buckets),
    incomeSources: mergeById(current.incomeSources, incoming.incomeSources),
    bills: mergeById(current.bills, incoming.bills),
    expenses: mergeById(current.expenses, incoming.expenses),
    debts: mergeById(current.debts, incoming.debts),
    savingsGoals: mergeById(current.savingsGoals, incoming.savingsGoals),
    financialGoals: mergeById(current.financialGoals, incoming.financialGoals),
    transactions: txs,
    occurrences: { ...incoming.occurrences, ...current.occurrences },
    budgetMonths: { ...incoming.budgetMonths, ...current.budgetMonths },
    archives: mergeById(
      current.archives.map((a) => ({ ...a, id: a.monthKey })),
      incoming.archives.map((a) => ({ ...a, id: a.monthKey })),
    ).map(({ id: _id, ...rest }) => rest),
    paycheckPlans: mergeById(current.paycheckPlans, incoming.paycheckPlans),
    netWorthSnapshots: [...current.netWorthSnapshots, ...incoming.netWorthSnapshots.filter((s) => !current.netWorthSnapshots.some((c) => c.date === s.date))],
  });
}

function txKey(t: Transaction): string {
  return `${t.type}|${t.date}|${t.amountCents}|${t.description}|${t.categoryId ?? ""}|${t.occurrenceKey ?? ""}`;
}

export function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function transactionsToCsv(state: AppState): string {
  const header = ["date", "description", "type", "amount", "category", "account", "notes"];
  const lines = [header.join(",")];
  const cat = (id: string | null) => state.categories.find((c) => c.id === id)?.name ?? "";
  const acct = (id: string | null) => state.accounts.find((a) => a.id === id)?.name ?? "";
  for (const t of state.transactions.slice().sort((a, b) => b.date.localeCompare(a.date))) {
    lines.push(
      [
        t.date,
        csvEscape(t.description),
        t.type,
        formatMoney(t.amountCents, { currency: state.settings.currency }),
        csvEscape(cat(t.categoryId)),
        csvEscape(acct(t.accountId)),
        csvEscape(t.notes),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function billsToCsv(state: AppState): string {
  const header = ["name", "amount", "frequency", "dueDate", "autopay", "active"];
  const lines = [header.join(",")];
  for (const b of state.bills) {
    lines.push(
      [csvEscape(b.name), formatMoney(b.expectedCents, { currency: state.settings.currency }), b.frequency, b.dueDate, b.autopay ? "yes" : "no", b.active ? "yes" : "no"].join(","),
    );
  }
  return lines.join("\n");
}

export function debtsToCsv(state: AppState): string {
  const header = ["name", "type", "balance", "apr", "minimum", "planned", "extra", "frequency"];
  const lines = [header.join(",")];
  for (const d of state.debts) {
    lines.push(
      [
        csvEscape(d.name),
        d.type,
        formatMoney(d.currentBalanceCents, { currency: state.settings.currency }),
        (d.aprBps / 100).toFixed(2) + "%",
        formatMoney(d.minimumPaymentCents, { currency: state.settings.currency }),
        formatMoney(d.plannedPaymentCents, { currency: state.settings.currency }),
        formatMoney(d.extraPaymentCents, { currency: state.settings.currency }),
        d.frequency,
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function emptyState(): AppState {
  return createEmptyState();
}

export { hydrateFromUnknown };
