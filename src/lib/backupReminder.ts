import { differenceInCalendarDays } from "date-fns";

/** Pasados estos días sin exportar, Ajustes recuerda hacer una copia (en iPhone reinstalar borra todo). */
export const BACKUP_REMINDER_DAYS = 7;

/**
 * Texto "Último backup: hace X días" y si corresponde recordarlo.
 * Si nunca se exportó, cuenta desde que se empezó a usar la app (para no molestar el primer día).
 */
export function backupStatus(
  lastBackupAt: string | undefined,
  appCreatedAt: string,
  now: Date = new Date()
): { label: string; overdue: boolean } {
  const since = (iso: string) => differenceInCalendarDays(now, new Date(iso));
  if (!lastBackupAt) {
    return { label: "Todavía no hiciste ningún backup", overdue: since(appCreatedAt) > BACKUP_REMINDER_DAYS };
  }
  const days = since(lastBackupAt);
  const label = days <= 0 ? "Último backup: hoy" : days === 1 ? "Último backup: ayer" : `Último backup: hace ${days} días`;
  return { label, overdue: days > BACKUP_REMINDER_DAYS };
}
