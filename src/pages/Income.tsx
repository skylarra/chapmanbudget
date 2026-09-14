import { useState } from "react";
import { useStore } from "../store";
import { Button, Card, Empty, Field, FREQ_OPTIONS, Money } from "../components/ui";
import { Modal } from "../components/Layout";
import { createId } from "../lib/ids";
import { stamp } from "../lib/defaults";
import { formCents, formValue } from "../lib/money";
import { FREQUENCY_LABEL, type Frequency, type IncomeSource } from "../lib/types";
import { formatNiceDate, todayYmd } from "../lib/dates";
import type { PageId } from "../components/Layout";

export function IncomePage({ onPage, onAdd }: { onPage: (id: PageId) => void; onAdd: () => void }) {
  const { state, saveIncome, removeIncome, updateSettings } = useStore();
  const [edit, setEdit] = useState<Partial<IncomeSource> | null>(null);
  const upcoming = state.incomeSources.filter((i) => i.active).slice().sort((a, b) => a.nextDate.localeCompare(b.nextDate));

  return (
    <div className="stack">
      <div className="between">
        <p className="muted">Expected vs actual can differ. Record the real deposit, then assign it with Budget this paycheck.</p>
        <div className="wrap">
          <Button onClick={() => onPage("paycheck")}>Budget this paycheck</Button>
          <Button variant="primary" onClick={() => setEdit({ name: "", expectedCents: 0, frequency: "biweekly", nextDate: todayYmd(), secondDay: 15, active: true, notes: "" })}>Add income</Button>
        </div>
      </div>
      <Card>
        <h2>Upcoming expected income</h2>
        {upcoming.length === 0 ? <Empty title="No income sources" /> : upcoming.map((s) => (
          <div key={s.id} className="item">
            <div>
              <div className="name">{s.name}</div>
              <div className="tiny muted">{FREQUENCY_LABEL[s.frequency]} · next {formatNiceDate(s.nextDate)}</div>
            </div>
            <div className="row">
              <Money cents={s.expectedCents} />
              <Button variant="small" onClick={() => onAdd()}>Record</Button>
              <Button variant="small" onClick={() => setEdit(s)}>Edit</Button>
              <Button variant="small" onClick={() => removeIncome(s.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </Card>
      <Field label="Primary paycheck for recommendations">
        <select className="input" value={state.settings.paycheckIncomeId || ""} onChange={(e) => updateSettings({ paycheckIncomeId: e.target.value || null })}>
          <option value="">Largest repeating source</option>
          {state.incomeSources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Modal open={!!edit} title="Income source" onClose={() => setEdit(null)}>
        {edit ? (
          <form className="form-grid" onSubmit={(ev) => {
            ev.preventDefault();
            const form = ev.currentTarget;
            const frequency = (formValue(form, "frequency") as Frequency) || "monthly";
            saveIncome({
              id: edit.id || createId("inc"),
              name: formValue(form, "name") || "Income",
              expectedCents: formCents(form, "expected"),
              frequency,
              nextDate: formValue(form, "nextDate") || todayYmd(),
              secondDay: frequency === "twice_monthly" ? Number(formValue(form, "secondDay") || 15) : null,
              active: (form.elements.namedItem("active") as HTMLInputElement | null)?.checked !== false,
              notes: formValue(form, "notes"),
              ...stamp(),
            });
            setEdit(null);
          }}>
            <Field label="Name" className="full"><input className="input" name="name" defaultValue={edit.name || ""} required /></Field>
            <Field label="Expected amount"><input className="input" name="expected" inputMode="decimal" defaultValue={((edit.expectedCents || 0) / 100).toFixed(2)} /></Field>
            <Field label="Frequency">
              <select className="input" name="frequency" defaultValue={edit.frequency || "monthly"} onChange={(e) => setEdit((cur) => cur ? { ...cur, frequency: e.target.value as Frequency } : cur)}>
                {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Next expected date"><input className="input" name="nextDate" type="date" defaultValue={edit.nextDate || ""} /></Field>
            {edit.frequency === "twice_monthly" ? (
              <Field label="Second day of month"><input className="input" name="secondDay" type="number" min={1} max={28} defaultValue={edit.secondDay ?? 15} /></Field>
            ) : null}
            <label className="field"><input type="checkbox" name="active" defaultChecked={edit.active !== false} /> Active</label>
            <Field label="Notes" className="full"><textarea className="input" name="notes" defaultValue={edit.notes || ""} /></Field>
            <div className="full row" style={{ justifyContent: "flex-end" }}><Button type="submit" variant="primary">Save</Button></div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
