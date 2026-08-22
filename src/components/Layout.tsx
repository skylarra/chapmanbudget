import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatMonthLabel, addMonthsKey, monthKeyFromDate } from "../lib/dates";
import { globalSearch } from "../lib/calculations";
import { useStore } from "../store";
import { Button } from "./ui";

export type PageId =
  | "dashboard"
  | "budget"
  | "transactions"
  | "bills"
  | "income"
  | "savings"
  | "debt"
  | "buckets"
  | "history"
  | "settings"
  | "calendar"
  | "networth"
  | "goals"
  | "paycheck";

const NAV: { id: PageId; label: string; icon: string; mobile?: boolean }[] = [
  { id: "dashboard", label: "Dashboard", icon: "⌂", mobile: true },
  { id: "budget", label: "Budget", icon: "▦", mobile: true },
  { id: "bills", label: "Bills", icon: "☑", mobile: true },
  { id: "transactions", label: "Transactions", icon: "☰", mobile: true },
  { id: "income", label: "Income", icon: "↓" },
  { id: "savings", label: "Savings", icon: "◎" },
  { id: "debt", label: "Debt", icon: "%" },
  { id: "buckets", label: "Buckets", icon: "▢" },
  { id: "paycheck", label: "Paychecks", icon: "◇" },
  { id: "calendar", label: "Calendar", icon: "▦" },
  { id: "history", label: "History", icon: "↺" },
  { id: "networth", label: "Net worth", icon: "◈" },
  { id: "goals", label: "Goals", icon: "★" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export function parseHash(): PageId {
  const h = (location.hash.replace(/^#\/?/, "") || "dashboard").split("?")[0];
  return (NAV.some((n) => n.id === h) ? h : "dashboard") as PageId;
}

export function Layout({ page, onPage, children }: { page: PageId; onPage: (id: PageId) => void; children: ReactNode }) {
  const { state, setMonth, locked, loadError } = useStore();
  const [search, setSearch] = useState("");
  const [more, setMore] = useState(false);
  const results = useMemo(() => (search.length > 1 ? globalSearch(state, search) : []), [search, state]);

  useEffect(() => {
    const onHash = () => onPage(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [onPage]);

  const go = (id: PageId) => {
    location.hash = `#/${id}`;
    onPage(id);
    setMore(false);
    setSearch("");
  };

  const jump = (kind: string) => {
    const map: Record<string, PageId> = {
      transaction: "transactions",
      bill: "bills",
      expense: "budget",
      income: "income",
      debt: "debt",
      savings: "savings",
      bucket: "buckets",
    };
    go(map[kind] || "dashboard");
  };

  return (
    <div className="app-shell">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <img src="./icon.svg" alt="" width={36} height={36} />
          <div>
            <h1>Chapman Budget</h1>
            <p>Household money</p>
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
          {locked ? (
            <div className="banner" role="status" style={{ marginBottom: 12 }}>
              {formatMonthLabel(state.currentMonth)} is archived and read-only. Unlock it from History if you need to edit.
            </div>
          ) : null}
          <div className="topbar">
            <div>
              <h2 className="page-title">{NAV.find((n) => n.id === page)?.label}</h2>
              <p className="page-sub">{formatMonthLabel(state.currentMonth)}</p>
            </div>
            <div className="wrap">
              <Button variant="ghost" onClick={() => setMonth(addMonthsKey(state.currentMonth, -1))} aria-label="Previous month">←</Button>
              <Button variant="ghost" onClick={() => setMonth(monthKeyFromDate(new Date()))}>This month</Button>
              <Button variant="ghost" onClick={() => setMonth(addMonthsKey(state.currentMonth, 1))} aria-label="Next month">→</Button>
              <label className="field" style={{ minWidth: 180, margin: 0 }}>
                <span className="skip">Search</span>
                <input className="input" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
            </div>
          </div>
          {search.length > 1 ? (
            <div className="card" style={{ marginBottom: 14 }}>
              <h3>Search results</h3>
              {results.length === 0 ? <div className="muted">No matches.</div> : results.map((r) => (
                <div key={`${r.kind}-${r.id}`} className="search-hit" onClick={() => jump(r.kind)} onKeyDown={(e) => e.key === "Enter" && jump(r.kind)} role="button" tabIndex={0}>
                  <div className="tiny muted">{r.kind}</div>
                  <div className="name">{r.title}</div>
                  <div className="tiny muted">{r.subtitle}</div>
                </div>
              ))}
            </div>
          ) : null}
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

export function Confirm({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  danger,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal center" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="confirm-title">{title}</h3>
        <div className="muted" style={{ marginBottom: 16 }}>{body}</div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
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



