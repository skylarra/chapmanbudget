import { useState } from "react";
import { useStore } from "../store";
import { Button, Card, Empty, Field, FREQ_OPTIONS, Money, Progress } from "../components/ui";
import { Modal } from "../components/Layout";
import { createId } from "../lib/ids";
import { stamp } from "../lib/defaults";
import { parseDollarsToCents } from "../lib/money";
import { todayYmd } from "../lib/dates";
import type { Bucket } from "../lib/types";

export function BucketsPage() {
  const { state, saveBucket, removeBucket, contributeBucket, transferBuckets, locked } = useStore();
  const [edit, setEdit] = useState<Partial<Bucket> | null>(null);
  const [move, setMove] = useState<{ id: string; amount: string; mode: "add" | "remove" | "transfer"; toId: string } | null>(null);

  return (
    <div className="stack">
      <div className="between">
        <p className="muted">Buckets hold money set aside on purpose. Moving money between buckets is not income or spending.</p>
        <Button variant="primary" disabled={locked} onClick={() => setEdit({ name: "", goalCents: 0, balanceCents: 0, contributionCents: 0, frequency: "monthly", nextDate: todayYmd(), targetDate: null, notes: "", color: "#1f6f5b", icon: "🪣", accountId: null })}>Add bucket</Button>
      </div>
      {state.buckets.length === 0 ? <Empty title="No buckets yet" hint="Emergency Fund, Christmas, Car Repairs, Vacation…" /> : state.buckets.map((b) => {
        const remaining = Math.max(0, b.goalCents - b.balanceCents);
        const pct = b.goalCents > 0 ? (b.balanceCents / b.goalCents) * 100 : 0;
        return (
          <Card key={b.id}>
            <div className="between">
              <div className="row">
                <span style={{ fontSize: 22 }}>{b.icon}</span>
                <div>
                  <div className="name">{b.name}</div>
                  <div className="tiny muted">{b.frequency} {b.targetDate ? `· target ${b.targetDate}` : ""}</div>
                </div>
              </div>
              <div className="wrap">
                <Button variant="small" disabled={locked} onClick={() => setMove({ id: b.id, amount: ((b.contributionCents || 0) / 100).toFixed(2), mode: "add", toId: "" })}>Add</Button>
                <Button variant="small" disabled={locked} onClick={() => setMove({ id: b.id, amount: "0.00", mode: "remove", toId: "" })}>Remove</Button>
                <Button variant="small" disabled={locked} onClick={() => setMove({ id: b.id, amount: "0.00", mode: "transfer", toId: state.buckets.find((x) => x.id !== b.id)?.id || "" })}>Transfer</Button>
                <Button variant="small" onClick={() => setEdit(b)}>Edit</Button>
                <Button variant="small" className="danger" onClick={() => removeBucket(b.id)}>Delete</Button>
              </div>
            </div>
            <div className="grid grid-3" style={{ margin: "12px 0" }}>
              <div><div className="tiny muted">Goal</div><b><Money cents={b.goalCents} /></b></div>
              <div><div className="tiny muted">Current</div><b><Money cents={b.balanceCents} /></b></div>
              <div><div className="tiny muted">Remaining</div><b><Money cents={remaining} /></b></div>
            </div>
            <Progress value={b.balanceCents} max={Math.max(1, b.goalCents)} />
            <div className="tiny muted" style={{ marginTop: 8 }}>Progress {pct.toFixed(1)}%{b.notes ? ` · ${b.notes}` : ""}</div>
          </Card>
        );
      })}
      <Modal open={!!edit} title="Bucket" onClose={() => setEdit(null)}>
        {edit ? (
          <form className="form-grid" onSubmit={(ev) => {
            ev.preventDefault();
            saveBucket({
              id: edit.id || createId("bkt"),
              name: edit.name || "Bucket",
              goalCents: edit.goalCents || 0,
              balanceCents: edit.balanceCents || 0,
              contributionCents: edit.contributionCents || 0,
              frequency: edit.frequency || "monthly",
              nextDate: edit.nextDate || null,
              targetDate: edit.targetDate || null,
              notes: edit.notes || "",
              color: edit.color || "#1f6f5b",
              icon: edit.icon || "🪣",
              accountId: edit.accountId || null,
              ...stamp(),
            });
            setEdit(null);
          }}>
            <Field label="Name" className="full"><input className="input" value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></Field>
            <Field label="Icon"><input className="input" value={edit.icon || ""} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} /></Field>
            <Field label="Goal"><input className="input" defaultValue={((edit.goalCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, goalCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Current balance"><input className="input" defaultValue={((edit.balanceCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, balanceCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Auto contribution"><input className="input" defaultValue={((edit.contributionCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, contributionCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Schedule">
              <select className="input" value={edit.frequency || "monthly"} onChange={(e) => setEdit({ ...edit, frequency: e.target.value as Bucket["frequency"] })}>
                {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Target date"><input className="input" type="date" value={edit.targetDate || ""} onChange={(e) => setEdit({ ...edit, targetDate: e.target.value || null })} /></Field>
            <Field label="Notes" className="full"><textarea className="input" value={edit.notes || ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <div className="full row" style={{ justifyContent: "flex-end" }}><Button type="submit" variant="primary">Save</Button></div>
          </form>
        ) : null}
      </Modal>
      <Modal open={!!move} title={move?.mode === "transfer" ? "Transfer between buckets" : move?.mode === "remove" ? "Remove from bucket" : "Add to bucket"} onClose={() => setMove(null)}>
        {move ? (
          <form className="stack" onSubmit={(ev) => {
            ev.preventDefault();
            const cents = parseDollarsToCents(move.amount);
            if (move.mode === "transfer") transferBuckets(move.id, move.toId, cents, todayYmd());
            else contributeBucket(move.id, cents, todayYmd(), state.accounts[0]?.id ?? null, move.mode === "remove");
            setMove(null);
          }}>
            <Field label="Amount"><input className="input" value={move.amount} onChange={(e) => setMove({ ...move, amount: e.target.value })} /></Field>
            {move.mode === "transfer" ? (
              <Field label="To bucket">
                <select className="input" value={move.toId} onChange={(e) => setMove({ ...move, toId: e.target.value })}>
                  {state.buckets.filter((b) => b.id !== move.id).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
            ) : null}
            <Button type="submit" variant="primary">Save</Button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
