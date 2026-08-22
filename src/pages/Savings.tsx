import { useState } from "react";
import { useStore } from "../store";
import { Button, Card, Empty, Field, FREQ_OPTIONS, Money, Progress } from "../components/ui";
import { Modal } from "../components/Layout";
import { createId } from "../lib/ids";
import { stamp } from "../lib/defaults";
import { parseDollarsToCents } from "../lib/money";
import { suggestedContribution } from "../lib/calculations";
import { savingsNet, monthSnapshot } from "../lib/calculations";
import { monthBounds, todayYmd } from "../lib/dates";
import type { SavingsGoal } from "../lib/types";

export function SavingsPage() {
  const { state, saveSavings, removeSavings, contributeSavings, locked } = useStore();
  const { startYmd, endYmd } = monthBounds(state.currentMonth);
  const monthNet = savingsNet(state.transactions.filter((t) => t.date >= startYmd && t.date <= endYmd));
  const snap = monthSnapshot(state, state.currentMonth);
  const [edit, setEdit] = useState<Partial<SavingsGoal> | null>(null);
  const [move, setMove] = useState<{ id: string; amount: string; withdraw: boolean } | null>(null);

  const total = state.savingsGoals.reduce((s, g) => s + g.currentCents, 0) + state.buckets.reduce((s, b) => s + b.balanceCents, 0);

  return (
    <div className="stack">
      <div className="grid grid-3">
        <Card><div className="tiny muted">Total savings</div><div className="value"><Money cents={total} /></div></Card>
        <Card><div className="tiny muted">Contributions this month</div><div className="value pos"><Money cents={Math.max(0, monthNet)} /></div></Card>
        <Card><div className="tiny muted">Withdrawals this month</div><div className="value"><Money cents={Math.max(0, -monthNet)} /></div></Card>
      </div>
      <div className="between">
        <p className="muted">Contributions are allocations, not spending. Emergency fund and vacation goals live here.</p>
        <Button variant="primary" disabled={locked} onClick={() => setEdit({ name: "", targetCents: 0, currentCents: 0, contributionCents: 0, frequency: "monthly", nextDate: todayYmd(), targetDate: null, notes: "", accountId: state.accounts.find((a) => a.type === "savings")?.id ?? null, bucketId: null })}>Add goal</Button>
      </div>
      {state.savingsGoals.length === 0 ? <Empty title="No savings goals yet" hint="Try Emergency Fund, Christmas, or Vacation." /> : state.savingsGoals.map((g) => {
        const pct = g.targetCents > 0 ? (g.currentCents / g.targetCents) * 100 : 0;
        const remaining = Math.max(0, g.targetCents - g.currentCents);
        const suggest = suggestedContribution(g.targetCents, g.currentCents, g.targetDate);
        return (
          <Card key={g.id}>
            <div className="between">
              <div>
                <div className="name">{g.name}</div>
                <div className="tiny muted">{g.frequency} · {g.targetDate ? `target ${g.targetDate}` : "no date"}</div>
              </div>
              <div className="wrap">
                <Button variant="small" disabled={locked} onClick={() => setMove({ id: g.id, amount: ((g.contributionCents || 0) / 100).toFixed(2), withdraw: false })}>Contribute</Button>
                <Button variant="small" disabled={locked} onClick={() => setMove({ id: g.id, amount: "0.00", withdraw: true })}>Withdraw</Button>
                <Button variant="small" onClick={() => setEdit(g)}>Edit</Button>
                <Button variant="small" className="danger" onClick={() => removeSavings(g.id)}>Delete</Button>
              </div>
            </div>
            <div className="between" style={{ margin: "10px 0" }}>
              <Money cents={g.currentCents} /> / <Money cents={g.targetCents} />
              <span>{pct.toFixed(1)}%</span>
            </div>
            <Progress value={g.currentCents} max={Math.max(1, g.targetCents)} />
            <div className="tiny muted" style={{ marginTop: 8 }}>Remaining <Money cents={remaining} /> · suggested <Money cents={suggest} /> / month</div>
          </Card>
        );
      })}
      <Card>
        <h2>Linked buckets</h2>
        {state.buckets.length === 0 ? <Empty title="No buckets" hint="Create set-aside buckets on the Buckets page." /> : state.buckets.map((b) => (
          <div key={b.id} className="item">
            <div>{b.icon} {b.name}</div>
            <span><Money cents={b.balanceCents} /> / <Money cents={b.goalCents} /></span>
          </div>
        ))}
      </Card>
      <p className="tiny muted">Unallocated money this month: <Money cents={snap.unallocatedCents} /></p>

      <Modal open={!!edit} title="Savings goal" onClose={() => setEdit(null)}>
        {edit ? (
          <form className="form-grid" onSubmit={(ev) => {
            ev.preventDefault();
            saveSavings({
              id: edit.id || createId("sav"),
              name: edit.name || "Savings",
              targetCents: edit.targetCents || 0,
              currentCents: edit.currentCents || 0,
              targetDate: edit.targetDate || null,
              contributionCents: edit.contributionCents || 0,
              frequency: edit.frequency || "monthly",
              nextDate: edit.nextDate || null,
              notes: edit.notes || "",
              accountId: edit.accountId || null,
              bucketId: edit.bucketId || null,
              ...stamp(),
            });
            setEdit(null);
          }}>
            <Field label="Name" className="full"><input className="input" value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></Field>
            <Field label="Target"><input className="input" defaultValue={((edit.targetCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, targetCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Current"><input className="input" defaultValue={((edit.currentCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, currentCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Contribution"><input className="input" defaultValue={((edit.contributionCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, contributionCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Frequency">
              <select className="input" value={edit.frequency || "monthly"} onChange={(e) => setEdit({ ...edit, frequency: e.target.value as SavingsGoal["frequency"] })}>
                {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Target date"><input className="input" type="date" value={edit.targetDate || ""} onChange={(e) => setEdit({ ...edit, targetDate: e.target.value || null })} /></Field>
            <div className="full row" style={{ justifyContent: "flex-end" }}><Button type="submit" variant="primary">Save</Button></div>
          </form>
        ) : null}
      </Modal>
      <Modal open={!!move} title={move?.withdraw ? "Withdraw" : "Contribute"} onClose={() => setMove(null)}>
        {move ? (
          <form className="stack" onSubmit={(ev) => {
            ev.preventDefault();
            contributeSavings(move.id, parseDollarsToCents(move.amount), todayYmd(), state.accounts.find((a) => a.type === "checking")?.id ?? null, move.withdraw);
            setMove(null);
          }}>
            <Field label="Amount"><input className="input" value={move.amount} onChange={(e) => setMove({ ...move, amount: e.target.value })} /></Field>
            <p className="tiny muted">This is recorded as an allocation, not as a regular expense.</p>
            <Button type="submit" variant="primary">Save</Button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
