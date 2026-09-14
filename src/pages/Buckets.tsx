import { useState } from "react";
import { useStore } from "../store";
import { Button, Card, Empty, Field, Money, Progress } from "../components/ui";
import { Confirm, Modal } from "../components/Layout";
import { createId } from "../lib/ids";
import { stamp } from "../lib/defaults";
import { parseDollarsToCents } from "../lib/money";
import { expenseSpent, monthBucketActivity } from "../lib/calculations";
import type { ExpenseBucket } from "../lib/types";

export function BucketsPage() {
  const { state, saveExpenseBucket, removeExpenseBucket, setBucketTarget } = useStore();
  const rows = monthBucketActivity(state, state.currentMonth);
  const [edit, setEdit] = useState<Partial<ExpenseBucket> | null>(null);
  const [del, setDel] = useState<string | null>(null);

  return (
    <div className="stack">
      <div className="between">
        <p className="muted">Spending decreases a bucket’s balance. Overspending is allowed and marked in red. Unused target can roll into next month.</p>
        <Button variant="primary" onClick={() => setEdit({ name: "", balanceCents: 0, targetCents: 0, rollover: true, spendingLimitCents: null, notes: "", color: "#1f6f5b", icon: "📦", sortOrder: state.expenseBuckets.length })}>Add bucket</Button>
      </div>
      {rows.length === 0 ? <Empty title="No expense buckets" /> : rows.map((row) => {
        const over = row.bucket.balanceCents < 0 || row.overspent;
        const limitHit = row.bucket.spendingLimitCents != null && expenseSpent(row.bucket, state, state.currentMonth) > row.bucket.spendingLimitCents;
        return (
          <Card key={row.bucket.id}>
            <div className="between">
              <div className="row">
                <span style={{ fontSize: 22 }}>{row.bucket.icon}</span>
                <div>
                  <div className="name">{row.bucket.name}</div>
                  <div className="tiny muted">{row.bucket.rollover ? "Rollover on" : "No rollover"}{limitHit ? " · over spending limit" : ""}</div>
                </div>
              </div>
              <div className="wrap">
                <Button variant="small" onClick={() => setEdit(row.bucket)}>Edit</Button>
                <Button variant="small" onClick={() => setDel(row.bucket.id)}>Delete</Button>
              </div>
            </div>
            <div className="grid grid-3" style={{ margin: "12px 0" }}>
              <div><div className="tiny muted">Balance</div><b className={row.bucket.balanceCents < 0 ? "neg" : ""}><Money cents={row.bucket.balanceCents} /></b></div>
              <div><div className="tiny muted">Planned</div><b><Money cents={row.plannedCents} /></b></div>
              <div><div className="tiny muted">Spent / remaining</div><b className={over ? "neg" : ""}><Money cents={row.actualCents} /> / <Money cents={row.remainingCents} /></b></div>
            </div>
            <Progress value={row.actualCents} max={Math.max(1, row.plannedCents)} />
            {over ? <div className="tiny neg" style={{ marginTop: 8 }}>Overspent this month</div> : null}
            <Field label="This month’s target">
              <input className="input" inputMode="decimal" defaultValue={(row.plannedCents / 100).toFixed(2)} onBlur={(e) => setBucketTarget(row.bucket.id, parseDollarsToCents(e.target.value))} />
            </Field>
          </Card>
        );
      })}
      <Modal open={!!edit} title="Expense bucket" onClose={() => setEdit(null)}>
        {edit ? (
          <form className="form-grid" onSubmit={(ev) => {
            ev.preventDefault();
            saveExpenseBucket({
              id: edit.id || createId("exp"),
              name: edit.name || "Bucket",
              balanceCents: edit.balanceCents || 0,
              targetCents: edit.targetCents || 0,
              rollover: edit.rollover !== false,
              spendingLimitCents: edit.spendingLimitCents ?? null,
              notes: edit.notes || "",
              color: edit.color || "#1f6f5b",
              icon: edit.icon || "📦",
              sortOrder: edit.sortOrder ?? state.expenseBuckets.length,
              ...stamp(),
            });
            setEdit(null);
          }}>
            <Field label="Name" className="full"><input className="input" value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></Field>
            <Field label="Icon"><input className="input" value={edit.icon || ""} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} /></Field>
            <Field label="Target budget"><input className="input" defaultValue={((edit.targetCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, targetCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Current balance"><input className="input" defaultValue={((edit.balanceCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, balanceCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Optional spending limit"><input className="input" defaultValue={edit.spendingLimitCents == null ? "" : (edit.spendingLimitCents / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, spendingLimitCents: e.target.value.trim() ? parseDollarsToCents(e.target.value) : null })} /></Field>
            <label className="field"><input type="checkbox" checked={edit.rollover !== false} onChange={(e) => setEdit({ ...edit, rollover: e.target.checked })} /> Rollover unused target</label>
            <Field label="Notes" className="full"><textarea className="input" value={edit.notes || ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <div className="full row" style={{ justifyContent: "flex-end" }}><Button type="submit" variant="primary">Save</Button></div>
          </form>
        ) : null}
      </Modal>
      <Confirm open={!!del} title="Delete this bucket?" body="Transactions stay, but they will no longer be grouped here." danger confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) removeExpenseBucket(del); setDel(null); }} />
    </div>
  );
}
