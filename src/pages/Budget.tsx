import { useState } from "react";
import { useStore } from "../store";
import { Button, Card, Empty, Field, FREQ_OPTIONS, Money, Progress } from "../components/ui";
import { Confirm, Modal } from "../components/Layout";
import { createId } from "../lib/ids";
import { stamp } from "../lib/defaults";
import { parseDollarsToCents } from "../lib/money";
import { categoryRows } from "../lib/calculations";
import type { Category, RecurringExpense } from "../lib/types";
import { todayYmd } from "../lib/dates";

export function BudgetPage() {
  const { state, saveCategory, removeCategory, setBudget, reorderCategories, saveExpense, removeExpense, locked } = useStore();
  const rows = categoryRows(state, state.currentMonth);
  const [edit, setEdit] = useState<Category | null>(null);
  const [del, setDel] = useState<string | null>(null);
  const [expense, setExpense] = useState<Partial<RecurringExpense> | null>(null);

  const move = (id: string, dir: -1 | 1) => {
    const ids = state.categories.slice().sort((a, b) => a.sortOrder - b.sortOrder).map((c) => c.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorderCategories(ids);
  };

  return (
    <div className="stack">
      <div className="between">
        <p className="muted">Budgeted → spent → remaining for {state.currentMonth}. Drag order with the arrows.</p>
        <div className="wrap">
          <Button onClick={() => setExpense({ name: "", amountCents: 0, frequency: "monthly", nextDate: todayYmd(), active: true })}>Add recurring expense</Button>
          <Button variant="primary" disabled={locked} onClick={() => setEdit({
            id: createId("cat"), name: "", icon: "📦", color: "#1f6f5b", defaultBudgetCents: 0, rollover: state.settings.defaultRollover, recurring: true, sortOrder: state.categories.length, kind: "expense", ...stamp(),
          })}>Add category</Button>
        </div>
      </div>
      {rows.length === 0 ? <Empty title="No categories" hint="Add a category to start budgeting." /> : rows.map((row) => (
        <Card key={row.category.id}>
          <div className="between">
            <div className="row">
              <span style={{ fontSize: 22 }}>{row.category.icon}</span>
              <div>
                <div className="name">{row.category.name}</div>
                <div className="tiny muted">{row.category.rollover ? "Rollover on" : "No rollover"}{row.rolloverInCents ? ` · +${(row.rolloverInCents / 100).toFixed(2)} from last month` : ""}</div>
              </div>
            </div>
            <div className="wrap">
              <Button variant="small" onClick={() => move(row.category.id, -1)}>↑</Button>
              <Button variant="small" onClick={() => move(row.category.id, 1)}>↓</Button>
              <Button variant="small" onClick={() => setEdit(row.category)}>Edit</Button>
              <Button variant="small" className="danger" onClick={() => setDel(row.category.id)}>Delete</Button>
            </div>
          </div>
          <div className="grid grid-3" style={{ margin: "12px 0" }}>
            <div><div className="tiny muted">Budgeted</div><b><Money cents={row.budgetedCents} /></b></div>
            <div><div className="tiny muted">Spent</div><b><Money cents={row.spentCents} /></b></div>
            <div><div className="tiny muted">Remaining</div><b><Money cents={row.remainingCents} /></b></div>
          </div>
          <Progress value={row.spentCents} max={Math.max(1, row.budgetedCents)} />
          <Field label="This month’s budget">
            <input className="input" inputMode="decimal" defaultValue={(row.budgetedCents / 100).toFixed(2)} disabled={locked} onBlur={(e) => setBudget(row.category.id, parseDollarsToCents(e.target.value))} />
          </Field>
        </Card>
      ))}

      <Card>
        <h2>Recurring expenses</h2>
        {state.expenses.length === 0 ? <Empty title="No recurring expenses" /> : state.expenses.map((e) => (
          <div key={e.id} className="item">
            <div>
              <div className="name">{e.name}</div>
              <div className="tiny muted">{e.frequency} · next {e.nextDate} {e.active ? "" : "· inactive"}</div>
            </div>
            <div className="row">
              <Money cents={e.amountCents} />
              <Button variant="small" onClick={() => setExpense(e)}>Edit</Button>
              <Button variant="small" className="danger" onClick={() => removeExpense(e.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </Card>

      <Modal open={!!edit} title={edit && state.categories.some((c) => c.id === edit.id) ? "Edit category" : "Add category"} onClose={() => setEdit(null)}>
        {edit ? (
          <form className="form-grid" onSubmit={(ev) => { ev.preventDefault(); saveCategory(edit); setEdit(null); }}>
            <Field label="Name" className="full"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></Field>
            <Field label="Icon"><input className="input" value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} /></Field>
            <Field label="Color"><input className="input" type="color" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} /></Field>
            <Field label="Default budget"><input className="input" inputMode="decimal" defaultValue={(edit.defaultBudgetCents / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, defaultBudgetCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Kind">
              <select className="input" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as Category["kind"] })}>
                <option value="expense">Expense</option>
                <option value="savings">Savings</option>
                <option value="debt">Debt</option>
                <option value="income">Income</option>
              </select>
            </Field>
            <label className="field"><input type="checkbox" checked={edit.rollover} onChange={(e) => setEdit({ ...edit, rollover: e.target.checked })} /> Rollover leftover</label>
            <label className="field"><input type="checkbox" checked={edit.recurring} onChange={(e) => setEdit({ ...edit, recurring: e.target.checked })} /> Recurring</label>
            <div className="full row" style={{ justifyContent: "flex-end" }}><Button type="submit" variant="primary">Save</Button></div>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!expense} title="Recurring expense" onClose={() => setExpense(null)}>
        {expense ? (
          <form className="form-grid" onSubmit={(ev) => {
            ev.preventDefault();
            const item: RecurringExpense = {
              id: expense.id || createId("exp"),
              name: expense.name || "Expense",
              amountCents: expense.amountCents || 0,
              categoryId: expense.categoryId || null,
              frequency: expense.frequency || "monthly",
              nextDate: expense.nextDate || todayYmd(),
              startDate: expense.startDate || expense.nextDate || todayYmd(),
              endDate: expense.endDate || null,
              active: expense.active !== false,
              notes: expense.notes || "",
              ...stamp(),
            };
            saveExpense(item);
            setExpense(null);
          }}>
            <Field label="Name" className="full"><input className="input" value={expense.name || ""} onChange={(e) => setExpense({ ...expense, name: e.target.value })} required /></Field>
            <Field label="Amount"><input className="input" inputMode="decimal" defaultValue={((expense.amountCents || 0) / 100).toFixed(2)} onBlur={(e) => setExpense({ ...expense, amountCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Frequency">
              <select className="input" value={expense.frequency || "monthly"} onChange={(e) => setExpense({ ...expense, frequency: e.target.value as RecurringExpense["frequency"] })}>
                {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Next / start"><input className="input" type="date" value={expense.nextDate || ""} onChange={(e) => setExpense({ ...expense, nextDate: e.target.value, startDate: e.target.value })} /></Field>
            <Field label="End (optional)"><input className="input" type="date" value={expense.endDate || ""} onChange={(e) => setExpense({ ...expense, endDate: e.target.value || null })} /></Field>
            <Field label="Category">
              <select className="input" value={expense.categoryId || ""} onChange={(e) => setExpense({ ...expense, categoryId: e.target.value || null })}>
                <option value="">None</option>
                {state.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <label className="field"><input type="checkbox" checked={expense.active !== false} onChange={(e) => setExpense({ ...expense, active: e.target.checked })} /> Active</label>
            <div className="full row" style={{ justifyContent: "flex-end" }}><Button type="submit" variant="primary">Save</Button></div>
          </form>
        ) : null}
      </Modal>

      <Confirm open={!!del} title="Delete this category?" body="Transactions stay, but they will no longer be grouped here." danger confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) removeCategory(del); setDel(null); }} />
    </div>
  );
}
