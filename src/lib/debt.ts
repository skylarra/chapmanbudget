import { addDays, parseYmd, toYmd } from "./dates";
import type { Cents } from "./money";
import { periodsPerYear } from "./recurrence";
import type { Frequency } from "./types";

const MAX_PAYMENTS = 720;

export interface PayoffInput {
  balanceCents: Cents;
  aprBps: number;
  paymentCents: Cents;
  extraCents?: Cents;
  frequency: Frequency;
  startDate: string;
}

export interface PayoffResult {
  feasible: boolean;
  reason?: string;
  payoffDate: string | null;
  payments: number;
  months: number;
  interestCents: Cents;
  principalCents: Cents;
  extraPrincipalCents: Cents;
  totalPaidCents: Cents;
}

export function periodRate(aprBps: number, frequency: Frequency): number {
  const apr = Math.max(0, aprBps) / 10000;
  const periods = Math.max(1, periodsPerYear(frequency));
  return apr / periods;
}

export function estimatedInterestForPeriod(balanceCents: Cents, aprBps: number, frequency: Frequency): Cents {
  const rate = periodRate(aprBps, frequency);
  return Math.round(Math.max(0, balanceCents) * rate);
}

export function splitPayment(
  balanceCents: Cents,
  paymentCents: Cents,
  extraCents: Cents,
  aprBps: number,
  frequency: Frequency,
  principalOnly = false,
): { interestCents: Cents; principalCents: Cents; extraPrincipalCents: Cents; newBalanceCents: Cents } {
  const balance = Math.max(0, balanceCents);
  if (principalOnly) {
    const principal = Math.min(balance, Math.max(0, paymentCents) + Math.max(0, extraCents));
    return {
      interestCents: 0,
      principalCents: principal,
      extraPrincipalCents: Math.min(balance, Math.max(0, extraCents)),
      newBalanceCents: balance - principal,
    };
  }
  const interest = estimatedInterestForPeriod(balance, aprBps, frequency);
  const scheduled = Math.max(0, paymentCents);
  const extra = Math.max(0, extraCents);
  const total = scheduled + extra;
  const principalFromScheduled = Math.max(0, scheduled - interest);
  const principal = Math.min(balance, principalFromScheduled + extra);
  const extraPrincipal = Math.min(Math.max(0, extra), principal);
  return {
    interestCents: Math.min(interest, total),
    principalCents: principal,
    extraPrincipalCents: extraPrincipal,
    newBalanceCents: Math.max(0, balance - principal),
  };
}

function monthsFromPayments(payments: number, frequency: Frequency): number {
  const perYear = periodsPerYear(frequency);
  return Math.ceil((payments / perYear) * 12);
}

function advanceDate(ymd: string, frequency: Frequency): string {
  const d = parseYmd(ymd) ?? new Date();
  if (frequency === "weekly") return toYmd(addDays(d, 7));
  if (frequency === "biweekly") return toYmd(addDays(d, 14));
  if (frequency === "quarterly") {
    d.setMonth(d.getMonth() + 3);
    return toYmd(d);
  }
  if (frequency === "annually") {
    d.setFullYear(d.getFullYear() + 1);
    return toYmd(d);
  }
  d.setMonth(d.getMonth() + 1);
  return toYmd(d);
}

export function projectPayoff(input: PayoffInput): PayoffResult {
  const empty: PayoffResult = {
    feasible: false,
    payoffDate: null,
    payments: 0,
    months: 0,
    interestCents: 0,
    principalCents: 0,
    extraPrincipalCents: 0,
    totalPaidCents: 0,
  };

  let balance = Math.max(0, Math.round(input.balanceCents || 0));
  if (balance <= 0) {
    return { ...empty, feasible: true, payoffDate: input.startDate, principalCents: 0 };
  }

  const scheduled = Math.max(0, Math.round(input.paymentCents || 0));
  const extra = Math.max(0, Math.round(input.extraCents || 0));
  const payment = scheduled + extra;
  if (payment <= 0) {
    return { ...empty, reason: "Payment must be greater than zero." };
  }

  let interestTotal = 0;
  let principalTotal = 0;
  let extraTotal = 0;
  let paidTotal = 0;
  let date = input.startDate;
  let payments = 0;

  for (let i = 0; i < MAX_PAYMENTS; i += 1) {
    const split = splitPayment(balance, scheduled, extra, input.aprBps, input.frequency);
    if (split.principalCents <= 0 && split.interestCents >= payment) {
      return { ...empty, reason: "Payment does not cover estimated interest; payoff is not possible at this rate." };
    }
    const applied = Math.min(balance + split.interestCents, scheduled + extra);
    interestTotal += split.interestCents;
    principalTotal += split.principalCents;
    extraTotal += split.extraPrincipalCents;
    paidTotal += applied;
    balance = split.newBalanceCents;
    payments += 1;
    if (balance <= 0) {
      return {
        feasible: true,
        payoffDate: date,
        payments,
        months: monthsFromPayments(payments, input.frequency),
        interestCents: interestTotal,
        principalCents: principalTotal,
        extraPrincipalCents: extraTotal,
        totalPaidCents: paidTotal,
      };
    }
    date = advanceDate(date, input.frequency);
  }

  return { ...empty, reason: "Payoff exceeds the calculation limit. Increase the payment to estimate a date." };
}

export interface ScenarioCompare {
  current: PayoffResult;
  extra: PayoffResult;
  monthsSaved: number;
  interestSavedCents: Cents;
}

export function comparePayoffScenarios(base: PayoffInput, extraPaymentCents: Cents): ScenarioCompare {
  const current = projectPayoff({ ...base, extraCents: 0 });
  const extra = projectPayoff({ ...base, extraCents: extraPaymentCents });
  const monthsSaved =
    current.feasible && extra.feasible ? Math.max(0, current.months - extra.months) : 0;
  const interestSavedCents =
    current.feasible && extra.feasible ? Math.max(0, current.interestCents - extra.interestCents) : 0;
  return { current, extra, monthsSaved, interestSavedCents };
}

export function formatPayoffDate(ymd: string | null, locale = "en-US"): string {
  if (!ymd) return "Unknown";
  const d = parseYmd(ymd);
  if (!d) return ymd;
  return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
}
