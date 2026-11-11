import {
  addDays,
  differenceInCalendarDays,
  getDaysInMonth,
} from "date-fns";
import { formatLocalDate, parseLocalDate } from "./format";
import { PeriodInfo } from "../types";

/**
 * Returns a valid date clamped to the max days of the month.
 * e.g. Feb 31 -> Feb 28 or Feb 29
 */
export function clampDateToMonth(year: number, monthZeroIndexed: number, desiredDay: number): Date {
  const testDate = new Date(year, monthZeroIndexed, 1);
  const maxDays = getDaysInMonth(testDate);
  const actualDay = Math.min(Math.max(desiredDay, 1), maxDays);
  return new Date(year, monthZeroIndexed, actualDay);
}

/**
 * Calculates the active period given a reference date (defaults to today) and a payday (1..31).
 * Period runs from payday until the day prior to the next payday.
 */
export function calculatePeriod(refDateInput: string | Date = new Date(), payday: number = 1): PeriodInfo {
  const refDate =
    typeof refDateInput === "string"
      ? parseLocalDate(refDateInput)
      : new Date(refDateInput.getFullYear(), refDateInput.getMonth(), refDateInput.getDate());

  const year = refDate.getFullYear();
  const month = refDate.getMonth(); // 0-indexed

  // Clamped payday for the current month
  const currentMonthPayday = clampDateToMonth(year, month, payday);

  let periodStart: Date;
  let nextPayday: Date;

  if (refDate.getTime() >= currentMonthPayday.getTime()) {
    // Current period started this month
    periodStart = currentMonthPayday;
    // Next payday is in month + 1
    const nextMonthIndex = month + 1;
    const nextMonthYear = year + Math.floor(nextMonthIndex / 12);
    const normalizedNextMonth = (nextMonthIndex % 12 + 12) % 12;
    nextPayday = clampDateToMonth(nextMonthYear, normalizedNextMonth, payday);
  } else {
    // Current period started in month - 1
    const prevMonthIndex = month - 1;
    const prevMonthYear = year + Math.floor(prevMonthIndex / 12);
    const normalizedPrevMonth = (prevMonthIndex % 12 + 12) % 12;
    periodStart = clampDateToMonth(prevMonthYear, normalizedPrevMonth, payday);
    nextPayday = currentMonthPayday;
  }

  // Period end is the day before the next payday
  const periodEnd = addDays(nextPayday, -1);

  const daysInPeriod = differenceInCalendarDays(periodEnd, periodStart) + 1;
  const rawRemaining = differenceInCalendarDays(periodEnd, refDate) + 1;
  const daysRemaining = Math.max(1, rawRemaining);

  const isTodayInPeriod =
    refDate.getTime() >= periodStart.getTime() && refDate.getTime() <= periodEnd.getTime();

  return {
    startDate: formatLocalDate(periodStart),
    endDate: formatLocalDate(periodEnd),
    daysInPeriod,
    daysRemaining,
    isTodayInPeriod,
  };
}

/**
 * Calculates a variable salary period defined by a custom date range.
 * Automatically validates and auto-swaps if end date is prior to start date.
 */
export function calculateVariablePeriod(
  startStr: string,
  endStr: string,
  refDateInput: string | Date = new Date()
): PeriodInfo {
  let sDate = parseLocalDate(startStr);
  let eDate = parseLocalDate(endStr);

  // Auto-swap if start > end so it never yields negative days
  if (sDate.getTime() > eDate.getTime()) {
    const temp = sDate;
    sDate = eDate;
    eDate = temp;
    const tempStr = startStr;
    startStr = endStr;
    endStr = tempStr;
  }

  const refDate =
    typeof refDateInput === "string"
      ? parseLocalDate(refDateInput)
      : new Date(refDateInput.getFullYear(), refDateInput.getMonth(), refDateInput.getDate());

  const daysInPeriod = Math.max(1, differenceInCalendarDays(eDate, sDate) + 1);
  const rawRemaining = differenceInCalendarDays(eDate, refDate) + 1;
  const daysRemaining = Math.max(1, rawRemaining);

  const isTodayInPeriod =
    refDate.getTime() >= sDate.getTime() && refDate.getTime() <= eDate.getTime();

  return {
    startDate: startStr,
    endDate: endStr,
    daysInPeriod,
    daysRemaining,
    isTodayInPeriod,
  };
}
