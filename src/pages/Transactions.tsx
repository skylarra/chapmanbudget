import { useMemo, useState } from "react";
import { useStore } from "../store";
import { Button, Card, Empty, Field, Money } from "../components/ui";
import { Confirm } from "../components/Layout";
import { monthBounds } from "../lib/dates";

const TYPE_LABEL = { expense: "Expense", income: "Income", transfer: "Transfer" } as const;

export function TransactionsPage({ onAdd }: { onAdd: () => void }) {
  const { state, removeTx } = useStore();
  const { startYmd, endYmd } = monthBounds(state.currentMonth);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [bucket, setBucket] = useState("");
  const [from, setFrom] = useState(startYmd);
  const [to, setTo] = useState(endYmd);
  const [del, setDel] = useState<string | null>(null);

  const nameOf = (id: string | null) =>
    state.expenseBuckets.find((b) => b.id === id)?.name ||
    state.savingsBuckets.find((b) => b.id === id)?.name ||
    "";

  const rows = useMemo(() => {
    return state.transactions
      .filter((t) => t.date >= from && t.date <= to)
      .filter((t) => !q || t.description.toLowerCase().includes(q.toLowerCase()) || t.notes.toLowerCase().includes(q.toLowerCase()))
      .filter((t) => !type || t.type === type)
      .filter((t) => !bucket || t.expenseBucketId === bucket || t.savingsBucketId === bucket || t.fromId === bucket || t.toId === bucket)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [state.transactions, q, type, bucket, from, to]);

  return (
    <div className="stack">
      <div className="between">
        <p className="muted">Transfers do not count as income or spending. Search and filter to find a purchase quickly.</p>
        <Button variant="primary" onClick={onAdd}>Add transaction</Button>
      </div>
      <Card>
        <div className="form-grid">
          <Field label="Search"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Description" /></Field>
          <Field label="Type">
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
            </select>
          </Field>
          <Field label="From"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label="Bucket" className="full">
            <select className="input" value={bucket} onChange={(e) => setBucket(e.target.value)}>
              <option value="">All buckets</option>
              {state.expenseBuckets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              {state.savingsBuckets.map((b) => <option key={`s-${b.id}`} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        </div>
      </Card>
      {rows.length === 0 ? <Empty title="No transactions match" /> : rows.map((t) => (
        <div key={t.id} className="item">
          <div>
            <div className="name">{t.description}</div>
            <div className="tiny muted">
              {t.date} · {TYPE_LABEL[t.type]}
              {t.expenseBucketId ? ` · ${nameOf(t.expenseBucketId)}` : ""}
              {t.savingsBucketId && t.type !== "expense" ? ` · ${nameOf(t.savingsBucketId)}` : ""}
            </div>
          </div>
          <div className="row">
            <Money cents={t.type === "income" ? t.amountCents : t.type === "expense" ? -t.amountCents : t.amountCents} signed={t.type !== "transfer"} />
            <Button variant="small" onClick={() => setDel(t.id)}>Delete</Button>
          </div>
        </div>
      ))}
      <Confirm open={!!del} title="Delete this transaction?" body="Bucket balances will be reversed." danger confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => { if (del) removeTx(del); setDel(null); }} />
    </div>
  );
}

