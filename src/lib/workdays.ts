import { addDays, differenceInCalendarDays } from "date-fns";
import { Settings, WorkDay } from "../types";
import { formatLocalDate, parseLocalDate } from "./format";

export interface RangeDay {
  date: string;
  value: number;
  rate: number; // tarifa que le corresponde a ese día
  free: boolean; // día libre (domingo por defecto, feriado, no trabajé)
  modified: boolean; // monto distinto de la tarifa → naranja
}

/** Tarifa vigente para una fecha: la base, o el último cambio cuya fecha ya pasó. */
export function getRateForDate(dateStr: string, settings: Settings): number {
  let rate = settings.dailyRate || 0;
  let bestFrom = "";
  for (const change of settings.dailyRateChanges ?? []) {
    if (change.fromDate <= dateStr && change.fromDate >= bestFrom) {
      bestFrom = change.fromDate;
      rate = change.rate;
    }
  }
  return rate;
}

/** Valor de un día sin tocar: tarifa de lunes a sábado, $0 el domingo. */
export function getDefaultDayValue(dateStr: string, settings: Settings): number {
  return parseLocalDate(dateStr).getDay() === 0 ? 0 : getRateForDate(dateStr, settings);
}

export function getDayValue(dateStr: string, settings: Settings, overrides: WorkDay[]): number {
  const o = overrides.find((w) => w.date === dateStr);
  if (!o) return getDefaultDayValue(dateStr, settings);
  return o.worked ? o.amount : 0;
}

/** Naranja solo si el monto quedó distinto de la tarifa de ese día. Un día libre nunca es naranja. */
export function isDayModified(
  dateStr: string,
  settings: Settings,
  override: WorkDay | undefined
): boolean {
  if (!override || !override.worked) return false;
  return override.amount !== getRateForDate(dateStr, settings);
}

export function listRangeDays(settings: Settings, overrides: WorkDay[]): RangeDay[] {
  if (!settings.dailyRangeStart || !settings.dailyRangeEnd) return [];
  let start = parseLocalDate(settings.dailyRangeStart);
  let end = parseLocalDate(settings.dailyRangeEnd);
  if (start.getTime() > end.getTime()) [start, end] = [end, start];

  const days: RangeDay[] = [];
  const count = differenceInCalendarDays(end, start) + 1;
  for (let i = 0; i < count; i++) {
    const date = formatLocalDate(addDays(start, i));
    const override = overrides.find((w) => w.date === date);
    const value = getDayValue(date, settings, overrides);
    days.push({
      date,
      value,
      rate: getRateForDate(date, settings),
      free: value === 0 && (override ? !override.worked : true),
      modified: isDayModified(date, settings, override),
    });
  }
  return days;
}

/** Ingreso base del rango: suma del valor de cada día (los libres suman 0). */
export function calculateVariableIncome(settings: Settings, overrides: WorkDay[]): number {
  return listRangeDays(settings, overrides).reduce((acc, d) => acc + d.value, 0);
}
