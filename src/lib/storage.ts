import { PREV_STORAGE_KEY, STORAGE_KEY } from "./types";
import type { AppState } from "./types";
import { createEmptyState } from "./defaults";
import { hydrateFromUnknown, migrateLegacy } from "./migrate";

export function loadState(): { state: AppState; error?: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { state: hydrateFromUnknown(JSON.parse(raw)) };
  } catch {
    return {
      state: createEmptyState(),
      error: "Saved data looked damaged, so a blank budget was opened. Restore a backup from Settings if you have one.",
    };
  }

  try {
    const prev = localStorage.getItem(PREV_STORAGE_KEY);
    if (prev) {
      const state = hydrateFromUnknown(JSON.parse(prev));
      persistState(state);
      return { state };
    }
  } catch {
    /* fall through */
  }

  try {
    if (localStorage.getItem("buckets") || localStorage.getItem("recurringIncome")) {
      const payload = {
        buckets: readJson("buckets", []),
        recurringIncome: readJson("recurringIncome", []),
        recurringBills: readJson("recurringBills", []),
        transactions: readJson("transactions", []),
        selectedMonth: readJson("selectedMonth", new Date().getMonth()),
        selectedYear: readJson("selectedYear", new Date().getFullYear()),
      };
      const state = migrateLegacy(payload);
      persistState(state);
      return { state };
    }
  } catch {
    return { state: createEmptyState(), error: "Could not migrate previous budget data." };
  }

  return { state: createEmptyState() };
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

export function persistState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota */
  }
}

export function writeEmergencyBackup(state: AppState): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}:pre-import`, JSON.stringify({ at: new Date().toISOString(), state }));
  } catch {
    /* ignore */
  }
}
