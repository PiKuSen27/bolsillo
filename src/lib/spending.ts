import { addMonths } from "date-fns";
import { Installment, Recurring } from "../types";
import { clampDateToMonth } from "./period";
import { getInstallmentAmount } from "./recurring";
import { formatLocalDate, parseLocalDate } from "./format";

export interface Commitment {
  name: string;
  amount: number;
  date: string;
}

/**
 * Fijos y cuotas que todavía van a vencer en el período (después de hoy y hasta el último día).
 * Lo que vence hoy o antes ya lo anotó la app sola, así que no se cuenta dos veces.
 */
export function pendingCommitments(p: {
  recurrings: Recurring[];
  installments: Installment[];
  todayStr: string;
  periodEnd: string;
}): { total: number; items: Commitment[] } {
  const { todayStr, periodEnd } = p;
  const inWindow = (d: string) => d > todayStr && d <= periodEnd;
  const items: Commitment[] = [];

  for (const r of p.recurrings) {
    if (!r.active) continue;
    let cur = parseLocalDate(todayStr);
    cur = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const end = parseLocalDate(periodEnd);
    while (cur.getTime() <= end.getTime()) {
      const d = formatLocalDate(clampDateToMonth(cur.getFullYear(), cur.getMonth(), r.dueDay));
      if (inWindow(d) && !(r.createdAt && d < r.createdAt)) items.push({ name: r.name, amount: r.amount, date: d });
      cur = addMonths(cur, 1);
    }
  }

  for (const i of p.installments) {
    if (!i.active) continue;
    for (let n = i.paidCount + 1; n <= i.installmentsCount; n++) {
      const d = formatLocalDate(addMonths(parseLocalDate(i.firstDueDate), n - 1));
      if (d > periodEnd) break;
      if (inWindow(d)) items.push({ name: i.name, amount: getInstallmentAmount(i, n), date: d });
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  return { total: items.reduce((s, x) => s + x.amount, 0), items };
}

/** "Podés gastar por día" = (Disponible − fijos por vencer − ahorro) ÷ días que faltan. */
export function spendingPlan(p: { available: number; commitments: number; savings: number; daysRemaining: number }) {
  const spendable = p.available - p.commitments - p.savings;
  return {
    available: p.available,
    commitments: p.commitments,
    savings: p.savings,
    spendable,
    perDay: spendable > 0 ? Math.floor(spendable / Math.max(1, p.daysRemaining)) : 0,
  };
}
