import { describe, it, expect } from "vitest";
import { periodAtOffset, summarizePeriod, compareSpending } from "./summary";
import { DEFAULT_SETTINGS } from "./constants";
import { Movement, Settings } from "../types";

const mv = (id: string, date: string, amount: number, categoryId = "comida", kind: Movement["kind"] = "expense"): Movement => ({
  id, date, amount, kind, categoryId, source: "manual", createdAt: date,
});
const cats = [
  { id: "comida", name: "Comida", icon: "", color: "#f97316" },
  { id: "transporte", name: "Transporte", icon: "", color: "#3b82f6" },
];

describe("summary.ts - Resumen del mes", () => {
  it("Sueldo fijo: período actual y los anteriores van de cobro a cobro", () => {
    const s: Settings = { ...DEFAULT_SETTINGS, incomeMode: "salary", payday: 10 };
    expect(periodAtOffset(s, "2026-11-16", 0)).toEqual({ startDate: "2026-11-10", endDate: "2026-12-09" });
    expect(periodAtOffset(s, "2026-11-16", 1)).toEqual({ startDate: "2026-10-10", endDate: "2026-11-09" });
    expect(periodAtOffset(s, "2026-11-16", 2)).toEqual({ startDate: "2026-09-10", endDate: "2026-10-09" });
  });

  it("Sueldo por día: el anterior es el rango guardado; más atrás, tramos del mismo largo", () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS, incomeMode: "daily", dailyRangeStart: "2026-11-11", dailyRangeEnd: "2026-11-20",
      dailyPreviousRange: { startDate: "2026-10-25", endDate: "2026-11-05" },
    };
    expect(periodAtOffset(s, "2026-11-16", 0)).toEqual({ startDate: "2026-11-11", endDate: "2026-11-20" });
    expect(periodAtOffset(s, "2026-11-16", 1)).toEqual({ startDate: "2026-10-25", endDate: "2026-11-05" });
    expect(periodAtOffset(s, "2026-11-16", 2)).toEqual({ startDate: "2026-10-13", endDate: "2026-10-24" });
  });

  it("Gastos por categoría con monto, porcentaje y movimientos; ingresos con el sueldo del período", () => {
    const r = summarizePeriod({
      movements: [mv("a", "2026-11-12", 30000), mv("b", "2026-11-13", 10000, "transporte"), mv("c", "2026-11-14", 10000),
        mv("d", "2026-11-14", 5000, "income", "income"), mv("fuera", "2026-12-20", 99999)],
      categories: cats, startDate: "2026-11-10", endDate: "2026-12-09", baseIncome: 700000,
    });
    expect(r.totalExpenses).toBe(50000);
    expect(r.totalIncome).toBe(705000);
    expect(r.byCategory.map((c) => [c.name, c.amount, c.pct, c.movements.length])).toEqual([
      ["Comida", 40000, 80, 2],
      ["Transporte", 10000, 20, 1],
    ]);
  });

  it("Comparación con el período anterior", () => {
    expect(compareSpending(120, 100)).toEqual({ diff: 20, pct: 20 });
    expect(compareSpending(80, 100)).toEqual({ diff: -20, pct: -20 });
    expect(compareSpending(50, 0)).toEqual({ diff: 50, pct: null });
  });
});
