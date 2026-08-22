import { useMemo, useState } from "react";
import { useStore } from "../store";
import { Card, Money, Progress, Stat, Button, StatusPill, Empty } from "../components/ui";
import { Modal } from "../components/Layout";
import { buildInsights } from "../lib/insights";
import {
  billOccurrences,
  categoryRows,
  debtFreeProjection,
  expectedRemainingIncome,
  monthSnapshot,
  nextBill,
  nextPaycheck,
  overdueItems,
  upcomingWithinDays,
} from "../lib/calculations";
import { monthBounds, todayYmd, formatNiceDate } from "../lib/dates";
import { exportJson } from "../lib/importExport";
import type { PageId } from "../components/Layout";

export function DashboardPage({ onPage, onQuick }: { onPage: (id: PageId) => void; onQuick: (kind: string) => void }) {
  const store = useStore();
  const { state, archiveMonth, markBackupNow } = store;
  const today = todayYmd();
  const snap = useMemo(() => monthSnapshot(state, state.currentMonth, today), [state, today]);
  const insights = useMemo(() => buildInsights(state, today), [state, today]);
  const { startYmd, endYmd } = monthBounds(state.currentMonth);
  const bills = billOccurrences(state, startYmd, endYmd, today);
  const cats = categoryRows(state, state.currentMonth);
  const budgeted = cats.reduce((s, c) => s + c.budgetedCents, 0);
  const spent = cats.reduce((s, c) => s + c.spentCents, 0);
  const savingsTarget = state.savingsGoals.reduce((s, g) => s + g.targetCents, 0) || state.buckets.reduce((s, b) => s + b.goalCents, 0);
  const savingsHave = state.savingsGoals.reduce((s, g) => s + g.currentCents, 0) + state.buckets.reduce((s, b) => s + b.balanceCents, 0);
  const debt = debtFreeProjection(state, today);
  const nextPay = nextPaycheck(state, today);
  const nextB = nextBill(state, today);
  const due7 = upcomingWithinDays(state, 7, today);
  const overdue = overdueItems(state, today);
  const paidBills = bills.filter((b) => b.status === "paid").length;
  const [archiveOpen, setArchiveOpen] = useState(false);

  const download = () => {
    const blob = new Blob([exportJson(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-backup-${state.currentMonth}.json`;
    a.click();
    URL.revokeObjectURL(url);
    markBackupNow();
  };

  return (
    <div className="stack">
      <div className="card" style={{ background: "linear-gradient(160deg, var(--accent-soft), var(--bg-elev))" }}>
        <div className="tiny muted">This month</div>
        <div className="between" style={{ alignItems: "flex-end" }}>
          <div>
            <div className="tiny muted">Available</div>
            <div className="value" style={{ fontSize: "2rem", fontWeight: 800 }}>
              <Money cents={snap.availableCents} />
            </div>
          </div>
          <Button variant="primary" onClick={() => onQuick("transaction")}>Add transaction</Button>
        </div>
        <div className="grid grid-4" style={{ marginTop: 16 }}>
          <Mini label="Income" cents={snap.incomeReceivedCents} />
          <Mini label="Bills" cents={snap.billsDueCents} />
          <Mini label="Expenses" cents={snap.expensesCents} />
          <Mini label="Savings" cents={snap.savingsCents} />
        </div>
        <div className="tiny muted" style={{ marginTop: 8 }}>Debt payments: <Money cents={snap.debtPaymentsCents} /></div>
      </div>

      <div className="grid grid-4">
        <Stat label="Income received" cents={snap.incomeReceivedCents} tone="pos" />
        <Stat label="Expected remaining" cents={expectedRemainingIncome(state, state.currentMonth, today)} />
        <Stat label="Bills due" cents={snap.billsDueCents} tone="neg" />
        <Stat label="Remaining to budget" cents={snap.remainingToBudgetCents} tone={snap.remainingToBudgetCents >= 0 ? "pos" : "neg"} />
        <Stat label="Allocated to buckets" cents={snap.bucketAllocatedCents} />
        <Stat label="Unallocated" cents={snap.unallocatedCents} />
        <Stat label="Total expenses" cents={snap.expensesCents} />
        <Stat label="Savings this month" cents={snap.savingsCents} tone="pos" />
      </div>

      <div className="grid grid-2">
        <Card>
          <h2>Upcoming</h2>
          <div className="stack">
            <UpcomingRow label="Next paycheck" value={nextPay ? `${nextPay.name} · ${formatNiceDate(nextPay.date)}` : "None scheduled"} cents={nextPay?.amountCents} />
            <UpcomingRow label="Next bill" value={nextB ? `${nextB.name} · ${formatNiceDate(nextB.date)}` : "None scheduled"} cents={nextB?.amountCents} />
            <div>
              <div className="tiny muted">Bills due within 7 days</div>
              {due7.length === 0 ? <div className="muted">None</div> : due7.map((b) => (
                <div key={b.key} className="between" style={{ marginTop: 6 }}>
                  <span>{b.name} · {formatNiceDate(b.date)}</span>
                  <Money cents={b.amountCents} />
                </div>
              ))}
            </div>
            {overdue.length > 0 ? (
              <div>
                <div className="tiny muted">Overdue</div>
                {overdue.slice(0, 6).map((o) => (
                  <div key={o.key} className="between" style={{ marginTop: 6 }}>
                    <span>{o.name} · {formatNiceDate(o.date)} <StatusPill status={o.status} /></span>
                    <Money cents={o.amountCents} />
                  </div>
                ))}
              </div>
            ) : null}
            <Button variant="ghost" onClick={() => onPage("bills")}>Open bills</Button>
          </div>
        </Card>
        <Card>
          <h2>Progress</h2>
          <div className="stack">
            <div>
              <div className="between"><span>Monthly budget</span><span><Money cents={spent} /> / <Money cents={budgeted} /></span></div>
              <Progress value={spent} max={Math.max(1, budgeted)} />
            </div>
            <div>
              <div className="between"><span>Savings</span><span><Money cents={savingsHave} /> / <Money cents={savingsTarget || savingsHave} /></span></div>
              <Progress value={savingsHave} max={Math.max(1, savingsTarget || savingsHave || 1)} />
            </div>
            <div>
              <div className="between"><span>Debt payoff</span><span>{debt.progress.toFixed(1)}%</span></div>
              <Progress value={debt.progress} max={100} />
            </div>
            <div className="between"><span>Bills paid</span><span>{paidBills} / {bills.length}</span></div>
            <div className="between"><span>Income received vs expected</span><span><Money cents={snap.incomeReceivedCents} /> / <Money cents={snap.incomeExpectedCents} /></span></div>
          </div>
        </Card>
      </div>

      <Card>
        <h2>What to know</h2>
        <div className="stack">
          {insights.map((i) => <div key={i.id} className="item"><div>{i.text}</div></div>)}
        </div>
      </Card>

      <Card>
        <h2>Quick actions</h2>
        <div className="wrap">
          <Button variant="primary" onClick={() => onQuick("transaction")}>Add transaction</Button>
          <Button onClick={() => onQuick("income")}>Add income</Button>
          <Button onClick={() => onQuick("bill")}>Add bill</Button>
          <Button onClick={() => onQuick("expense")}>Add expense</Button>
          <Button onClick={() => onQuick("savings")}>Add savings contribution</Button>
          <Button onClick={() => onQuick("debt")}>Add debt payment</Button>
          <Button onClick={() => onQuick("transfer")}>Transfer money</Button>
          <Button onClick={() => setArchiveOpen(true)}>Archive month</Button>
          <Button onClick={download}>Export data</Button>
        </div>
      </Card>

      <Modal open={archiveOpen} title="Archive this month?" onClose={() => setArchiveOpen(false)}>
        <p>This snapshot will be kept exactly as it is. The month becomes read-only unless you unlock it later.</p>
        <div className="stack">
          <div className="between"><span>Income</span><Money cents={snap.incomeReceivedCents} /></div>
          <div className="between"><span>Expenses</span><Money cents={snap.expensesCents} /></div>
          <div className="between"><span>Bills paid</span><Money cents={snap.billsPaidCents} /></div>
          <div className="between"><span>Savings</span><Money cents={snap.savingsCents} /></div>
          <div className="between"><span>Debt payments</span><Money cents={snap.debtPaymentsCents} /></div>
          <div className="between"><span>Budgeted vs actual</span><span><Money cents={snap.budgetedCents} /> / <Money cents={snap.expensesCents + snap.billsPaidCents} /></span></div>
        </div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <Button variant="ghost" onClick={() => setArchiveOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={() => { archiveMonth(); setArchiveOpen(false); }}>Archive month</Button>
        </div>
      </Modal>
    </div>
  );
}

function Mini({ label, cents }: { label: string; cents: number }) {
  return (
    <div>
      <div className="tiny muted">{label}</div>
      <div style={{ fontWeight: 800 }}><Money cents={cents} /></div>
    </div>
  );
}

function UpcomingRow({ label, value, cents }: { label: string; value: string; cents?: number }) {
  return (
    <div className="between">
      <div>
        <div className="tiny muted">{label}</div>
        <div>{value}</div>
      </div>
      {cents != null ? <Money cents={cents} /> : null}
    </div>
  );
}

export function EmptyHint() {
  return <Empty title="Nothing here yet" hint="Add your income and bills to see a live snapshot." />;
}
