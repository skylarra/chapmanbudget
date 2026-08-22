import { useRef, useState } from "react";
import { useStore } from "../store";
import { Button, Card, Field } from "../components/ui";
import { billsToCsv, debtsToCsv, exportJson, previewImport, transactionsToCsv } from "../lib/importExport";
import { createId } from "../lib/ids";
import { stamp } from "../lib/defaults";
import { parseDollarsToCents } from "../lib/money";
import type { Account } from "../lib/types";

function download(filename: string, text: string, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SettingsPage() {
  const { state, updateSettings, saveAccount, removeAccount, replaceAll, mergeIn, resetAll, markBackupNow } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ReturnType<typeof previewImport> | null>(null);
  const [mode, setMode] = useState<"replace" | "merge">("replace");
  const [clear, setClear] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [acct, setAcct] = useState<Partial<Account> | null>(null);
  const [notifyMsg, setNotifyMsg] = useState("");

  const backup = (kind: "json" | "legacy" | "csv-tx" | "csv-bills" | "csv-debts") => {
    if (kind === "json") download(`budget-${state.currentMonth}.json`, exportJson(state));
    if (kind === "csv-tx") download(`transactions-${state.currentMonth}.csv`, transactionsToCsv(state), "text/csv");
    if (kind === "csv-bills") download(`bills-${state.currentMonth}.csv`, billsToCsv(state), "text/csv");
    if (kind === "csv-debts") download(`debts-${state.currentMonth}.csv`, debtsToCsv(state), "text/csv");
    markBackupNow();
  };

  const requestNotes = async () => {
    if (!("Notification" in window)) {
      setNotifyMsg("This browser does not support notifications.");
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifyMsg(perm === "granted" ? "Reminders enabled for this device." : "Notifications were not allowed.");
  };

  return (
    <div className="stack">
      <Card>
        <h2>General</h2>
        <div className="form-grid">
          <Field label="Currency">
            <select className="input" value={state.settings.currency} onChange={(e) => updateSettings({ currency: e.target.value })}>
              {["USD", "CAD", "GBP", "EUR", "AUD"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Theme">
            <select className="input" value={state.settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as "light" | "dark" | "system" })}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Field>
          <Field label="First day of week">
            <select className="input" value={state.settings.firstDayOfWeek} onChange={(e) => updateSettings({ firstDayOfWeek: Number(e.target.value) })}>
              <option value={0}>Sunday</option>
              <option value={1}>Monday</option>
            </select>
          </Field>
          <Field label="First day of month">
            <input className="input" type="number" min={1} max={28} value={state.settings.firstDayOfMonth} onChange={(e) => updateSettings({ firstDayOfMonth: Number(e.target.value) })} />
          </Field>
          <Field label="Date format">
            <select className="input" value={state.settings.dateFormat} onChange={(e) => updateSettings({ dateFormat: e.target.value as "short" | "medium" })}>
              <option value="medium">Medium</option>
              <option value="short">Short</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        <h2>Budget defaults</h2>
        <label className="field"><input type="checkbox" checked={state.settings.defaultRollover} onChange={(e) => updateSettings({ defaultRollover: e.target.checked })} /> Default rollover leftover into next month</label>
        <p className="tiny muted">New categories start with the built-in household list (mortgage, groceries, emergency fund, and so on) at $0.</p>
      </Card>

      <Card>
        <h2>Accounts</h2>
        {state.accounts.map((a) => (
          <div key={a.id} className="item">
            <div>
              <div className="name">{a.name}</div>
              <div className="tiny muted">{a.type} · starting {(a.startingBalanceCents / 100).toFixed(2)}</div>
            </div>
            <div className="row">
              <Button variant="small" onClick={() => setAcct(a)}>Edit</Button>
              <Button variant="small" className="danger" onClick={() => removeAccount(a.id)}>Delete</Button>
            </div>
          </div>
        ))}
        <Button onClick={() => setAcct({ name: "", type: "checking", startingBalanceCents: 0 })}>Add account</Button>
        {acct ? (
          <form className="form-grid" style={{ marginTop: 12 }} onSubmit={(ev) => {
            ev.preventDefault();
            saveAccount({
              id: acct.id || createId("acct"),
              name: acct.name || "Account",
              type: acct.type || "checking",
              startingBalanceCents: acct.startingBalanceCents || 0,
              ...stamp(),
            });
            setAcct(null);
          }}>
            <Field label="Name"><input className="input" value={acct.name || ""} onChange={(e) => setAcct({ ...acct, name: e.target.value })} /></Field>
            <Field label="Type">
              <select className="input" value={acct.type || "checking"} onChange={(e) => setAcct({ ...acct, type: e.target.value as Account["type"] })}>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="credit">Credit card</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Starting balance"><input className="input" defaultValue={((acct.startingBalanceCents || 0) / 100).toFixed(2)} onBlur={(e) => setAcct({ ...acct, startingBalanceCents: parseDollarsToCents(e.target.value) })} /></Field>
            <Button type="submit" variant="primary">Save account</Button>
          </form>
        ) : null}
      </Card>

      <Card>
        <h2>Notifications</h2>
        <label className="field"><input type="checkbox" checked={state.settings.notifications.upcomingBills} onChange={(e) => updateSettings({ notifications: { ...state.settings.notifications, upcomingBills: e.target.checked } })} /> Upcoming bills</label>
        <label className="field"><input type="checkbox" checked={state.settings.notifications.overdueBills} onChange={(e) => updateSettings({ notifications: { ...state.settings.notifications, overdueBills: e.target.checked } })} /> Overdue bills</label>
        <label className="field"><input type="checkbox" checked={state.settings.notifications.paydays} onChange={(e) => updateSettings({ notifications: { ...state.settings.notifications, paydays: e.target.checked } })} /> Upcoming paydays</label>
        <Button onClick={requestNotes}>Enable browser reminders</Button>
        {notifyMsg ? <p className="tiny muted">{notifyMsg}</p> : null}
      </Card>

      <Card>
        <h2>Data</h2>
        <p className="tiny muted">Last backup: {state.settings.lastBackupAt ? new Date(state.settings.lastBackupAt).toLocaleString() : "Never"}</p>
        <div className="wrap">
          <Button variant="primary" onClick={() => backup("json")}>Backup now (JSON)</Button>
          <Button onClick={() => backup("csv-tx")}>Export transactions CSV</Button>
          <Button onClick={() => backup("csv-bills")}>Export bills CSV</Button>
          <Button onClick={() => backup("csv-debts")}>Export debts CSV</Button>
          <Button onClick={() => fileRef.current?.click()}>Import JSON</Button>
        </div>
        <input ref={fileRef} type="file" accept=".json,.txt,application/json,text/plain" hidden onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => setPreview(previewImport(String(reader.result || "")));
          reader.readAsText(file);
          e.target.value = "";
        }} />
        {preview ? (
          <div className="card" style={{ marginTop: 12 }}>
            {preview.valid ? (
              <>
                <p>This file looks like a <b>{preview.kind}</b> backup{preview.exportedAt ? ` from ${preview.exportedAt}` : ""}.</p>
                <ul>
                  {Object.entries(preview.counts).map(([k, v]) => <li key={k}>{k}: {v}</li>)}
                </ul>
                <p className="tiny muted">Replace overwrites everything. Merge keeps your current records and adds new IDs. A safety copy is stored on this device first.</p>
                <label className="field">
                  Import mode
                  <select className="input" value={mode} onChange={(e) => setMode(e.target.value as "replace" | "merge")}>
                    <option value="replace">Replace all data</option>
                    <option value="merge">Merge</option>
                  </select>
                </label>
                <div className="row">
                  <Button variant="ghost" onClick={() => setPreview(null)}>Cancel</Button>
                  <Button variant="danger" onClick={() => {
                    if (!preview.state) return;
                    if (mode === "replace") replaceAll(preview.state);
                    else mergeIn(preview.state);
                    setPreview(null);
                  }}>{mode === "replace" ? "Replace my data" : "Merge"}</Button>
                </div>
              </>
            ) : <p>{preview.error}</p>}
          </div>
        ) : null}
      </Card>

      <Card>
        <h2>Danger zone</h2>
        <Button variant="danger" onClick={() => { setClear(true); setPhrase(""); }}>Clear all data</Button>
      </Card>

      {clear ? (
        <div className="overlay" onClick={() => setClear(false)}>
          <div className="modal center" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Clear all budget data?</h3>
            <p>This erases income, bills, debts, and transactions on this device. Type DELETE to confirm.</p>
            <input className="input" value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="DELETE" />
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
              <Button variant="ghost" onClick={() => setClear(false)}>Cancel</Button>
              <Button variant="danger" disabled={phrase.trim() !== "DELETE"} onClick={() => { resetAll(); setClear(false); }}>Erase everything</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
