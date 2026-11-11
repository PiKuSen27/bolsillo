import { IncomeMode, Movement } from "../types";
import { formatLocalDate } from "./format";

export interface BalanceSummary {
  incomeMode: IncomeMode;
  fixedSalary: number;
  baseIncome: number; // sueldo fijo, o suma de los días del rango en modo variable
  manualIncome: number;
  totalIncome: number;
  totalExpenses: number;
  available: number; // can be negative
  dailySuggested: number; // available / daysRemaining (min 1, 0 if negative)
  spentPercentage: number; // 0..100 clamped
  todayMovementNet: number;
  todayExpense: number;
  todayIncome: number;
}

export function calculateBalance(params: {
  incomeMode?: IncomeMode;
  fixedSalary: number;
  variableIncome?: number; // modo variable: suma de los días del rango (workdays.ts)
  periodStart: string;
  periodEnd: string;
  movements: Movement[];
  daysRemaining: number;
  todayDateStr?: string;
}): BalanceSummary {
  const {
    incomeMode = "salary",
    fixedSalary,
    variableIncome = 0,
    periodStart,
    periodEnd,
    movements,
    daysRemaining,
    todayDateStr,
  } = params;

  // Only movements inside the current period count (never the previous one).
  // If the period already ended (expired variable range), it stretches to today so new movements still count.
  const todayStr = todayDateStr ?? formatLocalDate(new Date());
  const windowEnd = todayStr > periodEnd ? todayStr : periodEnd;

  const periodMovements = movements.filter(
    (m) => m.date >= periodStart && m.date <= windowEnd
  );

  let manualIncome = 0;
  let totalExpenses = 0;

  for (const m of periodMovements) {
    if (m.kind === "income") {
      manualIncome += m.amount;
    } else if (m.kind === "expense") {
      totalExpenses += m.amount;
    }
  }

  // EXCLUYENTE: o Sueldo Fijo o Sueldo Variable por días, nunca ambos a la vez
  const baseIncome = incomeMode === "daily" ? Math.round(variableIncome) : fixedSalary;

  const totalIncome = Math.round(baseIncome + manualIncome);
  const available = totalIncome - totalExpenses;

  const validDaysRemaining = Math.max(1, daysRemaining);
  const dailySuggested =
    available > 0 ? Math.floor(available / validDaysRemaining) : 0;

  const spentPercentage =
    totalIncome > 0
      ? Math.min(100, Math.max(0, Math.round((totalExpenses / totalIncome) * 100)))
      : totalExpenses > 0
      ? 100
      : 0;

  // Today movements
  let todayExpense = 0;
  let todayIncome = 0;
  if (todayDateStr) {
    for (const m of movements) {
      if (m.date === todayDateStr) {
        if (m.kind === "expense") todayExpense += m.amount;
        else if (m.kind === "income") todayIncome += m.amount;
      }
    }
  }

  return {
    incomeMode,
    fixedSalary,
    baseIncome,
    manualIncome,
    totalIncome,
    totalExpenses,
    available,
    dailySuggested,
    spentPercentage,
    todayMovementNet: todayIncome - todayExpense,
    todayExpense,
    todayIncome,
  };
}
