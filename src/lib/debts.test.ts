import { describe, it, expect } from "vitest";
import { groupDebtsByPerson, personKey, suggestPersonNames } from "./debts";
import { Debt } from "../types";

const d = (id: string, person: string, amount: number, kind: Debt["kind"] = "they_owe", extra: Partial<Debt> = {}): Debt => ({
  id, person, amount, kind, settled: false, createdAt: `2026-11-0${id.length}T10:00:00Z`, ...extra,
});

describe("debts.ts - Agrupar deudas por persona", () => {
  it("personKey ignora mayúsculas, acentos y espacios de más", () => {
    expect(personKey("  Rocío   Pérez ")).toBe(personKey("rocio perez"));
    expect(personKey("ROCIO")).toBe("rocio");
  });

  it("Junta las deudas de la misma persona con cantidad y total", () => {
    const groups = groupDebtsByPerson([
      d("a", "Rocio", 100000), d("b", "rocío ", 50000), d("c", "Juan", 20000), d("dd", " ROCIO", 55000),
    ]);
    const rocio = groups.find((g) => g.key === "rocio")!;
    expect(rocio.debts.map((x) => x.id)).toEqual(["a", "b", "dd"]);
    expect(rocio.count).toBe(3);
    expect(rocio.net).toBe(205000); // me debe en total
    expect(groups.find((g) => g.key === "juan")!.count).toBe(1);
  });

  it("Si me debe y le debo, el total es el neto (positivo = me debe, negativo = le debo)", () => {
    const [g] = groupDebtsByPerson([d("a", "Rocio", 100000, "they_owe"), d("b", "Rocio", 30000, "i_owe")]);
    expect(g.theyOwe).toBe(100000);
    expect(g.iOwe).toBe(30000);
    expect(g.net).toBe(70000);
    const [g2] = groupDebtsByPerson([d("a", "Rocio", 10000, "they_owe"), d("b", "Rocio", 30000, "i_owe")]);
    expect(g2.net).toBe(-20000);
  });

  it("Muestra el nombre tal como se escribió en la deuda más reciente y ordena por monto", () => {
    const groups = groupDebtsByPerson([
      d("a", "rocio", 1000, "they_owe", { createdAt: "2026-11-01T10:00:00Z" }),
      d("b", "Rocío", 1000, "they_owe", { createdAt: "2026-11-05T10:00:00Z" }),
      d("c", "Juan", 90000),
    ]);
    expect(groups.map((g) => g.name)).toEqual(["Juan", "Rocío"]);
  });

  it("Sugiere nombres ya usados (sin repetir variantes) que coincidan con lo que se escribe", () => {
    const debts = [d("a", "Rocío", 1, "they_owe", { createdAt: "2026-11-05T10:00:00Z" }), d("b", "rocio", 1, "they_owe", { createdAt: "2026-11-01T10:00:00Z" }), d("c", "Roberto", 1), d("dd", "Juan", 1)];
    expect(suggestPersonNames(debts, "ro")).toEqual(["Roberto", "Rocío"]);
    expect(suggestPersonNames(debts, "roci")).toEqual(["Rocío"]);
    expect(suggestPersonNames(debts, "")).toEqual([]);
    expect(suggestPersonNames(debts, "rocío")).toEqual([]); // ya está escrito completo
  });
});
