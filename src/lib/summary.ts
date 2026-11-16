import { addDays, differenceInCalendarDays } from "date-fns";
import { Category, Movement, Settings } from "../types";
import { calculatePeriod, calculateVariablePeriod } from "./period";
import { formatLocalDate, parseLocalDate } from "./format";

export interface DateRange {
  startDate: string;
  endDate: string;
}

const shift = (d: string, days: number) => formatLocalDate(addDays(parseLocalDate(d), days));

/** Período actual (offset 0) o anteriores (1, 2, …) para el Resumen. */
export function periodAtOffset(s: Settings, todayStr: string, offset: number): DateRange {
  if (s.incomeMode === "daily" && s.dailyRangeStart && s.dailyRangeEnd) {
    const cur = calculateVariablePeriod(s.dailyRangeStart, s.dailyRangeEnd, todayStr);
    let r: DateRange = { startDate: cur.startDate, endDate: cur.endDate };
    for (let i = 1; i <= offset; i++) {
      const prev = i === 1 && s.dailyPreviousRange && s.dailyPreviousRange.endDate < r.startDate ? s.dailyPreviousRange : null;
      if (prev) r = { ...prev };
      else {
        const len = differenceInCalendarDays(parseLocalDate(r.endDate), parseLocalDate(r.startDate)) + 1;
        r = { startDate: shift(r.startDate, -len), endDate: shift(r.startDate, -1) };
      }
    }
    return r;
  }
  let p = calculatePeriod(todayStr, s.payday || 1);
  for (let i = 0; i < offset; i++) p = calculatePeriod(shift(p.startDate, -1), s.payday || 1);
  return { startDate: p.startDate, endDate: p.endDate };
}

export interface CategorySpend {
  categoryId: string;
  name: string;
  color: string;
  amount: number;
  pct: number;
  movements: Movement[];
}

/** Gastos por categoría (mayor primero), total gastado e ingresos (sueldo del período + ingresos anotados). */
export function summarizePeriod(p: {
  movements: Movement[];
  categories: Category[];
  startDate: string;
  endDate: string;
  baseIncome: number;
}) {
  const inRange = p.movements.filter((m) => m.date >= p.startDate && m.date <= p.endDate);
  const expenses = inRange.filter((m) => m.kind === "expense");
  const totalExpenses = expenses.reduce((s, m) => s + m.amount, 0);
  const totalIncome = p.baseIncome + inRange.filter((m) => m.kind === "income").reduce((s, m) => s + m.amount, 0);
  const map = new Map<string, CategorySpend>();
  for (const m of expenses) {
    let c = map.get(m.categoryId);
    if (!c) {
      const cat = p.categories.find((x) => x.id === m.categoryId);
      c = { categoryId: m.categoryId, name: cat?.name ?? "Otros", color: cat?.color ?? "#71717A", amount: 0, pct: 0, movements: [] };
      map.set(m.categoryId, c);
    }
    c.amount += m.amount;
    c.movements.push(m);
  }
  const byCategory = [...map.values()]
    .map((c) => ({ ...c, pct: totalExpenses ? Math.round((c.amount / totalExpenses) * 100) : 0, movements: c.movements.sort((a, b) => b.date.localeCompare(a.date)) }))
    .sort((a, b) => b.amount - a.amount);
  return { totalExpenses, totalIncome, byCategory };
}

/** Diferencia con el período anterior; pct null si antes no se gastó nada. */
export function compareSpending(current: number, previous: number): { diff: number; pct: number | null } {
  return { diff: current - previous, pct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null };
}
