import { Debt } from "../types";
import { normalizeText } from "./search";

/** Clave para juntar deudas de la misma persona: sin mayúsculas, acentos ni espacios de más. */
export function personKey(name: string): string {
  return normalizeText(name).replace(/\s+/g, " ");
}

export interface PersonGroup {
  key: string;
  name: string; // como se escribió en la deuda más reciente
  debts: Debt[];
  count: number;
  theyOwe: number; // me deben
  iOwe: number; // le debo
  net: number; // positivo: me debe; negativo: le debo
}

/** Agrupa deudas por persona, de mayor a menor monto neto (en valor absoluto). */
export function groupDebtsByPerson(debts: Debt[]): PersonGroup[] {
  const map = new Map<string, PersonGroup>();
  const latest = new Map<string, string>(); // fecha de la deuda más reciente de cada persona
  for (const debt of debts) {
    const key = personKey(debt.person);
    let g = map.get(key);
    if (!g) {
      g = { key, name: debt.person.trim(), debts: [], count: 0, theyOwe: 0, iOwe: 0, net: 0 };
      map.set(key, g);
    }
    if (debt.createdAt > (latest.get(key) ?? "")) {
      latest.set(key, debt.createdAt);
      g.name = debt.person.trim().replace(/\s+/g, " ");
    }
    g.debts.push(debt);
    g.count++;
    if (debt.kind === "they_owe") g.theyOwe += debt.amount;
    else g.iOwe += debt.amount;
    g.net = g.theyOwe - g.iOwe;
  }
  return [...map.values()].sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || a.name.localeCompare(b.name));
}

/** Nombres ya usados que empiezan con lo escrito (una variante por persona), para no crear "Rocio" y "Rocío". */
export function suggestPersonNames(debts: Debt[], typed: string): string[] {
  const q = personKey(typed);
  if (!q) return [];
  return groupDebtsByPerson(debts)
    .filter((g) => g.key.startsWith(q) && g.key !== q)
    .map((g) => g.name)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 5);
}
