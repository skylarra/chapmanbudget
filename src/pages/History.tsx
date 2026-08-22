import { useState } from "react";
import { useStore } from "../store";
import { Button, Card, Empty, Field, Money } from "../components/ui";
import { Confirm } from "../components/Layout";
import { BarChart } from "../components/Charts";
import { addMonthsKey, formatMonthLabel, monthBounds } from "../lib/dates";
import { compareMonths, historySeries, monthSnapshot } from "../lib/calculations";

export function HistoryPage() {
  const { state, setMonth, unlockMonth, archiveMonth } = useStore();
  const [range, setRange] = useState("12");
  const [customFrom, setCustomFrom] = useState(addMonthsKey(state.currentMonth, -2));
  const [customTo, setCustomTo] = useState(state.currentMonth);
  const [a, setA] = useState(addMonthsKey(state.currentMonth, -1));
  const [b, setB] = useState(state.currentMonth);
  const [unlock, setUnlock] = useState<string | null>(null);

  const months = Number(range) || 12;
  const series = historySeries(state, range === "custom" ? 12 : months);
  const comparison = compareMonths(state, a, b);
  const viewing = monthSnapshot(state, state.currentMonth);

  return (
    <div className="stack">
      <Card>
        <h2>Trends</h2>
        <Field label="Range">
          <select className="input" value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="1">Current month</option>
            <option value="2">Previous + current</option>
            <option value="3">Last 3 months</option>
            <option value="6">Last 6 months</option>
            <option value="12">Last 12 months</option>
            <option value="custom">Custom</option>
          </select>
        </Field>
        {range === "custom" ? (
          <div className="form-grid">
            <Field label="From"><input className="input" type="month" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></Field>
            <Field label="To"><input className="input" type="month" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></Field>
          </div>
        ) : null}
        <BarChart
          labels={series.map((s) => s.label)}
          series={[
            { name: "Income", values: series.map((s) => s.income), color: "#1f6f5b" },
            { name: "Expenses", values: series.map((s) => s.expenses), color: "#b42318" },
            { name: "Savings", values: series.map((s) => s.savings), color: "#2c6e9a" },
          ]}
        />
        <div className="tiny muted">Income vs expenses, savings growth, and cash flow by month.</div>
      </Card>

      <Card>
        <h2>Month-to-month comparison</h2>
        <div className="form-grid">
          <Field label="Earlier"><input className="input" type="month" value={a} onChange={(e) => setA(e.target.value)} /></Field>
          <Field label="Later"><input className="input" type="month" value={b} onChange={(e) => setB(e.target.value)} /></Field>
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="between"><span>Income</span><span><Money cents={comparison.incomeDiff} signed /></span></div>
          <div className="between"><span>Expenses</span><span><Money cents={comparison.expenseDiff} signed /></span></div>
          <div className="between"><span>Savings</span><span><Money cents={comparison.savingsDiff} signed /></span></div>
          <div className="between"><span>Debt payments</span><span><Money cents={comparison.debtDiff} signed /></span></div>
        </div>
        {comparison.categories.map((c) => (
          <div key={c.id} className="item">
            <div>
              <div className="name">{c.name}</div>
              <div className="tiny muted">{formatMonthLabel(a)}: <Money cents={c.a} /> · {formatMonthLabel(b)}: <Money cents={c.b} /></div>
            </div>
            <Money cents={c.diff} signed />
          </div>
        ))}
      </Card>

      <Card>
        <h2>Archived months</h2>
        <p className="muted">Open a month to inspect it exactly as it was. Archived months are read-only until unlocked.</p>
        <Button onClick={() => archiveMonth()}>Archive current month</Button>
        {state.archives.length === 0 ? <Empty title="No archives yet" /> : state.archives.slice().reverse().map((ar) => (
          <div key={ar.monthKey} className="item">
            <div>
              <div className="name">{formatMonthLabel(ar.monthKey)}</div>
              <div className="tiny muted">
                Income <Money cents={ar.summary.incomeCents} /> · expenses <Money cents={ar.summary.expensesCents} /> · {ar.readOnly ? "read-only" : "editable"}
              </div>
            </div>
            <div className="row">
              <Button variant="small" onClick={() => setMonth(ar.monthKey)}>Open</Button>
              {ar.readOnly ? <Button variant="small" onClick={() => setUnlock(ar.monthKey)}>Unlock</Button> : null}
            </div>
          </div>
        ))}
      </Card>

      <Card>
        <h2>Viewing {formatMonthLabel(state.currentMonth)}</h2>
        <div className="grid grid-3">
          <div>Income <b><Money cents={viewing.incomeReceivedCents} /></b></div>
          <div>Bills <b><Money cents={viewing.billsPaidCents} /></b></div>
          <div>Expenses <b><Money cents={viewing.expensesCents} /></b></div>
        </div>
      </Card>

      <Confirm open={!!unlock} title="Allow editing this archived month?" body="The snapshot stays, but you can change transactions again." confirmLabel="Unlock" onClose={() => setUnlock(null)} onConfirm={() => { if (unlock) unlockMonth(unlock); setUnlock(null); }} />
    </div>
  );
}

void monthBounds;
