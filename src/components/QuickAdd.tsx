import { useState, type FormEvent } from "react";
import { useStore } from "../store";
import { Button, Field, FREQ_OPTIONS } from "./ui";
import { Modal } from "./Layout";
import { parseDollarsToCents } from "../lib/money";
import { todayYmd } from "../lib/dates";
import { createId } from "../lib/ids";
import { stamp } from "../lib/defaults";
import type { TransactionType } from "../lib/types";

export function QuickAdd({ kind, onClose }: { kind: string | null; onClose: () => void }) {
  const store = useStore();
  const { state } = store;
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayYmd());
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id || "");
  const [accountId, setAccountId] = useState(state.accounts[0]?.id || "");
  const [toId, setToId] = useState(state.accounts[1]?.id || "");
  const [freq, setFreq] = useState("monthly");
  const [debtId, setDebtId] = useState(state.debts[0]?.id || "");
  const [goalId, setGoalId] = useState(state.savingsGoals[0]?.id || state.buckets[0]?.id || "");

  const title =
    kind === "income" ? "Add income" :
    kind === "bill" ? "Add bill" :
    kind === "expense" ? "Add expense" :
    kind === "savings" ? "Savings contribution" :
    kind === "debt" ? "Debt payment" :
    kind === "transfer" ? "Transfer" :
    "Add transaction";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseDollarsToCents(amount);
    if (kind === "income") {
      store.saveIncome({
        id: createId("inc"),
        name: name || "Income",
        amountCents: cents,
        frequency: freq as "monthly",
        nextDate: date,
        startDate: date,
        endDate: freq === "once" ? date : null,
        active: true,
        notes: "",
        accountId: accountId || null,
        ...stamp(),
      });
    } else if (kind === "bill") {
      store.saveBill({
        id: createId("bill"),
        name: name || "Bill",
        expectedCents: cents,
        dueDate: date,
        frequency: freq as "monthly",
        categoryId: categoryId || null,
        autopay: false,
        active: true,
        notes: "",
        accountId: accountId || null,
        debtId: null,
        paymentMethod: "",
        ...stamp(),
      });
    } else if (kind === "expense") {
      store.addTx({ description: name || "Expense", amountCents: cents, type: "expense", date, categoryId: categoryId || null, accountId: accountId || null });
    } else if (kind === "savings") {
      if (state.savingsGoals.some((g) => g.id === goalId)) store.contributeSavings(goalId, cents, date, accountId || null, false);
      else store.contributeBucket(goalId, cents, date, accountId || null, false);
    } else if (kind === "debt") {
      store.recordDebtPayment({ debtId, date, scheduledCents: cents, extraCents: 0, principalOnly: false, accountId: accountId || null, occurrenceDate: date });
    } else if (kind === "transfer") {
      store.transferAccounts(accountId, toId, cents, date);
    } else {
      store.addTx({ description: name || "Transaction", amountCents: cents, type: "expense" as TransactionType, date, categoryId: categoryId || null, accountId: accountId || null });
    }
    onClose();
  };

  return (
    <Modal open={!!kind} title={title} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        {kind !== "transfer" && kind !== "debt" && kind !== "savings" ? (
          <Field label="Name" className="full"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required={kind === "bill" || kind === "income"} /></Field>
        ) : null}
        <Field label="Amount"><input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
        <Field label="Date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {kind === "income" || kind === "bill" ? (
          <Field label="Frequency">
            <select className="input" value={freq} onChange={(e) => setFreq(e.target.value)}>
              {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        ) : null}
        {kind === "expense" || kind === "transaction" || !kind ? (
          <Field label="Category">
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {state.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        ) : null}
        {kind === "debt" ? (
          <Field label="Debt">
            <select className="input" value={debtId} onChange={(e) => setDebtId(e.target.value)}>
              {state.debts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        ) : null}
        {kind === "savings" ? (
          <Field label="Goal or bucket">
            <select className="input" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              {state.savingsGoals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              {state.buckets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        ) : null}
        {kind === "transfer" ? (
          <>
            <Field label="From">
              <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="To">
              <select className="input" value={toId} onChange={(e) => setToId(e.target.value)}>
                {state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          </>
        ) : (
          <Field label="Account">
            <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        )}
        <div className="full row" style={{ justifyContent: "flex-end" }}>
          <Button type="submit" variant="primary">Save</Button>
        </div>
      </form>
    </Modal>
  );
}
