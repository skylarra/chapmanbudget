import { useState } from "react";
import { useStore } from "../store";
import { Button, Card, Empty, Field, FREQ_OPTIONS, Money, Progress } from "../components/ui";
import { Confirm, Modal } from "../components/Layout";
import { createId } from "../lib/ids";
import { stamp } from "../lib/defaults";
import { parseDollarsToCents } from "../lib/money";
import { todayYmd } from "../lib/dates";
import type { Frequency, SavingsBucket } from "../lib/types";

export function SavingsPage() {
  const { state, saveSavingsBucket, removeSavingsBucket, transfer } = useStore();
  const [edit, setEdit] = useState<Partial<SavingsBucket> | null>(null);
  const [move, setMove] = useState<{ id: string; amount: string; dir: "in" | "out" } | null>(null);
  const [del, setDel] = useState<string | null>(null);

  return (
    <div className="stack">
      <div className="between">
        <p className="muted">Savings are separate from spending buckets. Moving money here is a transfer, not an expense.</p>
        <Button variant="primary" onClick={() => setEdit({ name: "", balanceCents: 0, goalCents: 0, targetDate: null, autoContributionCents: 0, autoFrequency: "biweekly", notes: "", color: "#1f6f5b", icon: "💰", sortOrder: state.savingsBuckets.length })}>Add savings</Button>
      </div>
      {state.savingsBuckets.length === 0 ? <Empty title="No savings buckets" hint="Emergency Fund, Christmas, Car Repairs…" /> : state.savingsBuckets.map((s) => {
        const pct = s.goalCents > 0 ? (s.balanceCents / s.goalCents) * 100 : 0;
        return (
          <Card key={s.id}>
            <div className="between">
              <div className="row">
                <span style={{ fontSize: 22 }}>{s.icon}</span>
                <div>
                  <div className="name">{s.name}</div>
                  <div className="tiny muted">{s.targetDate ? `target ${s.targetDate}` : "no date"}{s.autoContributionCents ? ` · auto ${ (s.autoContributionCents / 100).toFixed(2) }` : ""}</div>
                </div>
              </div>
              <div className="wrap">
                <Button variant="small" onClick={() => setMove({ id: s.id, amount: ((s.autoContributionCents || 0) / 100).toFixed(2), dir: "in" })}>Add</Button>
                <Button variant="small" onClick={() => setMove({ id: s.id, amount: "0.00", dir: "out" })}>Withdraw</Button>
                <Button variant="small" onClick={() => setEdit(s)}>Edit</Button>
                <Button variant="small" onClick={() => setDel(s.id)}>Delete</Button>
              </div>
            </div>
            <div className="between" style={{ margin: "10px 0" }}>
              <span><Money cents={s.balanceCents} /> / <Money cents={s.goalCents} /></span>
              <span>{pct.toFixed(1)}%</span>
            </div>
            <Progress value={s.balanceCents} max={Math.max(1, s.goalCents)} />
          </Card>
        );
      })}
      <Modal open={!!edit} title="Savings bucket" onClose={() => setEdit(null)}>
        {edit ? (
          <form className="form-grid" onSubmit={(ev) => {
            ev.preventDefault();
            saveSavingsBucket({
              id: edit.id || createId("sav"),
              name: edit.name || "Savings",
              balanceCents: edit.balanceCents || 0,
              goalCents: edit.goalCents || 0,
              targetDate: edit.targetDate || null,
              autoContributionCents: edit.autoContributionCents || 0,
              autoFrequency: edit.autoFrequency || "biweekly",
              notes: edit.notes || "",
              color: edit.color || "#1f6f5b",
              icon: edit.icon || "💰",
              sortOrder: edit.sortOrder ?? state.savingsBuckets.length,
              ...stamp(),
            });
            setEdit(null);
          }}>
            <Field label="Name" className="full"><input className="input" value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></Field>
            <Field label="Goal"><input className="input" defaultValue={((edit.goalCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, goalCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Current"><input className="input" defaultValue={((edit.balanceCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, balanceCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Auto contribution"><input className="input" defaultValue={((edit.autoContributionCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, autoContributionCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Auto frequency">
              <select className="input" value={edit.autoFrequency || "biweekly"} onChange={(e) => setEdit({ ...edit, autoFrequency: e.target.value as Frequency })}>
                {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Target date"><input className="input" type="date" value={edit.targetDate || ""} onChange={(e) => setEdit({ ...edit, targetDate: e.target.value || null })} /></Field>
            <Field label="Notes" className="full"><textarea className="input" value={edit.notes || ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <div className="full row" style={{ justifyContent: "flex-end" }}><Button type="submit" variant="primary">Save</Button></div>
          </form>
        ) : null}
      </Modal>
      <Modal open={!!move} title={move?.dir === "out" ? "Withdraw from savings" : "Add to savings"} onClose={() => setMove(null)}>
        {move ? (
          <form className="stack" onSubmit={(ev) => {
            ev.preventDefault();
            const cents = parseDollarsToCents(move.amount);
            if (move.dir === "in") transfer({ amountCents: cents, date: todayYmd(), fromKind: "available", fromId: null, toKind: "savings", toId: move.id });
            else transfer({ amountCents: cents, date: todayYmd(), fromKind: "savings", fromId: move.id, toKind: "available", toId: null });
            setMove(null);
          }}>
            <Field label="Amount"><input className="input" value={move.amount} onChange={(e) => setMove({ ...move, amount: e.target.value })} /></Field>
            <p className="tiny muted">This is a transfer. It will not count as spending or income.</p>
            <Button type="submit" variant="primary">Save</Button>
          </form>
        ) : null}
      </Modal>
      <Confirm open={!!del} title="Delete this savings bucket?" body="The balance is removed from this list. Add a transfer first if you still need the money assigned." danger confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) removeSavingsBucket(del); setDel(null); }} />
    </div>
  );
}
