import { useMemo, useState } from "react";
import { useStore } from "../store";
import { Button, Card, Empty, Field, Money } from "../components/ui";
import { formatNiceDate, monthBounds } from "../lib/dates";
import { billOccurrences, mainIncomeSource, paycheckOccurrences } from "../lib/calculations";
import { createId } from "../lib/ids";
import { parseDollarsToCents } from "../lib/money";
import type { PaycheckAssignment } from "../lib/types";

export function PaycheckPage() {
  const { state, savePaycheckPlan, locked } = useStore();
  const main = mainIncomeSource(state);
  const { startYmd, endYmd } = monthBounds(state.currentMonth);
  const pays = paycheckOccurrences(state, startYmd, endYmd);
  const bills = billOccurrences(state, startYmd, endYmd);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const plans = useMemo(() => {
    return pays.map((p) => {
      const existing = state.paycheckPlans.find((x) => x.incomeSourceId === p.source.id && x.occurrenceDate === p.date);
      return { pay: p, plan: existing };
    });
  }, [pays, state.paycheckPlans]);

  if (!main) return <Empty title="Add a paycheck first" hint="Create a repeating income source, then assign bills to each payday." />;

  return (
    <div className="stack">
      <p className="muted">For each paycheck, see what it needs to cover. Assign bills, buckets, and extra debt payments to a payday.</p>
      {plans.map(({ pay, plan }) => {
        const assignments = plan?.assignments ?? [];
        const used = assignments.reduce((s, a) => s + a.amountCents, 0);
        const remaining = pay.amountCents - used;
        const key = `${pay.source.id}:${pay.date}`;
        return (
          <Card key={key}>
            <div className="between">
              <div>
                <h2 style={{ margin: 0 }}>{formatNiceDate(pay.date)} paycheck</h2>
                <div className="tiny muted">{pay.source.name}</div>
              </div>
              <div>Income <b><Money cents={pay.amountCents} /></b></div>
            </div>
            <div className="stack" style={{ marginTop: 12 }}>
              {assignments.length === 0 ? <div className="muted">Nothing assigned yet.</div> : assignments.map((a) => (
                <div key={a.id} className="between">
                  <span>{a.label}</span>
                  <Money cents={a.amountCents} />
                </div>
              ))}
              <div className="between"><b>Remaining</b><b><Money cents={remaining} /></b></div>
            </div>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <Field label="Assign a bill">
                <select className="input" disabled={locked} onChange={(e) => {
                  const bill = state.bills.find((b) => b.id === e.target.value);
                  if (!bill) return;
                  const next: PaycheckAssignment[] = [...assignments, { id: createId("asg"), kind: "bill", targetId: bill.id, amountCents: bill.expectedCents, label: bill.name }];
                  savePaycheckPlan({ id: plan?.id || createId("pay"), incomeSourceId: pay.source.id, occurrenceDate: pay.date, assignments: next });
                  e.target.value = "";
                }}>
                  <option value="">Choose bill…</option>
                  {bills.map((b) => <option key={b.key} value={b.sourceId}>{b.name} ({b.date})</option>)}
                </select>
              </Field>
              <Field label="Assign a bucket">
                <select className="input" disabled={locked} onChange={(e) => {
                  const bucket = state.buckets.find((b) => b.id === e.target.value);
                  if (!bucket) return;
                  const next = [...assignments, { id: createId("asg"), kind: "bucket" as const, targetId: bucket.id, amountCents: bucket.contributionCents || 0, label: bucket.name }];
                  savePaycheckPlan({ id: plan?.id || createId("pay"), incomeSourceId: pay.source.id, occurrenceDate: pay.date, assignments: next });
                  e.target.value = "";
                }}>
                  <option value="">Choose bucket…</option>
                  {state.buckets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
              <Field label="Extra debt amount">
                <input className="input" placeholder="0.00" value={drafts[key] || ""} onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })} />
              </Field>
              <Button disabled={locked} onClick={() => {
                const cents = parseDollarsToCents(drafts[key] || "0");
                if (!cents) return;
                const next = [...assignments, { id: createId("asg"), kind: "debt" as const, targetId: state.debts[0]?.id || "debt", amountCents: cents, label: "Debt extra" }];
                savePaycheckPlan({ id: plan?.id || createId("pay"), incomeSourceId: pay.source.id, occurrenceDate: pay.date, assignments: next });
                setDrafts({ ...drafts, [key]: "" });
              }}>Add extra debt</Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
