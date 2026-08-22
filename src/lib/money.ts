/** Integer minor units (cents). Never use floats for stored money. */

export type Cents = number;

export function toCents(value: unknown): Cents {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.\-]/g, "").replace(/(?!^)-/g, "");
    if (!cleaned || cleaned === "-" || cleaned === ".") return 0;
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n);
  }
  return 0;
}

/** Parse a user-entered dollar amount (e.g. "1,250.00") into cents. */
export function parseDollarsToCents(value: unknown): Cents {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.\-]/g, "").replace(/(?!^)-/g, "");
    if (!cleaned || cleaned === "-" || cleaned === ".") return 0;
    const n = Number.parseFloat(cleaned);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }
  return 0;
}

/** Convert a legacy dollar float into cents without double-rounding errors. */
export function dollarsToCents(dollars: unknown): Cents {
  const n = typeof dollars === "number" ? dollars : Number(dollars);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function centsToDollars(cents: Cents): number {
  return (Number(cents) || 0) / 100;
}

export function addCents(...values: Cents[]): Cents {
  return values.reduce((sum, v) => sum + (Number.isFinite(v) ? Math.round(v) : 0), 0);
}

export function clampCents(cents: Cents, min = 0): Cents {
  const n = Number.isFinite(cents) ? Math.round(cents) : 0;
  return n < min ? min : n;
}

export interface MoneyFormatOptions {
  currency?: string;
  locale?: string;
  signed?: boolean;
}

export function formatMoney(cents: Cents, options: MoneyFormatOptions = {}): string {
  const { currency = "USD", locale = "en-US", signed = false } = options;
  const n = (Number.isFinite(cents) ? cents : 0) / 100;
  const abs = Math.abs(n);
  let formatted: string;
  try {
    formatted = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs);
  } catch {
    formatted = `$${abs.toFixed(2)}`;
  }
  if (signed) {
    if (n > 0) return `+${formatted}`;
    if (n < 0) return `-${formatted}`;
    return formatted;
  }
  if (n < 0) return `-${formatted}`;
  return formatted;
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(digits)}%`;
}
