import { useEffect, useState, type ReactNode } from "react";
import { addMonthsKey, formatMonthLabel, monthKeyFromDate } from "../lib/dates";
import { useStore } from "../store";
import { Button } from "./ui";

export type PageId = "dashboard" | "bills" | "buckets" | "savings" | "transactions" | "income" | "settings" | "paycheck";

const NAV: { id: PageId; label: string; icon: string; mobile?: boolean }[] = [
  { id: "dashboard", label: "Dashboard", icon: "⌂", mobile: true },
  { id: "bills", label: "Bills", icon: "☑", mobile: true },
  { id: "buckets", label: "Buckets", icon: "▢", mobile: true },
  { id: "transactions", label: "Transactions", icon: "☰", mobile: true },
  { id: "savings", label: "Savings", icon: "◎" },
  { id: "income", label: "Income", icon: "↓" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export function parseHash(): PageId {
  const h = (location.hash.replace(/^#\/?/, "") || "dashboard").split("?")[0];
  return NAV.some((n) => n.id === h) || h === "paycheck" ? (h as PageId) : "dashboard";
}

export function Layout({ page, onPage, children }: { page: PageId; onPage: (id: PageId) => void; children: ReactNode }) {
  const { state, setMonth, loadError } = useStore();
  const [more, setMore] = useState(false);

  useEffect(() => {
    const onHash = () => onPage(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [onPage]);

  const go = (id: PageId) => {
    location.hash = `#/${id}`;
    onPage(id);
    setMore(false);
  };

  return (
    <div className="app-shell">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="12" fill="#1f6f5b"/><path fill="#f4f7f5" d="M24 10c-3 0-5 2-5 5v3h-6c-2 0-4 2-4 4v16c0 2 2 4 4 4h22c2 0 4-2 4-4V22c0-2-2-4-4-4h-6v-3c0-3-2-5-5-5zm0 3c1 0 2 1 2 2v3h-4v-3c0-1 1-2 2-2zm-11 9h22v16H13V22zm11 4a5 5 0 100 10 5 5 0 000-10z"/></svg>
          <div>
            <h1>Boodget</h1>
            <p>Bucket budgeting</p>
          </div>
        </div>
        {NAV.map((n) => (
          <button key={n.id} className={`nav-btn ${page === n.id ? "active" : ""}`} onClick={() => go(n.id)} aria-current={page === n.id ? "page" : undefined}>
            <span aria-hidden="true">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </aside>
      <div>
        <main className="main" id="main">
          {loadError ? <div className="banner" role="alert">{loadError}</div> : null}
          <div className="topbar">
            <div>
              <h2 className="page-title">{page === "paycheck" ? "Budget this paycheck" : NAV.find((n) => n.id === page)?.label}</h2>
              <p className="page-sub">{formatMonthLabel(state.currentMonth)}</p>
            </div>
            <div className="wrap">
              <Button variant="ghost" onClick={() => setMonth(addMonthsKey(state.currentMonth, -1))}>←</Button>
              <Button variant="ghost" onClick={() => setMonth(monthKeyFromDate(new Date()))}>This month</Button>
              <Button variant="ghost" onClick={() => setMonth(addMonthsKey(state.currentMonth, 1))}>→</Button>
            </div>
          </div>
          {children}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile">
        {NAV.filter((n) => n.mobile).map((n) => (
          <button key={n.id} className={page === n.id ? "active" : ""} onClick={() => go(n.id)}>
            <span aria-hidden="true">{n.icon}</span>
            {n.label}
          </button>
        ))}
        <button className={more ? "active" : ""} onClick={() => setMore(true)}>
          <span aria-hidden="true">⋯</span>
          More
        </button>
      </nav>
      {more ? (
        <div className="overlay" onClick={() => setMore(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>More</h3>
            <div className="stack">
              {NAV.filter((n) => !n.mobile).map((n) => (
                <Button key={n.id} onClick={() => go(n.id)}>{n.label}</Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal center" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(e) => e.stopPropagation()}>
        <div className="between" style={{ marginBottom: 12 }}>
          <h3 id="modal-title" style={{ margin: 0 }}>{title}</h3>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({
  open, title, body, confirmLabel = "Confirm", danger, onClose, onConfirm,
}: {
  open: boolean; title: string; body: ReactNode; confirmLabel?: string; danger?: boolean; onClose: () => void; onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal center" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <div className="muted" style={{ marginBottom: 16 }}>{body}</div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
