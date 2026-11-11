import { describe, it, expect } from "vitest";
import { processAutoAddRules, getUpcomingItems, getInstallmentAmount } from "./recurring";
import { Installment, Movement, Recurring } from "../types";

describe("recurring.ts - Gastos recurrentes, cuotas y no duplicación", () => {
  it("Criterio: Suscripción de $22.000 con autoAdd aparece en gastos el día de vencimiento, una sola vez", () => {
    const recurring: Recurring = {
      id: "netflix",
      name: "Netflix",
      amount: 22000,
      categoryId: "suscripciones",
      dueDay: 10,
      autoAdd: true,
      active: true,
    };

    // Día de vencimiento: 2026-11-10
    const firstRun = processAutoAddRules({
      recurrings: [recurring],
      installments: [],
      existingMovements: [],
      todayStr: "2026-11-10",
    });

    expect(firstRun.movementsToAdd.length).toBe(1);
    expect(firstRun.movementsToAdd[0].amount).toBe(22000);
    expect(firstRun.movementsToAdd[0].date).toBe("2026-11-10");
    expect(firstRun.movementsToAdd[0].recurringId).toBe("netflix");

    // Si la app se reinicia en el mismo día, no debe duplicar
    const existingMovements: Movement[] = [...firstRun.movementsToAdd];
    const secondRun = processAutoAddRules({
      recurrings: [firstRun.updatedRecurrings[0]],
      installments: [],
      existingMovements,
      todayStr: "2026-11-10",
    });

    expect(secondRun.movementsToAdd.length).toBe(0);
  });

  it("Criterio: Si la app estuvo cerrada varios días, aplica vencimientos pendientes con su fecha real", () => {
    const recurring: Recurring = {
      id: "gym",
      name: "Gimnasio",
      amount: 15000,
      categoryId: "salud",
      dueDay: 5,
      autoAdd: true,
      active: true,
    };

    // Hoy es día 8, venció el 5
    const result = processAutoAddRules({
      recurrings: [recurring],
      installments: [],
      existingMovements: [],
      todayStr: "2026-11-08",
    });

    expect(result.movementsToAdd.length).toBe(1);
    expect(result.movementsToAdd[0].date).toBe("2026-11-05"); // Fecha real del vencimiento
    expect(result.movementsToAdd[0].amount).toBe(15000);
  });

  it("Cuotas: incrementa paidCount y al llegar a installmentsCount marca como inactiva", () => {
    const installment: Installment = {
      id: "zapatillas",
      name: "Zapatillas",
      totalAmount: 90000,
      installmentsCount: 3,
      installmentAmount: 30000,
      firstDueDate: "2026-09-10",
      paidCount: 2, // Ya pagó 2 cuotas, queda 1
      categoryId: "otros",
      autoAdd: true,
      active: true,
    };

    // 3ra cuota vence el 2026-11-10
    const result = processAutoAddRules({
      recurrings: [],
      installments: [installment],
      existingMovements: [],
      todayStr: "2026-11-10",
    });

    expect(result.movementsToAdd.length).toBe(1);
    expect(result.movementsToAdd[0].amount).toBe(30000);
    expect(result.movementsToAdd[0].note).toContain("Cuota 3/3");

    expect(result.completedInstallments.length).toBe(1);
    expect(result.completedInstallments[0].active).toBe(false);
    expect(result.completedInstallments[0].paidCount).toBe(3);
  });

  it("Criterio: Próximos vencimientos ordenados y días que faltan correctos", () => {
    const recurrings: Recurring[] = [
      {
        id: "spotify",
        name: "Spotify",
        amount: 4000,
        categoryId: "suscripciones",
          dueDay: 13, // En 3 días desde el 10
        autoAdd: true,
        active: true,
      },
      {
        id: "luz",
        name: "Edenor",
        amount: 25000,
        categoryId: "servicios",
          dueDay: 10, // Hoy
        autoAdd: true,
        active: true,
      },
    ];

    const upcoming = getUpcomingItems({
      recurrings,
      installments: [],
      refDateInput: "2026-11-10",
    });

    expect(upcoming.length).toBe(2);
    // El primero debe ser el que vence hoy (daysUntil = 0)
    expect(upcoming[0].name).toBe("Edenor");
    expect(upcoming[0].daysUntil).toBe(0);

    // El segundo Spotify en 3 días (daysUntil = 3)
    expect(upcoming[1].name).toBe("Spotify");
    expect(upcoming[1].daysUntil).toBe(3);
  });

  it("Bug #8: un fijo creado DESPUÉS de su día de vencimiento no se cobra este mes (arranca el mes que viene)", () => {
    const recurring: Recurring = {
      id: "gym",
      name: "Gimnasio",
      amount: 15000,
      categoryId: "salud",
      dueDay: 5,
      autoAdd: true,
      active: true,
      createdAt: "2026-11-10", // creado el 10, venció el 5
    };
    const sameMonth = processAutoAddRules({ recurrings: [recurring], installments: [], existingMovements: [], todayStr: "2026-11-20" });
    expect(sameMonth.movementsToAdd.length).toBe(0);

    const nextMonth = processAutoAddRules({ recurrings: [recurring], installments: [], existingMovements: [], todayStr: "2026-12-06" });
    expect(nextMonth.movementsToAdd.map((m) => m.date)).toEqual(["2026-12-05"]);
  });

  it("Un fijo creado el mismo día que vence sí se cobra ese día", () => {
    const recurring: Recurring = { id: "luz", name: "Luz", amount: 10000, categoryId: "servicios", dueDay: 10, autoAdd: true, active: true, createdAt: "2026-11-10" };
    const r = processAutoAddRules({ recurrings: [recurring], installments: [], existingMovements: [], todayStr: "2026-11-10" });
    expect(r.movementsToAdd.map((m) => m.date)).toEqual(["2026-11-10"]);
  });

  it("Cuotas: la última cuota absorbe el redondeo para que la suma dé el total exacto", () => {
    const inst: Installment = {
      id: "x", name: "Heladera", totalAmount: 100000, installmentsCount: 3, installmentAmount: 33333,
      firstDueDate: "2026-01-10", paidCount: 0, categoryId: "otros", autoAdd: true, active: true,
    };
    expect(getInstallmentAmount(inst, 1)).toBe(33333);
    expect(getInstallmentAmount(inst, 2)).toBe(33333);
    expect(getInstallmentAmount(inst, 3)).toBe(33334);
    const r = processAutoAddRules({ recurrings: [], installments: [inst], existingMovements: [], todayStr: "2026-03-15" });
    expect(r.movementsToAdd.reduce((a, m) => a + m.amount, 0)).toBe(100000);
  });
});
