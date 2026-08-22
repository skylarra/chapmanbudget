import { useMemo, useState } from "react";
import { useStore } from "../store";
import { Button, Card, Empty, Field, Money } from "../components/ui";
import { Confirm, Modal } from "../components/Layout";
import { monthBounds } from "../lib/dates";
import { parseDollarsToCents } from "../lib/money";
import { TRANSACTION_TYPES, type Transaction, type TransactionType } from "../lib/types";

const TYPE_LABEL: Record<TransactionType, string> = {
  income: "Income",
  expense: "Expense",
  bill_payment: "Bill payment",
  debt_payment: "Debt payment",
  extra_debt_payment: "Extra debt payment",
  principal_debt_payment: "Principal-only payment",
  savings_contribution: "Savings contribution",
  savings_withdrawal: "Savings withdrawal",
  bucket_contribution: "Bucket contribution",
  bucket_withdrawal: "Bucket withdrawal",
  transfer: "Transfer",
};

export function TransactionsPage({ onAdd }: { onAdd: () => void }) {
  const { state, updateTx, removeTx, bulkRemoveTx, duplicateTx, locked } = useStore();
  const { startYmd, endYmd } = monthBounds(state.currentMonth);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [account, setAccount] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [from, setFrom] = useState(startYmd);
  const [to, setTo] = useState(endYmd);
  const [edit, setEdit] = useState<Transaction | null>(null);
  const [del, setDel] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState(false);

  const rows = useMemo(() => {
    const minC = min ? parseDollarsToCents(min) : null;
    const maxC = max ? parseDollarsToCents(max) : null;
    return state.transactions
      .filter((t) => t.date >= from && t.date <= to)
      .filter((t) => !q || t.description.toLowerCase().includes(q.toLowerCase()) || t.notes.toLowerCase().includes(q.toLowerCase()))
      .filter((t) => !type || t.type === type)
      .filter((t) => !category || t.categoryId === category)
      .filter((t) => !account || t.accountId === account || t.toAccountId === account)
      .filter((t) => minC == null || t.amountCents >= minC)
      .filter((t) => maxC == null || t.amountCents <= maxC)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [state.transactions, q, type, category, account, min, max, from, to]);

  const catName = (id: string | null) => state.categories.find((c) => c.id === id)?.name ?? "";

  return (
    <div className="stack">
      <div className="between">
        <p className="muted">Transfers, savings, and bucket moves are recorded here but do not count as spending.</p>
        <Button variant="primary" disabled={locked} onClick={onAdd}>Add transaction</Button>
      </div>
      <Card>
        <div className="form-grid">
          <Field label="Search"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
          <Field label="Type">
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field label="From"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label="Category">
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All</option>
              {state.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Account">
            <select className="input" value={account} onChange={(e) => setAccount(e.target.value)}>
              <option value="">All</option>
              {state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Min amount"><input className="input" value={min} onChange={(e) => setMin(e.target.value)} /></Field>
          <Field label="Max amount"><input className="input" value={max} onChange={(e) => setMax(e.target.value)} /></Field>
        </div>
      </Card>
      {rows.length === 0 ? <Empty title="No transactions match" /> : rows.map((t) => (
        <div key={t.id} className="item">
          <label className="row">
            <input type="checkbox" checked={selected.includes(t.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, t.id] : selected.filter((id) => id !== t.id))} />
            <div>
              <div className="name">{t.description}</div>
              <div className="tiny muted">{t.date} · {TYPE_LABEL[t.type]} {catName(t.categoryId) ? `· ${catName(t.categoryId)}` : ""}</div>
            </div>
          </label>
          <div className="row">
            <Money cents={t.type === "income" || t.type.endsWith("withdrawal") ? t.amountCents : t.type === "transfer" ? t.amountCents : t.amountCents} signed={t.type === "income"} />
            <Button variant="small" onClick={() => setEdit(t)}>Edit</Button>
            <Button variant="small" disabled={locked} onClick={() => duplicateTx(t.id)}>Duplicate</Button>
            <Button variant="small" className="danger" disabled={locked} onClick={() => setDel(t.id)}>Delete</Button>
          </div>
        </div>
      ))}
      {selected.length > 0 ? (
        <div className="card between">
          <span>{selected.length} selected</span>
          <Button variant="danger" disabled={locked} onClick={() => setBulk(true)}>Delete selected</Button>
        </div>
      ) : null}

      <Modal open={!!edit} title="Edit transaction" onClose={() => setEdit(null)}>
        {edit ? (
          <form className="form-grid" onSubmit={(ev) => { ev.preventDefault(); updateTx(edit); setEdit(null); }}>
            <Field label="Description" className="full"><input className="input" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="Amount"><input className="input" defaultValue={(edit.amountCents / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, amountCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Date"><input className="input" type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></Field>
            <Field label="Type">
              <select className="input" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as TransactionType })}>
                {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select className="input" value={edit.categoryId || ""} onChange={(e) => setEdit({ ...edit, categoryId: e.target.value || null })}>
                <option value="">None</option>
                {state.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Notes" className="full"><textarea className="input" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <div className="full row" style={{ justifyContent: "flex-end" }}><Button type="submit" variant="primary">Save</Button></div>
          </form>
        ) : null}
      </Modal>
      <Confirm open={!!del} title="Delete this transaction?" body="This cannot be undone." danger confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) removeTx(del); setDel(null); }} />
      <Confirm open={bulk} title={`Delete ${selected.length} transactions?`} body="This cannot be undone." danger confirmLabel="Delete" onClose={() => setBulk(false)} onConfirm={() => { bulkRemoveTx(selected); setSelected([]); setBulk(false); }} />
    </div>
  );
}

export { TYPE_LABEL };
