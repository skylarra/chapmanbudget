import { useMemo, useState } from "react";
import { useStore } from "../store";
import { Card, Money } from "../components/ui";
import { Modal } from "../components/Layout";
import { billOccurrences, expenseOccurrences, incomeOccurrences } from "../lib/calculations";
import { daysInMonth, parseMonthKey, toYmd, weekdayOf } from "../lib/dates";
import type { ScheduledItem } from "../lib/calculations";

export function CalendarPage() {
  const { state } = useStore();
  const parsed = parseMonthKey(state.currentMonth) ?? { year: new Date().getFullYear(), monthIndex: new Date().getMonth() };
  const start = `${state.currentMonth}-01`;
  const dim = daysInMonth(parsed.year, parsed.monthIndex);
  const end = `${state.currentMonth}-${String(dim).padStart(2, "0")}`;
  const items = [
    ...incomeOccurrences(state, start, end),
    ...billOccurrences(state, start, end),
    ...expenseOccurrences(state, start, end),
  ];
  const firstWeekday = weekdayOf(start);
  const offset = (firstWeekday - state.settings.firstDayOfWeek + 7) % 7;
  const [open, setOpen] = useState<ScheduledItem | null>(null);
  const days = useMemo(() => {
    const cells: { ymd: string | null; day: number | null }[] = [];
    for (let i = 0; i < offset; i += 1) cells.push({ ymd: null, day: null });
    for (let d = 1; d <= dim; d += 1) {
      const ymd = `${state.currentMonth}-${String(d).padStart(2, "0")}`;
      cells.push({ ymd, day: d });
    }
    return cells;
  }, [offset, dim, state.currentMonth]);

  const color = (kind: string) => (kind === "income" ? "#1f6f5b" : kind === "bill" ? "#b42318" : "#2c6e9a");

  return (
    <div className="stack">
      <Card>
        <div className="wrap" style={{ marginBottom: 10 }}>
          <span className="pill"><span className="dot" style={{ background: "#1f6f5b" }} /> Payday</span>
          <span className="pill"><span className="dot" style={{ background: "#b42318" }} /> Bill</span>
          <span className="pill"><span className="dot" style={{ background: "#2c6e9a" }} /> Expense</span>
        </div>
        <div className="cal">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
            <div key={d} className="dow">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][(i + state.settings.firstDayOfWeek) % 7]}</div>
          ))}
          {days.map((cell, i) => {
            const dayItems = items.filter((it) => it.date === cell.ymd);
            return (
              <div key={i} className={`day ${cell.ymd ? "" : "out"}`}>
                <div>{cell.day ?? ""}</div>
                {dayItems.slice(0, 3).map((it) => (
                  <button key={it.key} className="tiny" style={{ display: "block", border: 0, background: "transparent", color: color(it.kind), textAlign: "left", padding: 0 }} onClick={() => setOpen(it)}>
                    {it.name}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </Card>
      <Modal open={!!open} title={open?.name || ""} onClose={() => setOpen(null)}>
        {open ? (
          <div className="stack">
            <div>{open.kind} · {open.date} · {open.status}</div>
            <div><Money cents={open.amountCents} /></div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

void toYmd;
