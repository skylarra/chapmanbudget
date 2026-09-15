import { useMemo, useState } from "react";
import { useStore } from "../store";
import { Button, Card, Field, Money } from "../components/ui";
import { activeBillsSorted, mainIncomeSource, recommendedPerPaycheck } from "../lib/calculations";
import { parseDollarsToCents } from "../lib/money";
import { todayYmd } from "../lib/dates";
import type { PageId } from "../components/Layout";

interface Line {
  key: string;
  kind: "expense" | "savings";
  id: string;
  label: string;
  group: "Bills" | "Spending" | "Savings";
  amount: string;
}

export function PaycheckPage({ onPage }: { onPage: (id: PageId) => void }) {
  const { state, budgetPaycheck } = useStore();
  const source = mainIncomeSource(state);
  const [amount, setAmount] = useState(((source?.expectedCents || 0) / 100).toFixed(2));
  const [date, setDate] = useState(source?.nextDate || todayYmd());
  const bills = activeBillsSorted(state);
  const payFreq = source?.frequency ?? "biweekly";

  const initial = useMemo<Line[]>(() => {
    const billLines: Line[] = bills.map((b) => ({
      key: `bill-${b.id}`,
      kind: "expense" as const,
      id: b.bucketId || state.expenseBuckets[0]?.id || "",
      label: b.name,
      group: "Bills" as const,
      amount: b.bucketId ? (recommendedPerPaycheck(b, payFreq) / 100).toFixed(2) : (b.amountCents / 100).toFixed(2),
    })).filter((l) => l.id);
    const spendLines: Line[] = state.expenseBuckets
      .filter((b) => !billLines.some((l) => l.id === b.id))
      .map((b) => ({
        key: `exp-${b.id}`,
        kind: "expense" as const,
        id: b.id,
        label: b.name,
        group: "Spending" as const,
        amount: b.targetCents ? (Math.round((b.targetCents * 12) / 26) / 100).toFixed(2) : "0.00",
      }));
    const saveLines: Line[] = state.savingsBuckets.map((s) => ({
      key: `sav-${s.id}`,
      kind: "savings" as const,
      id: s.id,
      label: s.name,
      group: "Savings" as const,
      amount: ((s.autoContributionCents || 0) / 100).toFixed(2),
    }));
    return [...billLines, ...spendLines, ...saveLines];
  }, [state.expenseBuckets, state.savingsBuckets, bills, payFreq]);

  const [lines, setLines] = useState(initial);
  const total = parseDollarsToCents(amount);
  const assigned = lines.reduce((s, l) => s + parseDollarsToCents(l.amount), 0);
  const unassigned = total - assigned;

  const setAmt = (key: string, value: string) => setLines(lines.map((l) => (l.key === key ? { ...l, amount: value } : l)));

  const confirm = () => {
    budgetPaycheck({
      amountCents: total,
      date,
      sourceId: source?.id ?? null,
      description: source?.name || "Paycheck",
      lines: lines
        .map((l) => ({ kind: l.kind, id: l.id, amountCents: parseDollarsToCents(l.amount), label: l.label }))
        .filter((l) => l.amountCents > 0 && l.id),
    });
    onPage("dashboard");
  };

  const groups: Line["group"][] = ["Bills", "Spending", "Savings"];

  return (
    <div className="stack">
      <Card>
        <h2>{source?.name || "Paycheck"}</h2>
        <div className="form-grid">
          <Field label="Amount received"><input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <p className="tiny muted">Adjust the actual deposit if it differs from the expected amount, then assign it. Suggested bill amounts are recommendations only.</p>
      </Card>
      {groups.map((g) => (
        <Card key={g}>
          <h2>{g}</h2>
          {lines.filter((l) => l.group === g).map((l) => (
            <div key={l.key} className="between" style={{ marginBottom: 8 }}>
              <span>{l.label}</span>
              <input className="input" style={{ maxWidth: 120 }} value={l.amount} onChange={(e) => setAmt(l.key, e.target.value)} />
            </div>
          ))}
        </Card>
      ))}
      <Card>
        <div className="between"><span>Paycheck</span><Money cents={total} /></div>
        <div className="between"><span>Assigned</span><Money cents={assigned} /></div>
        <div className="between"><b>Unassigned from this paycheck</b><b className={unassigned < 0 ? "neg" : "pos"}><Money cents={unassigned} /></b></div>
        <p className="tiny muted">Already available stays in place. After confirm, available will be <Money cents={state.unassignedCents + unassigned} />.</p>
      </Card>
      <Button variant="primary" disabled={total <= 0 || unassigned < 0} onClick={confirm}>Confirm assignments</Button>
    </div>
  );
}
