import { useState } from "react";
import { useStore } from "../store";
import { Button, Card, Empty, Field, FREQ_OPTIONS, Money, Pill } from "../components/ui";
import { Confirm, Modal } from "../components/Layout";
import {
  activeBillsSorted,
  billCoveredInBucket,
  daysUntilDue,
  groupBillsByDate,
  mainIncomeSource,
  recommendedPerPaycheck,
} from "../lib/calculations";
import { createId } from "../lib/ids";
import { stamp } from "../lib/defaults";
import { formCents, formValue, parseDollarsToCents } from "../lib/money";
import { FREQUENCY_LABEL, type Bill, type Frequency } from "../lib/types";
import { todayYmd } from "../lib/dates";

export function BillsPage() {
  const { state, saveBill, removeBill, payBill, skipBill } = useStore();
  const today = todayYmd();
  const bills = activeBillsSorted(state);
  const groups = groupBillsByDate(bills, today);
  const pay = mainIncomeSource(state);
  const [edit, setEdit] = useState<Partial<Bill> | null>(null);
  const [payModal, setPayModal] = useState<{ id: string; amount: string } | null>(null);
  const [del, setDel] = useState<string | null>(null);

  return (
    <div className="stack">
      <div className="between">
        <p className="muted">Sorted by next due date. Paying a bill spends from its bucket and advances the schedule.</p>
        <Button variant="primary" onClick={() => setEdit({ name: "", amountCents: 0, frequency: "monthly", nextDueDate: today, secondDay: null, bucketId: state.expenseBuckets[0]?.id ?? null, active: true, notes: "" })}>Add bill</Button>
      </div>

      {bills.some((b) => b.frequency !== "once") ? (
        <Card>
          <h2>Bill funding (recommendation)</h2>
          <p className="tiny muted">
            With {FREQUENCY_LABEL[pay?.frequency ?? "biweekly"].toLowerCase()} income, a monthly bill is estimated as amount × 12 ÷ {(pay?.frequency ?? "biweekly") === "biweekly" ? "26" : "paychecks per year"}. These are suggested set-asides, not required allocations.
          </p>
          {bills.filter((b) => b.frequency !== "once").slice(0, 8).map((b) => (
            <div key={b.id} className="between">
              <span>{b.name}</span>
              <span className="tiny">~ <Money cents={recommendedPerPaycheck(b, pay?.frequency ?? "biweekly")} /> / paycheck</span>
            </div>
          ))}
        </Card>
      ) : null}

      {groups.length === 0 ? <Empty title="No bills yet" hint="Add rent, utilities, insurance, and subscriptions." /> : groups.map((g) => (
        <div key={g.date}>
          <div className="date-head">{g.label}</div>
          {g.bills.map((b) => {
            const days = daysUntilDue(b.nextDueDate, today);
            const funded = billCoveredInBucket(state, b);
            return (
              <div key={b.id} className="item" style={{ marginBottom: 8 }}>
                <div>
                  <div className="name">{b.name}</div>
                  <div className="tiny muted">
                    {FREQUENCY_LABEL[b.frequency]} · {days === 0 ? "due today" : days < 0 ? `${Math.abs(days)} days overdue` : `${days} days`}
                    {" · "}
                    {funded ? "money is in the bucket" : "needed amount is not fully in the bucket"}
                  </div>
                </div>
                <div className="row">
                  <Money cents={b.amountCents} />
                  <Pill tone={funded ? "good" : days < 0 ? "bad" : "warn"}>{funded ? "funded" : "needs $"}</Pill>
                  <Button variant="primary" onClick={() => setPayModal({ id: b.id, amount: (b.amountCents / 100).toFixed(2) })}>Pay</Button>
                  <Button variant="ghost" onClick={() => skipBill(b.id)}>Skip</Button>
                  <Button variant="small" onClick={() => setEdit(b)}>Edit</Button>
                  <Button variant="small" onClick={() => setDel(b.id)}>Delete</Button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <Card>
        <h2>Inactive</h2>
        {state.bills.filter((b) => !b.active).length === 0 ? <div className="muted">None</div> : state.bills.filter((b) => !b.active).map((b) => (
          <div key={b.id} className="item">
            <span>{b.name}</span>
            <Button variant="small" onClick={() => saveBill({ ...b, active: true })}>Reactivate</Button>
          </div>
        ))}
      </Card>

      <Modal open={!!edit} title="Bill" onClose={() => setEdit(null)}>
        {edit ? (
          <form className="form-grid" onSubmit={(ev) => {
            ev.preventDefault();
            const form = ev.currentTarget;
            const frequency = (formValue(form, "frequency") as Frequency) || "monthly";
            saveBill({
              id: edit.id || createId("bill"),
              name: formValue(form, "name") || "Bill",
              amountCents: formCents(form, "amount"),
              frequency,
              nextDueDate: formValue(form, "nextDueDate") || today,
              secondDay: frequency === "twice_monthly" ? Number(formValue(form, "secondDay") || 15) : null,
              bucketId: formValue(form, "bucketId") || null,
              active: (form.elements.namedItem("active") as HTMLInputElement | null)?.checked !== false,
              notes: formValue(form, "notes"),
              ...stamp(),
            });
            setEdit(null);
          }}>
            <Field label="Name" className="full"><input className="input" name="name" defaultValue={edit.name || ""} required /></Field>
            <Field label="Amount"><input className="input" name="amount" inputMode="decimal" defaultValue={((edit.amountCents || 0) / 100).toFixed(2)} /></Field>
            <Field label="Frequency">
              <select className="input" name="frequency" defaultValue={edit.frequency || "monthly"} onChange={(e) => setEdit((cur) => cur ? { ...cur, frequency: e.target.value as Frequency } : cur)}>
                {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Next due date"><input className="input" name="nextDueDate" type="date" defaultValue={edit.nextDueDate || ""} /></Field>
            {edit.frequency === "twice_monthly" ? (
              <Field label="Second day of month"><input className="input" name="secondDay" type="number" min={1} max={28} defaultValue={edit.secondDay ?? 15} /></Field>
            ) : null}
            <Field label="Pay from bucket" className="full">
              <select className="input" name="bucketId" defaultValue={edit.bucketId || ""}>
                <option value="">Available (unassigned)</option>
                {state.expenseBuckets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <label className="field"><input type="checkbox" name="active" defaultChecked={edit.active !== false} /> Active</label>
            <Field label="Notes" className="full"><textarea className="input" name="notes" defaultValue={edit.notes || ""} /></Field>
            <div className="full row" style={{ justifyContent: "flex-end" }}><Button type="submit" variant="primary">Save</Button></div>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!payModal} title="Pay bill" onClose={() => setPayModal(null)}>
        {payModal ? (
          <form className="stack" onSubmit={(ev) => {
            ev.preventDefault();
            payBill(payModal.id, parseDollarsToCents(payModal.amount), today);
            setPayModal(null);
          }}>
            <Field label="Amount actually paid"><input className="input" value={payModal.amount} onChange={(e) => setPayModal({ ...payModal, amount: e.target.value })} /></Field>
            <p className="tiny muted">This records an expense from the bill’s bucket. The next due date then moves forward.</p>
            <Button type="submit" variant="primary">Record payment</Button>
          </form>
        ) : null}
      </Modal>
      <Confirm open={!!del} title="Delete this bill?" body="Past payments stay in Transactions." danger confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) removeBill(del); setDel(null); }} />
    </div>
  );
}
