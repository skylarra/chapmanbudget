import { useMemo, useState } from "react";
import { useStore } from "../store";
import { Button, Card, Empty, Field, FREQ_OPTIONS, Money, Progress } from "../components/ui";
import { Modal } from "../components/Layout";
import { LineChart } from "../components/Charts";
import { createId } from "../lib/ids";
import { stamp } from "../lib/defaults";
import { parseDollarsToCents } from "../lib/money";
import { comparePayoffScenarios, formatPayoffDate, projectPayoff } from "../lib/debt";
import { debtFreeProjection, debtViews, monthDebtReduction } from "../lib/calculations";
import { todayYmd } from "../lib/dates";
import { DEBT_TYPES, type Debt, type Frequency } from "../lib/types";

export function DebtPage() {
  const { state, saveDebt, removeDebt, recordDebtPayment, locked } = useStore();
  const today = todayYmd();
  const views = debtViews(state, today);
  const total = views.reduce((s, v) => s + v.debt.currentBalanceCents, 0);
  const reduction = monthDebtReduction(state, state.currentMonth);
  const free = debtFreeProjection(state, today);
  const [edit, setEdit] = useState<Partial<Debt> | null>(null);
  const [pay, setPay] = useState<{ id: string; scheduled: string; extra: string; principalOnly: boolean } | null>(null);
  const [calc, setCalc] = useState({
    balance: "10000",
    apr: "6.5",
    payment: "250",
    extra: "50",
    frequency: "biweekly" as Frequency,
  });

  const scenario = useMemo(() => {
    const base = {
      balanceCents: parseDollarsToCents(calc.balance),
      aprBps: Math.round(Number(calc.apr) * 100) || 0,
      paymentCents: parseDollarsToCents(calc.payment),
      frequency: calc.frequency,
      startDate: today,
    };
    return comparePayoffScenarios(base, parseDollarsToCents(calc.extra));
  }, [calc, today]);

  const history = state.netWorthSnapshots.slice(-12);

  return (
    <div className="stack">
      <Card>
        <div className="tiny muted">Total debt</div>
        <div className="value" style={{ fontSize: "2rem" }}><Money cents={total} /></div>
        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <div><div className="tiny muted">Reduced this month</div><b><Money cents={reduction.principal || reduction.total} /></b></div>
          <div><div className="tiny muted">Principal / interest</div><b><Money cents={reduction.principal} /> / <Money cents={reduction.interest} /></b></div>
          <div><div className="tiny muted">Projected debt-free</div><b>{formatPayoffDate(free.latest)}</b></div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="between"><span>Debt-free progress</span><span>{free.progress.toFixed(1)}%</span></div>
          <Progress value={free.progress} max={100} />
        </div>
      </Card>

      {history.length > 1 ? (
        <Card>
          <h2>Debt over time</h2>
          <LineChart labels={history.map((h) => h.monthKey)} values={history.map((h) => h.liabilitiesCents)} color="#b42318" />
        </Card>
      ) : null}

      <div className="between">
        <p className="muted">Mortgage and refinance loans support bi-weekly payments plus extra principal. Figures are estimates.</p>
        <Button variant="primary" disabled={locked} onClick={() => setEdit({
          name: "", type: "mortgage", originalBalanceCents: 0, currentBalanceCents: 0, originalLoanCents: 0, aprBps: 425,
          minimumPaymentCents: 0, plannedPaymentCents: 0, extraPaymentCents: 0, frequency: "biweekly", dueDate: today,
          creditLimitCents: null, startDate: today, originalPayoffDate: null, notes: "", accountId: null,
        })}>Add debt</Button>
      </div>

      {views.length === 0 ? <Empty title="No debts yet" hint="Add your mortgage, refinance loan, auto loan, or cards." /> : views.map((v) => {
        const d = v.debt;
        const extra = d.extraPaymentCents;
        const planned = d.plannedPaymentCents || d.minimumPaymentCents;
        return (
          <Card key={d.id}>
            <div className="between">
              <div>
                <div className="name">{d.name}</div>
                <div className="tiny muted">{d.type} · {(d.aprBps / 100).toFixed(2)}% APR · {d.frequency}</div>
              </div>
              <div className="wrap">
                <Button variant="small" disabled={locked} onClick={() => setPay({ id: d.id, scheduled: (planned / 100).toFixed(2), extra: (extra / 100).toFixed(2), principalOnly: false })}>Record payment</Button>
                <Button variant="small" onClick={() => setEdit(d)}>Edit</Button>
                <Button variant="small" className="danger" onClick={() => removeDebt(d.id)}>Delete</Button>
              </div>
            </div>
            <div className="grid grid-3" style={{ marginTop: 12 }}>
              <div><div className="tiny muted">Remaining</div><b><Money cents={d.currentBalanceCents} /></b></div>
              <div><div className="tiny muted">Minimum / planned</div><b><Money cents={d.minimumPaymentCents} /> / <Money cents={planned} /></b></div>
              <div><div className="tiny muted">Projected payoff</div><b>{v.projectedPayoffLabel}</b></div>
            </div>
            {d.type === "credit" && d.creditLimitCents ? (
              <div className="tiny muted" style={{ marginTop: 8 }}>
                Limit <Money cents={d.creditLimitCents} /> · available <Money cents={v.availableCreditCents || 0} /> · utilization {v.utilization?.toFixed(1)}%
              </div>
            ) : null}
            <div className="card" style={{ marginTop: 12, background: "var(--bg)" }}>
              <div className="tiny muted">Extra payment effect (estimate)</div>
              <p>
                Paying an additional <Money cents={extra} /> every {d.frequency === "biweekly" ? "two weeks" : d.frequency} could pay the loan off{" "}
                <b>{v.compare.monthsSaved}</b> months earlier and save approximately <Money cents={v.compare.interestSavedCents} /> in interest.
              </p>
              <div className="tiny muted">Original payoff: {v.originalPayoffLabel} · extra principal this plan: <Money cents={v.extraPayoff.extraPrincipalCents} /></div>
              {d.frequency === "biweekly" ? (
                <div className="tiny muted">Normal <Money cents={planned} /> + extra <Money cents={extra} /> = total <Money cents={planned + extra} /></div>
              ) : null}
            </div>
          </Card>
        );
      })}

      <Card>
        <h2>Payoff calculator</h2>
        <p className="tiny muted">Experiment without changing your accounts. Results are estimates.</p>
        <div className="form-grid">
          <Field label="Balance"><input className="input" value={calc.balance} onChange={(e) => setCalc({ ...calc, balance: e.target.value })} /></Field>
          <Field label="APR %"><input className="input" value={calc.apr} onChange={(e) => setCalc({ ...calc, apr: e.target.value })} /></Field>
          <Field label="Payment"><input className="input" value={calc.payment} onChange={(e) => setCalc({ ...calc, payment: e.target.value })} /></Field>
          <Field label="Extra"><input className="input" value={calc.extra} onChange={(e) => setCalc({ ...calc, extra: e.target.value })} /></Field>
          <Field label="Frequency">
            <select className="input" value={calc.frequency} onChange={(e) => setCalc({ ...calc, frequency: e.target.value as Frequency })}>
              {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          <div className="card">
            <h3>Current plan</h3>
            <div><Money cents={parseDollarsToCents(calc.payment)} /> every {calc.frequency === "biweekly" ? "two weeks" : calc.frequency}</div>
            <div>Payoff: {formatPayoffDate(scenario.current.payoffDate)}</div>
            <div>Interest: <Money cents={scenario.current.interestCents} /></div>
          </div>
          <div className="card">
            <h3>With extra</h3>
            <div><Money cents={parseDollarsToCents(calc.payment) + parseDollarsToCents(calc.extra)} /> every {calc.frequency === "biweekly" ? "two weeks" : calc.frequency}</div>
            <div>Payoff: {formatPayoffDate(scenario.extra.payoffDate)}</div>
            <div>Interest: <Money cents={scenario.extra.interestCents} /></div>
            <div className="pos">Saves {scenario.monthsSaved} months and <Money cents={scenario.interestSavedCents} /></div>
          </div>
        </div>
      </Card>

      <Modal open={!!edit} title="Debt account" onClose={() => setEdit(null)}>
        {edit ? (
          <form className="form-grid" onSubmit={(ev) => {
            ev.preventDefault();
            saveDebt({
              id: edit.id || createId("debt"),
              name: edit.name || "Debt",
              type: edit.type || "other",
              originalBalanceCents: edit.originalBalanceCents || 0,
              currentBalanceCents: edit.currentBalanceCents || 0,
              originalLoanCents: edit.originalLoanCents || edit.originalBalanceCents || 0,
              aprBps: edit.aprBps || 0,
              minimumPaymentCents: edit.minimumPaymentCents || 0,
              plannedPaymentCents: edit.plannedPaymentCents || edit.minimumPaymentCents || 0,
              extraPaymentCents: edit.extraPaymentCents || 0,
              frequency: edit.frequency || "monthly",
              dueDate: edit.dueDate || today,
              creditLimitCents: edit.type === "credit" ? edit.creditLimitCents ?? 0 : edit.creditLimitCents ?? null,
              startDate: edit.startDate || null,
              originalPayoffDate: edit.originalPayoffDate || null,
              notes: edit.notes || "",
              accountId: edit.accountId || null,
              ...stamp(),
            });
            setEdit(null);
          }}>
            <Field label="Name" className="full"><input className="input" value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></Field>
            <Field label="Type">
              <select className="input" value={edit.type || "other"} onChange={(e) => setEdit({ ...edit, type: e.target.value as Debt["type"] })}>
                {DEBT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="APR %"><input className="input" defaultValue={((edit.aprBps || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, aprBps: Math.round(Number(e.target.value) * 100) || 0 })} /></Field>
            <Field label="Current balance"><input className="input" defaultValue={((edit.currentBalanceCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, currentBalanceCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Original balance"><input className="input" defaultValue={((edit.originalBalanceCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, originalBalanceCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Original loan"><input className="input" defaultValue={((edit.originalLoanCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, originalLoanCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Minimum payment"><input className="input" defaultValue={((edit.minimumPaymentCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, minimumPaymentCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Planned / bi-weekly payment"><input className="input" defaultValue={((edit.plannedPaymentCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, plannedPaymentCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Extra principal"><input className="input" defaultValue={((edit.extraPaymentCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, extraPaymentCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Field label="Frequency">
              <select className="input" value={edit.frequency || "monthly"} onChange={(e) => setEdit({ ...edit, frequency: e.target.value as Debt["frequency"] })}>
                {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Due date"><input className="input" type="date" value={edit.dueDate || ""} onChange={(e) => setEdit({ ...edit, dueDate: e.target.value })} /></Field>
            <Field label="Start date"><input className="input" type="date" value={edit.startDate || ""} onChange={(e) => setEdit({ ...edit, startDate: e.target.value || null })} /></Field>
            <Field label="Original payoff date"><input className="input" type="date" value={edit.originalPayoffDate || ""} onChange={(e) => setEdit({ ...edit, originalPayoffDate: e.target.value || null })} /></Field>
            {edit.type === "credit" ? (
              <Field label="Credit limit"><input className="input" defaultValue={((edit.creditLimitCents || 0) / 100).toFixed(2)} onBlur={(e) => setEdit({ ...edit, creditLimitCents: parseDollarsToCents(e.target.value) })} /></Field>
            ) : null}
            <Field label="Notes" className="full"><textarea className="input" value={edit.notes || ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <div className="full row" style={{ justifyContent: "flex-end" }}><Button type="submit" variant="primary">Save</Button></div>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!pay} title="Record debt payment" onClose={() => setPay(null)}>
        {pay ? (
          <form className="stack" onSubmit={(ev) => {
            ev.preventDefault();
            recordDebtPayment({
              debtId: pay.id,
              date: today,
              scheduledCents: pay.principalOnly ? 0 : parseDollarsToCents(pay.scheduled),
              extraCents: pay.principalOnly ? parseDollarsToCents(pay.scheduled) + parseDollarsToCents(pay.extra) : parseDollarsToCents(pay.extra),
              principalOnly: pay.principalOnly,
              accountId: state.accounts[0]?.id ?? null,
              occurrenceDate: today,
            });
            setPay(null);
          }}>
            <Field label="Scheduled payment"><input className="input" value={pay.scheduled} onChange={(e) => setPay({ ...pay, scheduled: e.target.value })} disabled={pay.principalOnly} /></Field>
            <Field label="Extra / additional principal"><input className="input" value={pay.extra} onChange={(e) => setPay({ ...pay, extra: e.target.value })} /></Field>
            <label className="field"><input type="checkbox" checked={pay.principalOnly} onChange={(e) => setPay({ ...pay, principalOnly: e.target.checked })} /> Principal-only payment</label>
            <p className="tiny muted">Scheduled vs extra are tracked separately. Interest split is an estimate.</p>
            <Button type="submit" variant="primary">Save payment</Button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}

void projectPayoff;
