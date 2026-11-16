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

import { applyPayment, debtPaid } from "./debts";
import { debtArs, debtBalance } from "./dollars";

describe("debts.ts - Pagos parciales", () => {
  const base: Debt = { id: "x", person: "Rocio", kind: "they_owe", amount: 100000, settled: false, createdAt: "2026-11-01T10:00:00Z" };

  it("Un pago parcial baja el saldo y guarda el historial; no se marca saldada", () => {
    const d = applyPayment(base, 30000, "2026-11-10", "p1");
    expect(debtPaid(d)).toBe(30000);
    expect(debtBalance(d)).toBe(70000);
    expect(d.settled).toBe(false);
    expect(d.payments).toEqual([{ id: "p1", amount: 30000, date: "2026-11-10" }]);
  });

  it("Cuando el saldo llega a 0 queda saldada", () => {
    const d = applyPayment(applyPayment(base, 30000, "2026-11-10", "p1"), 70000, "2026-11-12", "p2");
    expect(debtBalance(d)).toBe(0);
    expect(d.settled).toBe(true);
    expect(d.settledAt).toBeTruthy();
  });

  it("No se puede pagar más que el saldo ni un monto en cero", () => {
    expect(() => applyPayment(base, 100001, "2026-11-10", "p1")).toThrow(/saldo/);
    expect(() => applyPayment(base, 0, "2026-11-10", "p1")).toThrow();
  });

  it("En dólares el pago se anota en dólares y los totales usan el saldo", () => {
    const usd: Debt = { ...base, amount: 300, currency: "USD", rate: 1500 };
    const d = applyPayment(usd, 100, "2026-11-10", "p1");
    expect(debtBalance(d)).toBe(200);
    expect(debtArs(d)).toBe(300000);
    expect(groupDebtsByPerson([d])[0].net).toBe(300000);
  });
});
