import { describe, it, expect } from "vitest";
import { pendingCommitments, savingsAmount, spendingPlan } from "./spending";
import { Installment, Recurring } from "../types";

const rec = (id: string, dueDay: number, amount: number, extra: Partial<Recurring> = {}): Recurring => ({
  id, name: id, amount, categoryId: "x", dueDay, autoAdd: true, active: true, ...extra,
});
const inst: Installment = {
  id: "tele", name: "Tele", totalAmount: 100000, installmentsCount: 3, installmentAmount: 33333,
  firstDueDate: "2026-10-20", paidCount: 1, categoryId: "x", autoAdd: true, active: true,
};

describe("spending.ts - Podés gastar por día", () => {
  it("Resta los fijos y cuotas que vencen después de hoy y hasta el fin del período (todavía no anotados)", () => {
    // hoy 12/11, período hasta 9/12
    const r = pendingCommitments({
      recurrings: [rec("luz", 15, 20000), rec("net", 5, 5000), rec("gym", 10, 9000, { active: false })],
      installments: [inst],
      todayStr: "2026-11-12",
      periodEnd: "2026-12-09",
    });
    // luz 15/11 sí · net 5/12 sí · gym no (inactivo) · cuota 2 el 20/11 sí (la 3 es 20/12, fuera)
    expect(r.items.map((i) => `${i.name} ${i.date}`)).toEqual(["luz 2026-11-15", "Tele 2026-11-20", "net 2026-12-05"]);
    expect(r.total).toBe(20000 + 5000 + 33333);
  });

  it("Lo que vence hoy o ya venció no se resta (ya se anotó solo); la última cuota usa su monto ajustado", () => {
    const r = pendingCommitments({
      recurrings: [rec("hoy", 12, 1000)],
      installments: [{ ...inst, paidCount: 2, firstDueDate: "2026-09-20" }],
      todayStr: "2026-11-12",
      periodEnd: "2026-12-09",
    });
    expect(r.items.map((i) => i.date)).toEqual(["2026-11-20"]);
    expect(r.total).toBe(33334);
  });

  it("Un fijo creado después de la fecha no cuenta ese mes; un período largo cuenta cada mes", () => {
    const r = pendingCommitments({
      recurrings: [rec("a", 20, 100, { createdAt: "2026-11-25" })],
      installments: [],
      todayStr: "2026-11-12",
      periodEnd: "2027-01-31",
    });
    expect(r.items.map((i) => i.date)).toEqual(["2026-12-20", "2027-01-20"]);
  });

  it("La cuenta: (Disponible − fijos por vencer − ahorro) ÷ días; nunca negativo", () => {
    expect(spendingPlan({ available: 700000, commitments: 70000, savings: 0, daysRemaining: 21 })).toEqual({
      available: 700000, commitments: 70000, savings: 0, spendable: 630000, perDay: 30000,
    });
    expect(spendingPlan({ available: 50000, commitments: 70000, savings: 0, daysRemaining: 5 }).perDay).toBe(0);
    expect(spendingPlan({ available: 100000, commitments: 0, savings: 0, daysRemaining: 0 }).perDay).toBe(100000);
  });

  it("Ahorro: porcentaje de la plata del período o monto fijo; 0 por defecto", () => {
    expect(savingsAmount({ savingsMode: "percent", savingsValue: 10 }, 700000)).toBe(70000);
    expect(savingsAmount({ savingsMode: "amount", savingsValue: 50000 }, 700000)).toBe(50000);
    expect(savingsAmount({}, 700000)).toBe(0);
    expect(spendingPlan({ available: 700000, commitments: 0, savings: 70000, daysRemaining: 21 }).perDay).toBe(30000);
  });
});
