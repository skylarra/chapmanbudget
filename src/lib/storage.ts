import { STORAGE_KEY } from "./types";
import type { AppState } from "./types";
import { createEmptyState } from "./defaults";
import { hydrateFromUnknown, migrateLegacyPayload } from "./migrate";

const LEGACY_KEYS = ["buckets", "recurringIncome", "recurringBills", "transactions", "selectedMonth", "selectedYear"];

export function loadState(): { state: AppState; recovered: boolean; error?: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { state: hydrateFromUnknown(JSON.parse(raw)), recovered: false };
    }
  } catch (err) {
    return {
      state: createEmptyState(),
      recovered: true,
      error: "Saved data looked damaged, so a blank budget was opened. Use Import in Settings if you have a backup.",
    };
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
      const state = migrateLegacyPayload(payload);
      persistState(state);
      return { state, recovered: false };
    }
  } catch {
    return {
      state: createEmptyState(),
      recovered: true,
      error: "Could not migrate the previous budget data. A new budget was created.",
    };
  }

  return { state: createEmptyState(), recovered: false };
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
    // Quota or private mode — UI can still function in-memory.
  }
}

export function writeEmergencyBackup(state: AppState): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}:pre-import`, JSON.stringify({ at: new Date().toISOString(), state }));
  } catch {
    /* ignore */
  }
}

export function readEmergencyBackup(): AppState | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:pre-import`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return hydrateFromUnknown(parsed.state ?? parsed);
  } catch {
    return null;
  }
}

export function clearLegacyKeys(): void {
  for (const key of LEGACY_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
