import { useState } from "react";
import { useStore } from "../store";
import { Button, Card, Empty, Field, FREQ_OPTIONS, Money, StatusPill } from "../components/ui";
import { Modal } from "../components/Layout";
import { incomeOccurrences, mainIncomeSource } from "../lib/calculations";
import { formatNiceDate, monthBounds, todayYmd } from "../lib/dates";
import { createId } from "../lib/ids";
import { stamp } from "../lib/defaults";
import { parseDollarsToCents } from "../lib/money";
import type { IncomeSource } from "../lib/types";

export function IncomePage() {
  const { state, saveIncome, removeIncome, markIncomeReceived, skipOccurrence, updateSettings, locked } = useStore();
  const today = todayYmd();
  const { startYmd, endYmd } = monthBounds(state.currentMonth);
  const items = incomeOccurrences(state, startYmd, endYmd, today);
  const [edit, setEdit] = useState<Partial<IncomeSource> | null>(null);
  const [receive, setReceive] = useState<{ id: string; date: string; amount: string } | null>(null);
  const main = mainIncomeSource(state);

  return (
    <div className="stack">
      <div className="between">
        <p className="muted">Recurring paychecks generate expected dates. Mark received to turn them into transactions.</p>
        <Button variant="primary" disabled={locked} onClick={() => setEdit({ name: "", amountCents: 0, frequency: "biweekly", nextDate: today, startDate: today, endDate: null, active: true, notes: "", accountId: state.accounts[0]?.id ?? null })}>Add income</Button>
      </div>
      <Card>
        <h2>This month</h2>
        {items.length === 0 ? <Empty title="No expected income this month" /> : items.map((i) => (
          <div key={i.key} className="item">
            <div>
              <div className="name">{i.name}</div>
              <div className="tiny muted">{formatNiceDate(i.date)}</div>
            </div>
            <div className="row">
              <StatusPill status={i.status} />
              <Money cents={i.amountCents} />
              {i.status !== "received" && i.status !== "skipped" ? (
                <>
                  <Button variant="primary" disabled={locked} onClick={() => setReceive({ id: i.sourceId, date: i.date, amount: (i.amountCents / 100).toFixed(2) })}>Mark received</Button>
                  <Button variant="ghost" disabled={locked} onClick={() => skipOccurrence("income", i.sourceId, i.date)}>Skip</Button>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </Card>
      <Card>
        <h2>Income sources</h2>
        <Field label="Primary paycheck for planning">
          <select className="input" value={state.settings.paycheckIncomeId || main?.id || ""} onChange={(e) => updateSettings({ paycheckIncomeId: e.target.value || null })}>
            <option value="">Largest repeating source</option>
            {state.incomeSources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        {state.incomeSources.length === 0 ? <Empty title="No income sources" /> : state.incomeSources.map((s) => (
          <div key={s.id} className="item">
            <div>
              <div className="name">{s.name} {s.active ? "" : "(inactive)"}</div>
              <div className="tiny muted">{s.frequency} · next {s.nextDate}</div>
            </div>
            <div className="row">
              <Money cents={s.amountCents} />
              <Button variant="small" onClick={() => setEdit(s)}>Edit</Button>
              <Button variant="small" className="danger" onClick={() => removeIncome(s.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </Card>
      <Modal open={!!edit} title="Income source" onClose={() => setEdit(null)}>
        {edit ? (
          <form className="form-grid" onSubmit={(ev) => {
            ev.preventDefault();
            saveIncome({
              id: edit.id || createId("inc"),
              name: edit.name || "Income",
              amountCents: edit.amountCents || 0,
              frequency: edit.frequency || "monthly",
              nextDate: edit.nextDate || today,
              startDate: edit.startDate || edit.nextDate || today,
              endDate: edit.endDate || null,
              active: edit.active !== false,
              notes: edit.notes || "",
              accountId: edit.accountId || null,
              ...stamp(),
            });
            setEdit(null);
          }}>
            <Field label="Name" className="full"><input className="input" value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></Field>
            <Field label="Amount"><input className="input" inputMode="decimal" defaultValue={((edit.amountCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, amountCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Frequency">
              <select className="input" value={edit.frequency || "monthly"} onChange={(e) => setEdit({ ...edit, frequency: e.target.value as IncomeSource["frequency"] })}>
                {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Next / start date"><input className="input" type="date" value={edit.nextDate || ""} onChange={(e) => setEdit({ ...edit, nextDate: e.target.value, startDate: e.target.value })} /></Field>
            <Field label="End date"><input className="input" type="date" value={edit.endDate || ""} onChange={(e) => setEdit({ ...edit, endDate: e.target.value || null })} /></Field>
            <Field label="Deposit account">
              <select className="input" value={edit.accountId || ""} onChange={(e) => setEdit({ ...edit, accountId: e.target.value || null })}>
                <option value="">None</option>
                {state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <label className="field"><input type="checkbox" checked={edit.active !== false} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active</label>
            <Field label="Notes" className="full"><textarea className="input" value={edit.notes || ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <div className="full row" style={{ justifyContent: "flex-end" }}><Button type="submit" variant="primary">Save</Button></div>
          </form>
        ) : null}
      </Modal>
      <Modal open={!!receive} title="Mark income received" onClose={() => setReceive(null)}>
        {receive ? (
          <form className="stack" onSubmit={(ev) => {
            ev.preventDefault();
            markIncomeReceived(receive.id, receive.date, parseDollarsToCents(receive.amount), state.incomeSources.find((s) => s.id === receive.id)?.accountId ?? null);
            setReceive(null);
          }}>
            <Field label="Amount received"><input className="input" value={receive.amount} onChange={(e) => setReceive({ ...receive, amount: e.target.value })} /></Field>
            <Button type="submit" variant="primary">Convert to transaction</Button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
