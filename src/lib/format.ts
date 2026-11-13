import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MAX_AMOUNT } from "./constants";

/**
 * Formats an integer amount with dots for thousands (e.g. 20000 -> "20.000")
 */
export function formatNumberWithDots(val: number | string): string {
  const num = typeof val === "string" ? parseInt(val, 10) : Math.round(val);
  if (isNaN(num)) return "0";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Lo que se ve en lugar de un monto cuando el usuario tocó el ojo ("Ocultar montos"). */
export const HIDDEN_AMOUNT = "$ ••••••";
let amountsHidden = false;
/** App.tsx lo fija en cada render según el ojo; así todos los montos de la app se tapan a la vez. */
export function setAmountsHidden(hidden: boolean): void {
  amountsHidden = hidden;
}

/**
 * Monto en pesos: "$ 20.000". Si los montos están ocultos, "$ ••••••".
 */
export function formatCurrency(amount: number): string {
  return amountsHidden ? HIDDEN_AMOUNT : formatCurrencyVisible(amount);
}

/** Igual que formatCurrency pero siempre visible (la calculadora muestra lo que se escribe). */
export function formatCurrencyVisible(amount: number): string {
  if (isNaN(amount) || !isFinite(amount)) return "$ 0";
  const isNegative = amount < 0;
  const abs = Math.abs(Math.round(amount));
  const dotted = formatNumberWithDots(abs);
  return isNegative ? `-$ ${dotted}` : `$ ${dotted}`;
}

/**
 * Formats a live calculator expression inserting dots into continuous number segments:
 * e.g. "20000 + 5000 * 100" -> "20.000 + 5.000 * 100"
 */
export function formatExpressionWithDots(rawExpr: string): string {
  if (!rawExpr) return "0";

  // Replace each sequence of digits with dotted version
  return rawExpr.replace(/\d+/g, (match) => {
    return match.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  });
}

/**
 * Strips dots from a dotted expression or string back to raw digits
 */
export function stripThousandsDots(dottedExpr: string): string {
  return dottedExpr.replace(/\./g, "");
}

/**
 * Parses YYYY-MM-DD or ISO string into a local Date object without UTC drift
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("T")[0].split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Formats a Date object to YYYY-MM-DD
 */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Formats relative due text in Argentine Spanish
 */
export function formatRelativeDue(daysUntil: number): string {
  if (daysUntil < 0) {
    const abs = Math.abs(daysUntil);
    return abs === 1 ? "Venció ayer" : `Venció hace ${abs} días`;
  }
  if (daysUntil === 0) {
    return "Vence hoy";
  }
  if (daysUntil === 1) {
    return "Vence mañana";
  }
  return `en ${daysUntil} días`;
}

/**
 * Returns short day name and day number: e.g. "Lun 10", "Mar 9", "Mié 8"
 */
export function formatDayShortWithNum(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  const dayName = format(date, "EEE", { locale: es });
  // Capitalize first letter: lun. -> Lun
  const cap = dayName.charAt(0).toUpperCase() + dayName.slice(1).replace(".", "");
  return `${cap} ${date.getDate()}`;
}

/**
 * Returns single letter initial for day of week: L, M, X, J, V, S, D
 */
export function getDayInitial(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  const day = date.getDay(); // 0 is Sunday, 1 is Monday ...
  const map = ["D", "L", "M", "X", "J", "V", "S"];
  return map[day];
}

/**
 * Formats human date e.g. "Lunes 10 de noviembre"
 */
export function formatLongDate(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  const s = format(date, "EEEE d 'de' MMMM", { locale: es });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Formats short date e.g. "10 nov"
 */
export function formatShortDate(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return format(date, "d MMM", { locale: es });
}

/**
 * Normaliza lo que el usuario escribe en un campo de monto: solo dígitos, con puntos de miles,
 * y nunca por encima de MAX_AMOUNT. Devuelve "" si no hay dígitos.
 */
export function formatAmountInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  const n = Math.min(parseInt(digits, 10), MAX_AMOUNT);
  return formatNumberWithDots(n);
}
