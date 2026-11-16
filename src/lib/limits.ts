import { formatCurrency } from "./format";

/** Avance contra el tope de la categoría (null si no tiene tope). Cerca = desde el 80% hasta el tope. */
export function limitStatus(spent: number, limit: number | undefined): { level: "ok" | "near" | "over"; pct: number } | null {
  if (!limit || limit <= 0) return null;
  const pct = Math.min(100, Math.round((spent / limit) * 100));
  return { level: spent > limit ? "over" : spent >= limit * 0.8 ? "near" : "ok", pct };
}

/** Aviso al anotar un gasto: si cruza el 80% o si queda pasado del tope (se guarda igual). */
export function limitWarning(before: number, after: number, limit: number | undefined, name: string): string | null {
  if (!limit || limit <= 0) return null;
  if (after > limit) return `Te pasaste del tope de ${name} (${formatCurrency(limit)})`;
  if (before < limit * 0.8 && after >= limit * 0.8) return `Llegaste al 80% del tope de ${name}`;
  return null;
}
