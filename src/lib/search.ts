import { Category, Movement } from "../types";

/** Minúsculas, sin acentos, sin espacios sobrantes. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Sin búsqueda: solo los movimientos del período. Con búsqueda: todo el historial,
 * filtrando por nota, nombre de categoría o monto (con o sin puntos). Siempre del más nuevo al más viejo.
 */
export function filterMovements(params: {
  movements: Movement[];
  categories: Category[];
  query: string;
  periodStart: string;
  periodEnd: string;
}): Movement[] {
  const { movements, categories, periodStart, periodEnd } = params;
  const q = normalizeText(params.query);
  const qDigits = q.replace(/\D/g, "");

  const byDate = (a: Movement, b: Movement) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

  if (!q) {
    return movements.filter((m) => m.date >= periodStart && m.date <= periodEnd).sort(byDate);
  }

  const catName = (m: Movement) =>
    m.kind === "income" ? "ingreso de plata" : normalizeText(categories.find((c) => c.id === m.categoryId)?.name ?? "");

  return movements
    .filter((m) => {
      if (m.note && normalizeText(m.note).includes(q)) return true;
      if (catName(m).includes(q)) return true;
      // Solo dígitos y puntos → búsqueda por monto ("20000" o "20.000")
      if (qDigits && /^[\d.]+$/.test(q)) return String(m.amount).includes(qDigits);
      return false;
    })
    .sort(byDate);
}
