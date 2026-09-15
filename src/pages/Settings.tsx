import { useRef, useState } from "react";
import { useStore } from "../store";
import { Button, Card, Field } from "../components/ui";
import { exportJson, previewImport } from "../lib/importExport";
import type { ThemePreference } from "../lib/types";

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SettingsPage() {
  const { state, updateSettings, replaceAll, resetAll, markBackupNow } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ReturnType<typeof previewImport> | null>(null);
  const [phrase, setPhrase] = useState("");
  const [clear, setClear] = useState(false);

  const backup = () => {
    download(`boodget-backup-${state.currentMonth}.json`, exportJson(state));
    markBackupNow();
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
            <select className="input" value={state.settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as ThemePreference })}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        <h2>Backup and restore</h2>
        <p className="muted">All Boodget data stays on this device. Download a JSON backup before switching phones or clearing the browser.</p>
        <p className="tiny muted">Last backup: {state.settings.lastBackupAt ? new Date(state.settings.lastBackupAt).toLocaleString() : "Never"}</p>
        <div className="wrap">
          <Button variant="primary" onClick={backup}>Download backup</Button>
          <Button onClick={() => fileRef.current?.click()}>Restore backup</Button>
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
                <p>This file looks like a <b>{preview.kind}</b> backup.</p>
                <ul>{Object.entries(preview.counts).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
                <p className="tiny muted">Restore replaces all current Boodget data on this device. A safety copy is stored first.</p>
                <div className="row">
                  <Button variant="ghost" onClick={() => setPreview(null)}>Cancel</Button>
                  <Button variant="danger" onClick={() => { if (preview.state) replaceAll(preview.state); setPreview(null); }}>Replace my data</Button>
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
          <div className="modal center" onClick={(e) => e.stopPropagation()}>
            <h3>Clear all Boodget data?</h3>
            <p>Type DELETE to confirm. Download a backup first if you might need this budget later.</p>
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
