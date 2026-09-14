import { useStore } from "../store";
import { Button, Card, Money, Stat } from "../components/ui";
import {
  activeBillsSorted,
  billCoveredInBucket,
  daysUntilDue,
  nextExpectedIncome,
  safeToSpend,
  totalExpenseBalances,
  totalMoney,
  totalSavings,
} from "../lib/calculations";
import { formatNiceDate, todayYmd } from "../lib/dates";
import type { PageId } from "../components/Layout";

export function DashboardPage({
  onPage,
  onQuick,
}: {
  onPage: (id: PageId) => void;
  onQuick: (kind: "expense" | "income" | "transfer") => void;
}) {
  const { state } = useStore();
  const today = todayYmd();
  const safe = safeToSpend(state, today);
  const nextPay = nextExpectedIncome(state, today);
  const bills = activeBillsSorted(state).slice(0, 6);

  return (
    <div className="stack">
      <div className="card hero stat" style={{ background: "linear-gradient(160deg, var(--accent-soft), var(--bg-elev))" }}>
        <div className="label">Current available money</div>
        <div className="value"><Money cents={safe.availableCents} /></div>
        <div className="tiny muted">Unassigned cash ready to put into buckets. Total on hand: <Money cents={totalMoney(state)} /></div>
      </div>

      <div className="card">
        <h2>Safe to Spend</h2>
        <div className="value" style={{ fontSize: "1.8rem", fontWeight: 800 }}>
          <Money cents={safe.safeCents} />
        </div>
        <p className="muted">This is leftover unassigned money after setting aside upcoming bills and planned savings. It is a recommendation, not a lock.</p>
        <div className="stack formula">
          <div className="between"><span>Available</span><Money cents={safe.availableCents} /></div>
          <div className="between"><span>− Upcoming bill requirements</span><Money cents={-safe.upcomingBillsCents} /></div>
          <div className="between"><span>− Planned savings contributions</span><Money cents={-safe.plannedSavingsCents} /></div>
          <div className="between"><span>− Other reserved</span><Money cents={-safe.otherReservedCents} /></div>
          <div className="between"><b>= Safe to Spend</b><b><Money cents={safe.safeCents} /></b></div>
        </div>
      </div>

      <div className="grid grid-3">
        <Stat label="Reserved for bills" cents={safe.upcomingBillsCents} />
        <Stat label="Expense buckets" cents={totalExpenseBalances(state)} />
        <Stat label="Total savings" cents={totalSavings(state)} tone="pos" />
      </div>

      <Card>
        <h2>Next expected income</h2>
        {nextPay ? (
          <div className="between">
            <div>
              <div className="name">{nextPay.name}</div>
              <div className="tiny muted">{formatNiceDate(nextPay.nextDate)} · {nextPay.frequency.replace("_", " ")}</div>
            </div>
            <Money cents={nextPay.expectedCents} />
          </div>
        ) : (
          <div className="muted">Add an income source to see the next paycheck.</div>
        )}
        <div className="wrap" style={{ marginTop: 12 }}>
          <Button variant="primary" onClick={() => onPage("paycheck")}>Budget this paycheck</Button>
          <Button onClick={() => onPage("income")}>Income</Button>
        </div>
      </Card>

      <Card>
        <h2>Upcoming bills</h2>
        {bills.length === 0 ? <div className="muted">No active bills.</div> : bills.map((b) => {
          const days = daysUntilDue(b.nextDueDate, today);
          const funded = billCoveredInBucket(state, b);
          return (
            <div key={b.id} className="item">
              <div>
                <div className="name">{b.name}</div>
                <div className="tiny muted">
                  {formatNiceDate(b.nextDueDate)} · {days === 0 ? "due today" : days < 0 ? `${Math.abs(days)} days overdue` : `${days} days`}
                  {funded ? " · funded in bucket" : " · needs funding"}
                </div>
              </div>
              <Money cents={b.amountCents} />
            </div>
          );
        })}
        <Button variant="ghost" onClick={() => onPage("bills")}>All bills</Button>
      </Card>

      <div className="wrap">
        <Button variant="primary" onClick={() => onQuick("expense")}>Quick add transaction</Button>
        <Button onClick={() => onQuick("income")}>Quick add income</Button>
        <Button onClick={() => onQuick("transfer")}>Quick transfer</Button>
      </div>
    </div>
  );
}
