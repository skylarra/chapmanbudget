import { useState } from "react";
import { useStore } from "../store";
import { Button, Card, Empty, Field, Money, Progress } from "../components/ui";
import { Confirm, Modal } from "../components/Layout";
import { createId } from "../lib/ids";
import { stamp } from "../lib/defaults";
import { formCents, formValue, parseDollarsToCents } from "../lib/money";
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
            const form = ev.currentTarget;
            const limitRaw = formValue(form, "limit");
            saveExpenseBucket({
              id: edit.id || createId("exp"),
              name: formValue(form, "name") || "Bucket",
              balanceCents: formCents(form, "balance"),
              targetCents: formCents(form, "target"),
              rollover: (form.elements.namedItem("rollover") as HTMLInputElement | null)?.checked !== false,
              spendingLimitCents: limitRaw.trim() ? parseDollarsToCents(limitRaw) : null,
              notes: formValue(form, "notes"),
              color: edit.color || "#1f6f5b",
              icon: formValue(form, "icon") || "📦",
              sortOrder: edit.sortOrder ?? state.expenseBuckets.length,
              ...stamp(),
            });
            setEdit(null);
          }}>
            <Field label="Name" className="full"><input className="input" name="name" defaultValue={edit.name || ""} required /></Field>
            <Field label="Icon"><input className="input" name="icon" defaultValue={edit.icon || ""} /></Field>
            <Field label="Target budget"><input className="input" name="target" inputMode="decimal" defaultValue={((edit.targetCents || 0) / 100).toFixed(2)} /></Field>
            <Field label="Current balance"><input className="input" name="balance" inputMode="decimal" defaultValue={((edit.balanceCents || 0) / 100).toFixed(2)} /></Field>
            <Field label="Optional spending limit"><input className="input" name="limit" inputMode="decimal" defaultValue={edit.spendingLimitCents == null ? "" : (edit.spendingLimitCents / 100).toFixed(2)} /></Field>
            <label className="field"><input type="checkbox" name="rollover" defaultChecked={edit.rollover !== false} /> Rollover unused target</label>
            <Field label="Notes" className="full"><textarea className="input" name="notes" defaultValue={edit.notes || ""} /></Field>
            <div className="full row" style={{ justifyContent: "flex-end" }}><Button type="submit" variant="primary">Save</Button></div>
          </form>
        ) : null}
      </Modal>
      <Confirm open={!!del} title="Delete this bucket?" body="Transactions stay, but they will no longer be grouped here." danger confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) removeExpenseBucket(del); setDel(null); }} />
    </div>
  );
}
