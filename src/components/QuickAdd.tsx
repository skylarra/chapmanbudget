import { useEffect, useState, type FormEvent } from "react";
import { useStore } from "../store";
import { Button, Field } from "./ui";
import { Modal } from "./Layout";
import { parseDollarsToCents } from "../lib/money";
import { todayYmd } from "../lib/dates";
import type { PoolKind } from "../lib/types";

export function QuickAdd({ kind, onClose }: { kind: "expense" | "income" | "transfer" | null; onClose: () => void }) {
  const { state, addExpense, addIncome, transfer } = useStore();
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayYmd());
  const [bucketId, setBucketId] = useState(state.expenseBuckets[0]?.id || "");
  const [sourceId, setSourceId] = useState(state.incomeSources[0]?.id || "");
  const [from, setFrom] = useState("available:");
  const [to, setTo] = useState(state.expenseBuckets[0] ? `expense:${state.expenseBuckets[0].id}` : "available:");
  const [advance, setAdvance] = useState(true);

  useEffect(() => {
    if (!kind) return;
    setAmount("");
    setName("");
    setDate(todayYmd());
    setBucketId(state.expenseBuckets[0]?.id || "");
    setSourceId(state.incomeSources[0]?.id || "");
    setFrom("available:");
    setTo(state.expenseBuckets[0] ? `expense:${state.expenseBuckets[0].id}` : "available:");
    setAdvance(true);
  }, [kind]);

  const title = kind === "income" ? "Add income" : kind === "transfer" ? "Transfer" : "Add transaction";

  const parsePool = (value: string): { kind: PoolKind; id: string | null } => {
    const [k, id] = value.split(":");
    return { kind: (k as PoolKind) || "available", id: id || null };
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseDollarsToCents(amount);
    if (cents <= 0) return;
    if (kind === "income") {
      addIncome({ amountCents: cents, description: name || "Income", date, sourceId: sourceId || null, advance });
    } else if (kind === "transfer") {
      const f = parsePool(from);
      const t = parsePool(to);
      transfer({ amountCents: cents, date, fromKind: f.kind, fromId: f.id, toKind: t.kind, toId: t.id, notes: name });
    } else {
      if (!bucketId) return;
      addExpense({ amountCents: cents, description: name || "Purchase", date, bucketId });
    }
    onClose();
  };

  return (
    <Modal open={!!kind} title={title} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Amount"><input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus /></Field>
        <Field label="Date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {kind !== "transfer" ? (
          <Field label={kind === "income" ? "Source / description" : "Description"} className="full">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "income" ? "Paycheck" : "Store"} />
          </Field>
        ) : (
          <Field label="Note" className="full"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        )}
        {kind === "expense" || kind === null ? (
          <Field label="Bucket" className="full">
            <select className="input" value={bucketId} onChange={(e) => setBucketId(e.target.value)}>
              {state.expenseBuckets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        ) : null}
        {kind === "income" ? (
          <>
            <Field label="Income source" className="full">
              <select className="input" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value="">One-time / other</option>
                {state.incomeSources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <label className="field full"><input type="checkbox" checked={advance} onChange={(e) => setAdvance(e.target.checked)} /> This is the expected paycheck (advance the schedule)</label>
          </>
        ) : null}
        {kind === "transfer" ? (
          <>
            <Field label="From">
              <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
                <option value="available:">Available</option>
                {state.expenseBuckets.map((b) => <option key={b.id} value={`expense:${b.id}`}>{b.name}</option>)}
                {state.savingsBuckets.map((b) => <option key={b.id} value={`savings:${b.id}`}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="To">
              <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="available:">Available</option>
                {state.expenseBuckets.map((b) => <option key={b.id} value={`expense:${b.id}`}>{b.name}</option>)}
                {state.savingsBuckets.map((b) => <option key={b.id} value={`savings:${b.id}`}>{b.name}</option>)}
              </select>
            </Field>
          </>
        ) : null}
        <div className="full row" style={{ justifyContent: "flex-end" }}>
          <Button type="submit" variant="primary">Save</Button>
        </div>
      </form>
    </Modal>
  );
}

