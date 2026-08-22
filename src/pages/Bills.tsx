import { useState } from "react";
import { useStore } from "../store";
import { Button, Card, Empty, Field, FREQ_OPTIONS, Money, StatusPill } from "../components/ui";
import { Confirm, Modal } from "../components/Layout";
import { billOccurrences, overdueItems } from "../lib/calculations";
import { formatNiceDate, monthBounds, todayYmd } from "../lib/dates";
import { createId } from "../lib/ids";
import { stamp } from "../lib/defaults";
import { parseDollarsToCents } from "../lib/money";
import type { Bill } from "../lib/types";

export function BillsPage() {
  const { state, saveBill, removeBill, markBillPaid, skipOccurrence, locked } = useStore();
  const today = todayYmd();
  const { startYmd, endYmd } = monthBounds(state.currentMonth);
  const items = billOccurrences(state, startYmd, endYmd, today);
  const overdue = overdueItems(state, today).filter((o) => o.kind === "bill");
  const [edit, setEdit] = useState<Partial<Bill> | null>(null);
  const [pay, setPay] = useState<{ billId: string; date: string; amount: string } | null>(null);
  const [del, setDel] = useState<string | null>(null);

  const blank = (): Partial<Bill> => ({
    name: "", expectedCents: 0, dueDate: today, frequency: "monthly", categoryId: null, autopay: false, active: true, notes: "", accountId: state.accounts[0]?.id ?? null, debtId: null, paymentMethod: "",
  });

  return (
    <div className="stack">
      <div className="between">
        <p className="muted">Check off each occurrence when you pay it. Actual amounts can differ from expected.</p>
        <Button variant="primary" disabled={locked} onClick={() => setEdit(blank())}>Add bill</Button>
      </div>
      {overdue.length > 0 ? (
        <Card>
          <h2>Overdue</h2>
          {overdue.map((o) => (
            <div key={o.key} className="item">
              <div>
                <div className="name">{o.name}</div>
                <div className="tiny muted">Due {formatNiceDate(o.date)} · {Math.max(0, Math.round((Date.parse(today) - Date.parse(o.date)) / 86400000))} days overdue</div>
              </div>
              <div className="row">
                <Money cents={o.amountCents} />
                <Button variant="primary" disabled={locked} onClick={() => setPay({ billId: o.sourceId, date: o.date, amount: (o.amountCents / 100).toFixed(2) })}>Mark paid</Button>
              </div>
            </div>
          ))}
        </Card>
      ) : null}
      <Card>
        <h2>This month</h2>
        {items.length === 0 ? <Empty title="No bills this month" /> : items.map((b) => (
          <div key={b.key} className="item">
            <div>
              <div className="name">{b.name}</div>
              <div className="tiny muted">{formatNiceDate(b.date)} {b.autopay ? "· Autopay" : ""}</div>
            </div>
            <div className="row">
              <StatusPill status={b.status} />
              <Money cents={b.amountCents} />
              {b.status !== "paid" && b.status !== "skipped" ? (
                <>
                  <Button variant="primary" disabled={locked} onClick={() => setPay({ billId: b.sourceId, date: b.date, amount: (b.amountCents / 100).toFixed(2) })}>Mark paid</Button>
                  <Button variant="ghost" disabled={locked} onClick={() => skipOccurrence("bill", b.sourceId, b.date)}>Skip</Button>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </Card>
      <Card>
        <h2>Bill templates</h2>
        {state.bills.length === 0 ? <Empty title="No bills yet" hint="Add mortgage, utilities, insurance, and subscriptions." /> : state.bills.map((b) => (
          <div key={b.id} className="item">
            <div>
              <div className="name">{b.name} {b.active ? "" : "(inactive)"}</div>
              <div className="tiny muted">{b.frequency} · due {b.dueDate} {b.autopay ? "· autopay" : ""} {b.paymentMethod ? `· ${b.paymentMethod}` : ""}</div>
            </div>
            <div className="row">
              <Money cents={b.expectedCents} />
              <Button variant="small" onClick={() => setEdit(b)}>Edit</Button>
              <Button variant="small" className="danger" onClick={() => setDel(b.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </Card>

      <Modal open={!!edit} title="Bill" onClose={() => setEdit(null)}>
        {edit ? (
          <form className="form-grid" onSubmit={(ev) => {
            ev.preventDefault();
            saveBill({
              id: edit.id || createId("bill"),
              name: edit.name || "Bill",
              expectedCents: edit.expectedCents || 0,
              dueDate: edit.dueDate || today,
              frequency: edit.frequency || "monthly",
              categoryId: edit.categoryId || null,
              autopay: !!edit.autopay,
              active: edit.active !== false,
              notes: edit.notes || "",
              accountId: edit.accountId || null,
              debtId: edit.debtId || null,
              paymentMethod: edit.paymentMethod || "",
              ...stamp(),
            });
            setEdit(null);
          }}>
            <Field label="Name" className="full"><input className="input" value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></Field>
            <Field label="Expected amount"><input className="input" inputMode="decimal" defaultValue={((edit.expectedCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, expectedCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Frequency">
              <select className="input" value={edit.frequency || "monthly"} onChange={(e) => setEdit({ ...edit, frequency: e.target.value as Bill["frequency"] })}>
                {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Due / next date"><input className="input" type="date" value={edit.dueDate || ""} onChange={(e) => setEdit({ ...edit, dueDate: e.target.value })} /></Field>
            <Field label="Category">
              <select className="input" value={edit.categoryId || ""} onChange={(e) => setEdit({ ...edit, categoryId: e.target.value || null })}>
                <option value="">None</option>
                {state.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Account">
              <select className="input" value={edit.accountId || ""} onChange={(e) => setEdit({ ...edit, accountId: e.target.value || null })}>
                <option value="">None</option>
                {state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="Linked debt">
              <select className="input" value={edit.debtId || ""} onChange={(e) => setEdit({ ...edit, debtId: e.target.value || null })}>
                <option value="">None</option>
                {state.debts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Payment method"><input className="input" value={edit.paymentMethod || ""} onChange={(e) => setEdit({ ...edit, paymentMethod: e.target.value })} /></Field>
            <label className="field"><input type="checkbox" checked={!!edit.autopay} onChange={(e) => setEdit({ ...edit, autopay: e.target.checked })} /> Autopay</label>
            <label className="field"><input type="checkbox" checked={edit.active !== false} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active</label>
            <Field label="Notes" className="full"><textarea className="input" value={edit.notes || ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <div className="full row" style={{ justifyContent: "flex-end" }}><Button type="submit" variant="primary">Save</Button></div>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!pay} title="Mark bill paid" onClose={() => setPay(null)}>
        {pay ? (
          <form className="stack" onSubmit={(ev) => {
            ev.preventDefault();
            markBillPaid(pay.billId, pay.date, parseDollarsToCents(pay.amount), state.bills.find((b) => b.id === pay.billId)?.accountId ?? null);
            setPay(null);
          }}>
            <Field label="Amount actually paid"><input className="input" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
            <p className="tiny muted">This creates a transaction and updates the budget. If the bill is linked to a debt, that balance updates too.</p>
            <Button type="submit" variant="primary">Save payment</Button>
          </form>
        ) : null}
      </Modal>
      <Confirm open={!!del} title="Delete this bill?" body="Future occurrences will disappear. Existing payments stay in Transactions." danger confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) removeBill(del); setDel(null); }} />
    </div>
  );
}
