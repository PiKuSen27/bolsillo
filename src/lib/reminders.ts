import { addDays } from "date-fns";
import { DayLog, Movement, UpcomingItem } from "../types";
import { formatCurrency, formatLongDate, formatLocalDate, parseLocalDate } from "./format";

/**
 * Checks if a date has been logged (either has a manual movement or has a dayLog marked logged/noExpenses)
 */
export function isDayLogged(
  dateStr: string,
  movements: Movement[],
  dayLogs: DayLog[]
): boolean {
  // Check dayLogs
  const log = dayLogs.find((d) => d.date === dateStr);
  if (log && (log.logged || log.noExpenses)) {
    return true;
  }
  // Check manual movements for that date
  const hasManual = movements.some(
    (m) => m.date === dateStr && m.source === "manual"
  );
  return hasManual;
}

/**
 * Returns array of dates (YYYY-MM-DD) between startDateStr and yesterday (inclusive) that are unlogged.
 */
export function getMissingDays(params: {
  appStartDateStr: string;
  todayStr: string;
  movements: Movement[];
  dayLogs: DayLog[];
}): string[] {
  const { appStartDateStr, todayStr, movements, dayLogs } = params;

  const start = parseLocalDate(appStartDateStr);
  const today = parseLocalDate(todayStr);

  const yesterday = addDays(today, -1);
  if (yesterday.getTime() < start.getTime()) {
    return [];
  }

  const missing: string[] = [];
  let cur = start;

  while (cur.getTime() <= yesterday.getTime()) {
    const curStr = formatLocalDate(cur);
    if (!isDayLogged(curStr, movements, dayLogs)) {
      missing.push(curStr);
    }
    cur = addDays(cur, 1);
  }

  return missing;
}

/**
 * Formats missing days list into natural Argentine Spanish text:
 * e.g. "Te falta anotar: lunes 3 y martes 4"
 */
export function formatMissingDaysBanner(missingDates: string[]): string {
  if (missingDates.length === 0) return "";
  if (missingDates.length === 1) {
    return `Te falta anotar: ${formatLongDate(missingDates[0])}`;
  }
  if (missingDates.length === 2) {
    return `Te falta anotar: ${formatLongDate(missingDates[0])} y ${formatLongDate(missingDates[1])}`;
  }
  return `Te faltan anotar ${missingDates.length} días (desde el ${formatLongDate(missingDates[0])})`;
}

/**
 * Checks if daily reminder should fire right now
 */
export function shouldTriggerDailyReminder(params: {
  currentHHMM: string; // e.g. "21:00"
  reminderTime: string; // e.g. "21:00"
  reminderEnabled: boolean;
  isTodayLogged: boolean;
  alreadySentToday: boolean;
}): boolean {
  const {
    currentHHMM,
    reminderTime,
    reminderEnabled,
    isTodayLogged,
    alreadySentToday,
  } = params;

  if (!reminderEnabled) return false;
  if (alreadySentToday) return false;
  if (isTodayLogged) return false;

  // Trigger if current time matches reminderTime
  return currentHHMM === reminderTime;
}

export interface DueNotification {
  key: string;
  title: string;
  body: string;
}

/**
 * Identifies upcoming items that should trigger an alert (N days before or on due day)
 */
export function getDueAlertsToNotify(params: {
  upcomingItems: UpcomingItem[];
  dueAlertDays: number;
  alreadySentKeys: Set<string>;
}): DueNotification[] {
  const { upcomingItems, dueAlertDays, alreadySentKeys } = params;
  const notifications: DueNotification[] = [];

  for (const item of upcomingItems) {
    if (!item.active) continue;

    // We notify if item is due in exactly dueAlertDays, or due today (daysUntil === 0)
    if (item.daysUntil === dueAlertDays || item.daysUntil === 0) {
      const key = `due_alert_${item.id}_${item.dueDate}_${item.daysUntil}`;
      if (!alreadySentKeys.has(key)) {
        const title =
          item.daysUntil === 0
            ? `¡Vence hoy: ${item.name}!`
            : `Vencimiento próximo: ${item.name}`;

        const body =
          item.daysUntil === 0
            ? `${item.name} vence hoy — ${formatCurrency(item.amount)}`
            : `${item.name} vence en ${item.daysUntil} días — ${formatCurrency(item.amount)}`;

        notifications.push({ key, title, body });
      }
    }
  }

  return notifications;
}
