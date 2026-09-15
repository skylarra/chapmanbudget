import { useEffect, useState } from "react";
import { Layout, parseHash, type PageId } from "./components/Layout";
import { QuickAdd } from "./components/QuickAdd";
import { DashboardPage } from "./pages/Dashboard";
import { BillsPage } from "./pages/Bills";
import { BucketsPage } from "./pages/Buckets";
import { SavingsPage } from "./pages/Savings";
import { TransactionsPage } from "./pages/Transactions";
import { IncomePage } from "./pages/Income";
import { SettingsPage } from "./pages/Settings";
import { PaycheckPage } from "./pages/Paycheck";
import { useStore } from "./store";

export function App() {
  const { state } = useStore();
  const [page, setPage] = useState<PageId>(parseHash());
  const [quick, setQuick] = useState<"expense" | "income" | "transfer" | null>(null);

  useEffect(() => {
    const theme = state.settings.theme;
    const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [state.settings.theme]);

  const go = (id: PageId) => {
    location.hash = `#/${id}`;
    setPage(id);
  };

  return (
    <Layout page={page} onPage={setPage}>
      {page === "dashboard" && <DashboardPage onPage={go} onQuick={setQuick} />}
      {page === "bills" && <BillsPage />}
      {page === "buckets" && <BucketsPage />}
      {page === "savings" && <SavingsPage />}
      {page === "transactions" && <TransactionsPage onAdd={() => setQuick("expense")} />}
      {page === "income" && <IncomePage onPage={go} onAdd={() => setQuick("income")} />}
      {page === "settings" && <SettingsPage />}
      {page === "paycheck" && <PaycheckPage onPage={go} />}
      <QuickAdd kind={quick} onClose={() => setQuick(null)} />
    </Layout>
  );
}
