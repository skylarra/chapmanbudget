import { useState } from "react";
import { useStore } from "../store";
import { Button, Card, Empty, Field, Money, Progress } from "../components/ui";
import { Modal } from "../components/Layout";
import { createId } from "../lib/ids";
import { stamp } from "../lib/defaults";
import { parseDollarsToCents } from "../lib/money";
import { suggestedContribution } from "../lib/calculations";
import type { FinancialGoal } from "../lib/types";

export function GoalsPage() {
  const { state, saveGoal, removeGoal } = useStore();
  const [edit, setEdit] = useState<Partial<FinancialGoal> | null>(null);

  const currentFor = (g: FinancialGoal) => {
    if (g.linkedDebtId) {
      const d = state.debts.find((x) => x.id === g.linkedDebtId);
      return d ? Math.max(0, (d.originalBalanceCents || g.targetCents) - d.currentBalanceCents) : g.currentCents;
    }
    if (g.linkedSavingsId) {
      const s = state.savingsGoals.find((x) => x.id === g.linkedSavingsId);
      return s?.currentCents ?? g.currentCents;
    }
    return g.currentCents;
  };

  return (
    <div className="stack">
      <div className="between">
        <p className="muted">Optional targets like “save $8,000” or “pay off the truck.”</p>
        <Button variant="primary" onClick={() => setEdit({ name: "", kind: "custom", targetCents: 0, currentCents: 0, targetDate: null, linkedDebtId: null, linkedSavingsId: null, notes: "" })}>Add goal</Button>
      </div>
      {state.financialGoals.length === 0 ? <Empty title="No goals yet" /> : state.financialGoals.map((g) => {
        const current = currentFor(g);
        const remaining = Math.max(0, g.targetCents - current);
        return (
          <Card key={g.id}>
            <div className="between">
              <div>
                <div className="name">{g.name}</div>
                <div className="tiny muted">{g.kind} {g.targetDate ? `· ${g.targetDate}` : ""}</div>
              </div>
              <Button variant="small" onClick={() => setEdit(g)}>Edit</Button>
            </div>
            <div className="between"><Money cents={current} /> / <Money cents={g.targetCents} /></div>
            <Progress value={current} max={Math.max(1, g.targetCents)} />
            <div className="tiny muted">Remaining <Money cents={remaining} /> · suggested <Money cents={suggestedContribution(g.targetCents, current, g.targetDate)} /> / month</div>
            <Button variant="ghost" onClick={() => removeGoal(g.id)}>Delete</Button>
          </Card>
        );
      })}
      <Modal open={!!edit} title="Goal" onClose={() => setEdit(null)}>
        {edit ? (
          <form className="form-grid" onSubmit={(ev) => {
            ev.preventDefault();
            saveGoal({
              id: edit.id || createId("goal"),
              name: edit.name || "Goal",
              kind: edit.kind || "custom",
              targetCents: edit.targetCents || 0,
              currentCents: edit.currentCents || 0,
              targetDate: edit.targetDate || null,
              linkedDebtId: edit.linkedDebtId || null,
              linkedSavingsId: edit.linkedSavingsId || null,
              notes: edit.notes || "",
              ...stamp(),
            });
            setEdit(null);
          }}>
            <Field label="Name" className="full"><input className="input" value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Kind">
              <select className="input" value={edit.kind || "custom"} onChange={(e) => setEdit({ ...edit, kind: e.target.value as FinancialGoal["kind"] })}>
                <option value="save">Save</option>
                <option value="payoff">Pay off</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
            <Field label="Target"><input className="input" defaultValue={((edit.targetCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, targetCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Current"><input className="input" defaultValue={((edit.currentCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, currentCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Target date"><input className="input" type="date" value={edit.targetDate || ""} onChange={(e) => setEdit({ ...edit, targetDate: e.target.value || null })} /></Field>
            <Field label="Link debt">
              <select className="input" value={edit.linkedDebtId || ""} onChange={(e) => setEdit({ ...edit, linkedDebtId: e.target.value || null })}>
                <option value="">None</option>
                {state.debts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Link savings">
              <select className="input" value={edit.linkedSavingsId || ""} onChange={(e) => setEdit({ ...edit, linkedSavingsId: e.target.value || null })}>
                <option value="">None</option>
                {state.savingsGoals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
            <div className="full row" style={{ justifyContent: "flex-end" }}>
              <Button type="submit" variant="primary">Save</Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
