import { useEffect, useState } from "react";
import { Layout, parseHash, type PageId } from "./components/Layout";
import { QuickAdd } from "./components/QuickAdd";
import { DashboardPage } from "./pages/Dashboard";
import { BudgetPage } from "./pages/Budget";
import { TransactionsPage } from "./pages/Transactions";
import { BillsPage } from "./pages/Bills";
import { IncomePage } from "./pages/Income";
import { SavingsPage } from "./pages/Savings";
import { DebtPage } from "./pages/Debt";
import { BucketsPage } from "./pages/Buckets";
import { HistoryPage } from "./pages/History";
import { SettingsPage } from "./pages/Settings";
import { CalendarPage } from "./pages/Calendar";
import { NetWorthPage } from "./pages/NetWorth";
import { GoalsPage } from "./pages/Goals";
import { PaycheckPage } from "./pages/Paycheck";
import { useStore } from "./store";
import { upcomingWithinDays, overdueItems, nextPaycheck } from "./lib/calculations";
import { todayYmd } from "./lib/dates";
import { formatMoney } from "./lib/money";

export function App() {
  const { state } = useStore();
  const [page, setPage] = useState<PageId>(parseHash());
  const [quick, setQuick] = useState<string | null>(null);

  useEffect(() => {
    const theme = state.settings.theme;
    const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [state.settings.theme]);

  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const today = todayYmd();
    const n = state.settings.notifications;
    if (n.overdueBills) {
      const overdue = overdueItems(state, today).filter((o) => o.kind === "bill");
      if (overdue.length) {
        new Notification("Overdue bills", { body: `${overdue.length} bill${overdue.length === 1 ? "" : "s"} need attention.` });
      }
    }
    if (n.upcomingBills) {
      const due = upcomingWithinDays(state, 2, today);
      if (due.length) {
        new Notification("Upcoming bills", {
          body: due.map((b) => `${b.name} · ${formatMoney(b.amountCents, { currency: state.settings.currency })}`).join(", "),
        });
      }
    }
    if (n.paydays) {
      const pay = nextPaycheck(state, today);
      if (pay && pay.date <= today) {
        new Notification("Payday", { body: `${pay.name} · ${formatMoney(pay.amountCents, { currency: state.settings.currency })}` });
      }
    }
    // Intentionally run once per session when notification prefs exist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (id: PageId) => {
    location.hash = `#/${id}`;
    setPage(id);
  };

  return (
    <Layout page={page} onPage={setPage}>
      {page === "dashboard" && <DashboardPage onPage={go} onQuick={setQuick} />}
      {page === "budget" && <BudgetPage />}
      {page === "transactions" && <TransactionsPage onAdd={() => setQuick("transaction")} />}
      {page === "bills" && <BillsPage />}
      {page === "income" && <IncomePage />}
      {page === "savings" && <SavingsPage />}
      {page === "debt" && <DebtPage />}
      {page === "buckets" && <BucketsPage />}
      {page === "history" && <HistoryPage />}
      {page === "settings" && <SettingsPage />}
      {page === "calendar" && <CalendarPage />}
      {page === "networth" && <NetWorthPage />}
      {page === "goals" && <GoalsPage />}
      {page === "paycheck" && <PaycheckPage />}
      <QuickAdd kind={quick} onClose={() => setQuick(null)} />
    </Layout>
  );
}
