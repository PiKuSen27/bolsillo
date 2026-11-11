import { addDays } from "date-fns";
import { IncomeMode, Movement, WorkDay } from "../types";
import { formatLocalDate, parseLocalDate } from "./format";

export interface BalanceSummary {
  incomeMode: IncomeMode;
  fixedSalary: number;
  dailyRate: number;
  daysInPeriod: number;
  baseIncome: number;
  workDaysTotal: number;
  manualIncome: number;
  totalIncome: number;
  totalExpenses: number;
  available: number; // can be negative
  dailySuggested: number; // available / daysRemaining (min 1, 0 if negative)
  spentPercentage: number; // 0..100 clamped
  workedDaysCount: number;
  avgDailyRate: number;
  todayMovementNet: number;
  todayExpense: number;
  todayIncome: number;
}

export function calculateBalance(params: {
  incomeMode?: IncomeMode;
  fixedSalary: number;
  dailyRate?: number;
  daysInPeriod?: number;
  periodStart: string;
  periodEnd: string;
  movements: Movement[];
  workDays: WorkDay[];
  daysRemaining: number;
  todayDateStr?: string;
}): BalanceSummary {
  const {
    incomeMode = "salary",
    fixedSalary,
    dailyRate = 0,
    daysInPeriod = 1,
    periodStart,
    periodEnd,
    movements,
    workDays,
    daysRemaining,
    todayDateStr,
  } = params;

  // Active tracking window:
  // Include movements from the period itself, plus movements from the visible day strip (last 14 days) or start of month
  const todayParsed = todayDateStr ? parseLocalDate(todayDateStr) : new Date();
  const fourteenDaysAgo = formatLocalDate(addDays(todayParsed, -14));
  const startOfMonth = todayDateStr ? `${todayDateStr.slice(0, 7)}-01` : periodStart;

  const earliestDate = [periodStart, fourteenDaysAgo, startOfMonth].reduce(
    (min, d) => (d < min ? d : min),
    periodStart
  );

  // Filter movements belonging to this active tracking window
  const periodMovements = movements.filter(
    (m) => m.date >= earliestDate && m.date <= periodEnd
  );

  // Work days in this period that were worked
  const periodWorkDays = workDays.filter(
    (w) => w.worked && w.date >= earliestDate && w.date <= periodEnd
  );

  const workDaysTotal = periodWorkDays.reduce((acc, w) => acc + (w.amount || 0), 0);
  const workedDaysCount = periodWorkDays.length;
  const avgDailyRate =
    workedDaysCount > 0 ? Math.round(workDaysTotal / workedDaysCount) : 0;

  let manualIncome = 0;
  let totalExpenses = 0;

  for (const m of periodMovements) {
    if (m.kind === "income") {
      // All movements with kind === "income" are summed into income
      manualIncome += m.amount;
    } else if (m.kind === "expense") {
      totalExpenses += m.amount;
    }
  }

  // EXCLUYENTE: o Sueldo Fijo o Sueldo Variable por días, nunca ambos a la vez
  // En modo variable: si hay dailyRate y daysInPeriod, baseIncome = días del rango * dailyRate
  let baseIncome = 0;
  if (incomeMode === "daily") {
    if (dailyRate > 0 && daysInPeriod > 0) {
      baseIncome = Math.round(dailyRate * daysInPeriod);
    } else {
      baseIncome = workDaysTotal;
    }
  } else {
    baseIncome = fixedSalary;
  }

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
    // If today is a worked WorkDay in daily mode, count into today's income if not using range base
    if (incomeMode === "daily" && (!dailyRate || dailyRate <= 0)) {
      const todayWork = workDays.find((w) => w.date === todayDateStr && w.worked);
      if (todayWork) {
        todayIncome += todayWork.amount;
      }
    }
  }

  const todayMovementNet = todayIncome - todayExpense;

  return {
    incomeMode,
    fixedSalary,
    dailyRate,
    daysInPeriod,
    baseIncome,
    workDaysTotal,
    manualIncome,
    totalIncome,
    totalExpenses,
    available,
    dailySuggested,
    spentPercentage,
    workedDaysCount,
    avgDailyRate,
    todayMovementNet,
    todayExpense,
    todayIncome,
  };
}
