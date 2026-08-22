import { useStore } from "../store";
import { Card, Money } from "../components/ui";
import { LineChart } from "../components/Charts";
import { allAccountBalances, netWorth, totalDebt } from "../lib/calculations";

export function NetWorthPage() {
  const { state } = useStore();
  const nw = netWorth(state);
  const accounts = allAccountBalances(state);
  const history = state.netWorthSnapshots.slice(-18);

  return (
    <div className="stack">
      <Card>
        <div className="tiny muted">Net worth</div>
        <div className="value" style={{ fontSize: "2rem" }}><Money cents={nw.net} signed /></div>
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          <div>Assets <b><Money cents={nw.assets} /></b></div>
          <div>Liabilities <b><Money cents={nw.liabilities} /></b></div>
        </div>
        <p className="tiny muted">Assets − liabilities. Snapshots are stored when you archive a month.</p>
      </Card>
      {history.length > 1 ? (
        <Card>
          <h2>Net worth over time</h2>
          <LineChart labels={history.map((h) => h.monthKey)} values={history.map((h) => h.netCents)} />
        </Card>
      ) : null}
      <Card>
        <h2>Assets</h2>
        {accounts.filter((a) => a.type !== "credit").map((a) => (
          <div key={a.id} className="between item"><span>{a.name}</span><Money cents={a.balanceCents} /></div>
        ))}
        {state.buckets.map((b) => (
          <div key={b.id} className="between item"><span>Bucket: {b.name}</span><Money cents={b.balanceCents} /></div>
        ))}
      </Card>
      <Card>
        <h2>Liabilities</h2>
        {state.debts.map((d) => (
          <div key={d.id} className="between item"><span>{d.name}</span><Money cents={d.currentBalanceCents} /></div>
        ))}
        {state.debts.length === 0 ? <div className="muted">No debts. Total {totalDebt(state) === 0 ? "is zero." : ""}</div> : null}
      </Card>
    </div>
  );
}
