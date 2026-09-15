import { formatMoney, formatPercent, type Cents } from "../lib/money";
import { FREQUENCY_LABEL, type Frequency } from "../lib/types";
import { useStore } from "../store";
import type { ReactNode } from "react";

export function Money({ cents, signed = false, className = "" }: { cents: Cents; signed?: boolean; className?: string }) {
  const { state } = useStore();
  const cls = className || (cents < 0 ? "neg" : signed && cents > 0 ? "pos" : "");
  return <span className={cls}>{formatMoney(cents, { currency: state.settings.currency, locale: state.settings.locale, signed })}</span>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Stat({ label, cents, sub, tone }: { label: string; cents: Cents; sub?: string; tone?: "pos" | "neg" | "" }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className={`value ${tone === "pos" ? "pos" : tone === "neg" ? "neg" : ""}`}>
        <Money cents={cents} />
      </div>
      {sub ? <div className="tiny muted">{sub}</div> : null}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "default",
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "ghost" | "small";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const extra = variant === "default" ? "" : variant === "small" ? "small" : variant;
  return (
    <button type={type} className={`btn ${extra}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`field ${className}`}>
      {label}
      {children}
    </label>
  );
}

export function Pill({ children, tone = "" }: { children: ReactNode; tone?: "good" | "warn" | "bad" | "" }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const over = max > 0 && value > max;
  return (
    <div className={`progress ${over ? "over" : ""}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${over ? 100 : pct}%` }} />
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <div style={{ fontWeight: 750 }}>{title}</div>
      {hint ? <div className="tiny muted" style={{ marginTop: 6 }}>{hint}</div> : null}
    </div>
  );
}

export function Percent({ value }: { value: number }) {
  return <span>{formatPercent(value)}</span>;
}

export const FREQ_OPTIONS = (Object.keys(FREQUENCY_LABEL) as Frequency[]).map((value) => ({
  value,
  label: FREQUENCY_LABEL[value],
}));
