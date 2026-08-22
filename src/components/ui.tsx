import React from "react";
import { formatMoney, formatPercent, type Cents } from "../lib/money";
import { useStore } from "../store";

export function Money({ cents, signed = false, className = "" }: { cents: Cents; signed?: boolean; className?: string }) {
  const { state } = useStore();
  const cls = className || (cents < 0 ? "neg" : signed && cents > 0 ? "pos" : "");
  return <span className={cls}>{formatMoney(cents, { currency: state.settings.currency, locale: state.settings.locale, signed })}</span>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
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
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "ghost" | "small";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const extra = variant === "default" ? "" : variant === "small" ? "small" : variant;
  return (
    <button type={type} className={`btn ${extra} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`field ${className}`}>
      {label}
      {children}
    </label>
  );
}

export function Pill({ children, tone = "" }: { children: React.ReactNode; tone?: "good" | "warn" | "bad" | "info" | "" }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const over = max > 0 && value > max;
  return (
    <div className={`progress ${over ? "over" : ""}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
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

export function StatusPill({ status }: { status: string }) {
  const tone = status === "paid" || status === "received" ? "good" : status === "overdue" || status === "late" ? "bad" : status === "due" ? "warn" : "info";
  return <Pill tone={tone}>{status.replace("_", " ")}</Pill>;
}

export function Percent({ value }: { value: number }) {
  return <span>{formatPercent(value)}</span>;
}

export const FREQ_OPTIONS = [
  { value: "once", label: "One-time" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
];
