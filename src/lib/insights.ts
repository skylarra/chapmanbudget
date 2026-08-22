import { addMonthsKey, formatMonthLabel, todayYmd } from "./dates";
import { formatMoney, formatPercent, type Cents } from "./money";
import {
  billOccurrences,
  compareMonths,
  expectedRemainingIncome,
  monthDebtReduction,
  monthSnapshot,
  overdueItems,
  upcomingWithinDays,
} from "./calculations";
import type { AppState } from "./types";

export interface Insight {
  id: string;
  text: string;
}

export function buildInsights(state: AppState, today = todayYmd()): Insight[] {
  const money = (cents: Cents) => formatMoney(cents, { currency: state.settings.currency });
  const snap = monthSnapshot(state, state.currentMonth, today);
  const { startYmd, endYmd } = { startYmd: state.currentMonth + "-01", endYmd: state.currentMonth + "-31" };
  const bills = billOccurrences(state, startYmd, endYmd.length === 10 ? endYmd : snap.monthKey + "-28", today);
  const paid = bills.filter((b) => b.status === "paid");
  const due7 = upcomingWithinDays(state, 7, today);
  const overdue = overdueItems(state, today);
  const debt = monthDebtReduction(state, state.currentMonth);
  const prevKey = addMonthsKey(state.currentMonth, -1);
  const comparison = compareMonths(state, prevKey, state.currentMonth);
  const remainingIncome = expectedRemainingIncome(state, state.currentMonth, today);
  const insights: Insight[] = [];

  insights.push({
    id: "remaining-budget",
    text:
      snap.remainingToBudgetCents >= 0
        ? `You have ${money(snap.remainingToBudgetCents)} remaining to budget this month.`
        : `You have budgeted ${money(-snap.remainingToBudgetCents)} more than income received this month.`,
  });

  insights.push({
    id: "bills-7",
    text: `You have ${money(due7.reduce((s, b) => s + b.amountCents, 0))} in bills due over the next 7 days.`,
  });

  if (bills.length) {
    const pct = (paid.length / bills.length) * 100;
    insights.push({
      id: "bills-paid",
      text: `You have paid ${formatPercent(pct, 0)} of your bills this month (${paid.length} of ${bills.length}).`,
    });
  }

  insights.push({
    id: "saved",
    text: `You saved ${money(Math.max(0, snap.savingsCents))} this month.`,
  });

  if (debt.principal > 0 || debt.total > 0) {
    insights.push({
      id: "debt-down",
      text: `Your debt decreased by ${money(debt.principal || debt.total)} this month.`,
    });
  }

  const grocery = comparison.categories.find((c) => c.name.toLowerCase().includes("groc"));
  if (grocery && grocery.diff !== 0) {
    insights.push({
      id: "grocery-delta",
      text:
        grocery.diff > 0
          ? `You spent ${money(grocery.diff)} more on ${grocery.name} than ${formatMonthLabel(prevKey)}.`
          : `You spent ${money(-grocery.diff)} less on ${grocery.name} than ${formatMonthLabel(prevKey)}.`,
    });
  }

  if (remainingIncome > 0) {
    insights.push({
      id: "remaining-income",
      text: `You still expect ${money(remainingIncome)} in remaining income this month.`,
    });
  }

  if (overdue.length) {
    insights.push({
      id: "overdue",
      text: `You have ${overdue.length} overdue item${overdue.length === 1 ? "" : "s"} totaling ${money(overdue.reduce((s, i) => s + i.amountCents, 0))}.`,
    });
  }

  const upcomingRecurring = due7.length;
  if (upcomingRecurring) {
    insights.push({
      id: "upcoming-recurring",
      text: `You have ${money(due7.reduce((s, i) => s + i.amountCents, 0))} in upcoming recurring bills this week.`,
    });
  }

  return insights;
}
