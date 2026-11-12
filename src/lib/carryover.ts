import { addDays } from "date-fns";
import { Movement, Settings, WorkDay } from "../types";
import { calculatePeriod } from "./period";
import { calculateVariableIncome } from "./workdays";
import { formatLocalDate, parseLocalDate } from "./format";

export type DateRange = { startDate: string; endDate: string };

/**
 * Al cambiar el rango variable en Ajustes, el viejo pasa a ser "período anterior" SOLO si
 * terminó antes de que empiece el nuevo. Si solo se editaron las fechas del rango actual
 * (se solapan), no hay período anterior nuevo (Bug E).
 */
export function shouldStorePreviousRange(oldRange: DateRange | undefined, newStart: string): boolean {
  return !!oldRange && oldRange.endDate < newStart;
}

/**
 * Saldo con el que cerró el período anterior (solo informativo, NO toca el Disponible actual).
 * Devuelve null si no hay período anterior, si todavía no terminó de verdad, o si no se anotó nada en él.
 */
export function calculatePreviousPeriodBalance(params: {
  settings: Settings;
  movements: Movement[];
  workDays: WorkDay[];
  currentPeriodStart: string;
  todayStr: string;
}): number | null {
  const { settings, movements, workDays, currentPeriodStart, todayStr } = params;

  let start: string;
  let end: string;
  let baseIncome: number;

  if (settings.incomeMode === "daily") {
    const prev = settings.dailyPreviousRange;
    if (!prev) return null;
    // Solo cuenta un período que terminó de verdad: antes del actual y antes de hoy (Bug E)
    if (prev.endDate >= currentPeriodStart || prev.endDate >= todayStr) return null;
    start = prev.startDate;
    end = prev.endDate;
    baseIncome = calculateVariableIncome(
      { ...settings, dailyRangeStart: start, dailyRangeEnd: end },
      workDays
    );
  } else {
    const dayBefore = formatLocalDate(addDays(parseLocalDate(currentPeriodStart), -1));
    const prevPeriod = calculatePeriod(dayBefore, settings.payday || 1);
    start = prevPeriod.startDate;
    end = prevPeriod.endDate;
    baseIncome = settings.fixedSalary || 0;
  }

  // La app se empezó a usar después de que terminó ese período → no hay datos reales
  const appStart = settings.createdAt?.split("T")[0];
  if (appStart && appStart > end) return null;

  const prevMovements = movements.filter((m) => m.date >= start && m.date <= end);
  if (prevMovements.length === 0) return null;

  let income = baseIncome;
  let expenses = 0;
  for (const m of prevMovements) {
    if (m.kind === "income") income += m.amount;
    else if (m.kind === "expense") expenses += m.amount;
  }
  return Math.round(income - expenses);
}
