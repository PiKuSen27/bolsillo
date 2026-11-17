import { describe, it, expect } from "vitest";
import { calculatePeriod } from "./period";
import { calculateBalance } from "./balance";
import { calculatePreviousPeriodBalance } from "./carryover";
import { processAutoAddRules, getUpcomingItems } from "./recurring";
import { DEFAULT_SETTINGS } from "./constants";
import { Installment, Movement, Recurring, Settings } from "../types";

/**
 * Modo Sueldo fijo de punta a punta (hay gente que lo usa todos los días: no romperlo):
 * cobro el 10, sueldo 700.000, un gasto, cambio de período, cartel del período anterior,
 * un fijo y una compra en cuotas.
 */
const settings: Settings = {
  ...DEFAULT_SETTINGS,
  incomeMode: "salary",
  fixedSalary: 700000,
  payday: 10,
  onboardingDone: true,
  createdAt: "2026-10-01T10:00:00Z",
};

const mv = (id: string, date: string, amount: number, kind: "expense" | "income" = "expense"): Movement => ({
  id, date, amount, kind, categoryId: "comida", source: "manual", createdAt: `${date}T12:00:00Z`,
});

function available(todayStr: string, movements: Movement[]) {
  const p = calculatePeriod(todayStr, settings.payday);
  return {
    period: p,
    summary: calculateBalance({
      incomeMode: "salary",
      fixedSalary: settings.fixedSalary,
      periodStart: p.startDate,
      periodEnd: p.endDate,
      movements,
      daysRemaining: p.daysRemaining,
      todayDateStr: todayStr,
    }),
    previous: calculatePreviousPeriodBalance({
      settings, movements, workDays: [], currentPeriodStart: p.startDate, todayStr,
    }),
  };
}

describe("Sueldo fijo de punta a punta", () => {
  it("Después de la bienvenida: Disponible = sueldo entero y nada que mostrar del período anterior", () => {
    const r = available("2026-10-20", []);
    expect(r.period.startDate).toBe("2026-10-10");
    expect(r.period.endDate).toBe("2026-11-09");
    expect(r.summary.available).toBe(700000);
    expect(r.previous).toBeNull();
  });

  it("Un gasto baja el Disponible y el 'podés gastar por día' usa los días que faltan", () => {
    const r = available("2026-10-20", [mv("a", "2026-10-20", 100000)]);
    expect(r.summary.available).toBe(600000);
    expect(r.period.daysRemaining).toBe(21); // 20/10 → 9/11 inclusive
    expect(r.summary.dailySuggested).toBe(Math.floor(600000 / 21));
  });

  it("El último día del período sigue contando el gasto; el día de cobro arranca de cero con el cartel del anterior", () => {
    const movs = [mv("a", "2026-10-20", 100000)];
    const lastDay = available("2026-11-09", movs);
    expect(lastDay.summary.available).toBe(600000);
    expect(lastDay.period.daysRemaining).toBe(1);

    const payday = available("2026-11-10", movs);
    expect(payday.period.startDate).toBe("2026-11-10");
    expect(payday.period.endDate).toBe("2026-12-09");
    expect(payday.summary.available).toBe(700000); // el gasto viejo no se resta
    expect(payday.previous).toBe(600000); // "Empezaste con $ 600.000 a favor"
  });

  it("Si el período anterior cerró abajo, el cartel es negativo y el Disponible nuevo no lo descuenta", () => {
    const movs = [mv("a", "2026-10-20", 750000)];
    const r = available("2026-11-10", movs);
    expect(r.previous).toBe(-50000);
    expect(r.summary.available).toBe(700000);
  });

  it("Un fijo (Netflix, día 10) se cobra el día de cobro, baja el Disponible y no se repite", () => {
    const netflix: Recurring = {
      id: "netflix", name: "Netflix", amount: 5000, categoryId: "suscripciones",
      dueDay: 10, autoAdd: true, active: true, createdAt: "2026-10-01",
    };
    const movs: Movement[] = [];
    const first = processAutoAddRules({ recurrings: [netflix], installments: [], existingMovements: movs, todayStr: "2026-11-10" });
    expect(first.movementsToAdd.map((m) => m.date)).toEqual(["2026-10-10", "2026-11-10"]); // octubre quedó pendiente
    movs.push(...first.movementsToAdd);

    const r = available("2026-11-10", movs);
    expect(r.summary.available).toBe(695000); // solo el de noviembre cae en este período
    expect(r.previous).toBe(695000); // el de octubre figura en el cartel

    const again = processAutoAddRules({ recurrings: first.updatedRecurrings, installments: [], existingMovements: movs, todayStr: "2026-11-11" });
    expect(again.movementsToAdd).toEqual([]);
  });

  it("Una compra en 3 cuotas: se cobra una por mes, la última absorbe el redondeo y después deja de aparecer en Próximos", () => {
    const tele: Installment = {
      id: "tele", name: "Tele", totalAmount: 100000, installmentsCount: 3, installmentAmount: 33333,
      firstDueDate: "2026-10-15", paidCount: 0, categoryId: "otros", autoAdd: true, active: true,
    };
    const movs: Movement[] = [];
    let inst = tele;
    for (const day of ["2026-10-15", "2026-11-15", "2026-12-15"]) {
      const r = processAutoAddRules({ recurrings: [], installments: [inst], existingMovements: movs, todayStr: day });
      expect(r.movementsToAdd.length).toBe(1);
      expect(r.movementsToAdd[0].date).toBe(day);
      movs.push(...r.movementsToAdd);
      inst = r.updatedInstallments[0];
    }
    expect(movs.map((m) => m.amount)).toEqual([33333, 33333, 33334]);
    expect(inst.active).toBe(false);
    expect(getUpcomingItems({ recurrings: [], installments: [inst], refDateInput: "2026-12-16" })).toEqual([]);

    // Período 10/12 – 9/1: solo la cuota de diciembre
    expect(available("2026-12-20", movs).summary.available).toBe(700000 - 33334);
  });
});
