import type { AppState } from "./types";
import { hydrateFromUnknown, isLegacyBucketsFile, migrateLegacy, sanitizeState } from "./migrate";

export const MARKER_START = "---BEGIN_BUDGET_BUCKETS_JSON---";
export const MARKER_END = "---END_BUDGET_BUCKETS_JSON---";

export interface ImportPreview {
  valid: boolean;
  error?: string;
  kind: "boodget" | "legacy" | "unknown";
  counts: Record<string, number>;
  state?: AppState;
}

export function extractJsonFromText(text: string): unknown {
  const startIdx = text.indexOf(MARKER_START);
  const endIdx = text.indexOf(MARKER_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return JSON.parse(text.slice(startIdx + MARKER_START.length, endIdx).trim());
  }
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) return JSON.parse(trimmed.slice(first, last + 1));
    throw new Error("No JSON found in that file.");
  }
}

export function previewImport(text: string): ImportPreview {
  try {
    const raw = extractJsonFromText(text);
    if (isLegacyBucketsFile(raw)) {
      const state = migrateLegacy(raw);
      return { valid: true, kind: "legacy", counts: summarize(state), state };
    }
    const state = hydrateFromUnknown(raw);
    return { valid: true, kind: "boodget", counts: summarize(state), state };
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
    expenseBuckets: state.expenseBuckets.length,
    savingsBuckets: state.savingsBuckets.length,
    bills: state.bills.length,
    incomeSources: state.incomeSources.length,
    transactions: state.transactions.length,
  };
}

export function exportJson(state: AppState): string {
  return JSON.stringify(
    {
      ...state,
      app: "boodget",
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

export { sanitizeState };
