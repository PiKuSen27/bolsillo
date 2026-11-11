import { describe, it, expect } from "vitest";
import { filterMovements, normalizeText } from "./search";
import { Category, Movement } from "../types";

const cats: Category[] = [
  { id: "comida", name: "Comida", icon: "x", color: "#000" },
  { id: "super", name: "Súper", icon: "x", color: "#000" },
];
const mv = (id: string, date: string, amount: number, categoryId: string, note?: string, kind: "expense" | "income" = "expense"): Movement => ({
  id, date, amount, kind, categoryId, note, source: "manual", createdAt: `${date}T10:00:00Z`,
});
const movements = [
  mv("a", "2026-11-12", 20000, "comida", "Almuerzo con Juan"),
  mv("b", "2026-11-03", 150000, "super", "Compra del mes"),
  mv("c", "2026-10-20", 20000, "comida", "Pizza"),
  mv("d", "2026-09-01", 500000, "income", "Sueldo", "income"),
];
const period = { periodStart: "2026-11-01", periodEnd: "2026-11-30" };

describe("search.ts - Buscador y filtro por período del panel de movimientos", () => {
  it("Sin búsqueda, muestra solo los movimientos del período actual", () => {
    const r = filterMovements({ movements, categories: cats, query: "", ...period });
    expect(r.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("Con búsqueda, busca en todo el historial por nota (sin importar mayúsculas ni acentos)", () => {
    expect(filterMovements({ movements, categories: cats, query: "PIZZA", ...period }).map((m) => m.id)).toEqual(["c"]);
    expect(filterMovements({ movements, categories: cats, query: "juan", ...period }).map((m) => m.id)).toEqual(["a"]);
  });

  it("Busca por nombre de categoría (con o sin acento)", () => {
    expect(filterMovements({ movements, categories: cats, query: "super", ...period }).map((m) => m.id)).toEqual(["b"]);
    expect(filterMovements({ movements, categories: cats, query: "Súper", ...period }).map((m) => m.id)).toEqual(["b"]);
    expect(filterMovements({ movements, categories: cats, query: "ingreso", ...period }).map((m) => m.id)).toEqual(["d"]);
  });

  it("Busca por monto, con o sin puntos de miles", () => {
    expect(filterMovements({ movements, categories: cats, query: "20000", ...period }).map((m) => m.id)).toEqual(["a", "c"]);
    expect(filterMovements({ movements, categories: cats, query: "20.000", ...period }).map((m) => m.id)).toEqual(["a", "c"]);
    expect(filterMovements({ movements, categories: cats, query: "150", ...period }).map((m) => m.id)).toEqual(["b"]);
  });

  it("Los resultados vienen ordenados por fecha, del más nuevo al más viejo", () => {
    const r = filterMovements({ movements: [...movements].reverse(), categories: cats, query: "o", ...period });
    const dates = r.map((m) => m.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("normalizeText saca acentos y mayúsculas", () => {
    expect(normalizeText("  Súper Café ")).toBe("super cafe");
  });
});
