import { describe, it, expect } from "vitest";
import { calculateBalance } from "./balance";
import { Movement, WorkDay } from "../types";

describe("balance.ts - Cálculo de saldos e ingresos", () => {
  it("Criterio: con sueldo $700.000 y un gasto de $22.000 el disponible muestra $678.000", () => {
    const movements: Movement[] = [
      {
        id: "1",
        date: "2026-11-05",
        amount: 22000,
        kind: "expense",
        categoryId: "servicios",
        source: "manual",
        createdAt: "2026-11-05T10:00:00Z",
      },
    ];

    const result = calculateBalance({
      incomeMode: "salary",
      fixedSalary: 700000,
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      movements,
      workDays: [],
      daysRemaining: 25,
      todayDateStr: "2026-11-05",
    });

    expect(result.fixedSalary).toBe(700000);
    expect(result.totalExpenses).toBe(22000);
    expect(result.available).toBe(678000);
    expect(result.dailySuggested).toBe(Math.floor(678000 / 25));
  });

  it("Modo Variable excluyente: suma días del rango x tarifa + ingresos manuales", () => {
    const movements: Movement[] = [
      {
        id: "inc-1",
        date: "2026-11-08", // Ingreso 2 días antes de la fecha de inicio del rango (10)
        amount: 500000,
        kind: "income",
        categoryId: "income",
        source: "manual",
        createdAt: "2026-11-08T10:00:00Z",
      },
      {
        id: "exp-1",
        date: "2026-11-10",
        amount: 177722,
        kind: "expense",
        categoryId: "comida",
        source: "manual",
        createdAt: "2026-11-10T10:00:00Z",
      },
    ];

    // Rango del 10 al 25 = 16 días x $10.000 = $160.000
    const result = calculateBalance({
      incomeMode: "daily",
      fixedSalary: 500000, // No debe sumarse al estar en modo daily
      dailyRate: 10000,
      daysInPeriod: 16,
      periodStart: "2026-11-10",
      periodEnd: "2026-11-25",
      movements,
      workDays: [],
      daysRemaining: 16,
      todayDateStr: "2026-11-10",
    });

    expect(result.baseIncome).toBe(160000);
    expect(result.manualIncome).toBe(500000);
    expect(result.totalIncome).toBe(660000); // 160.000 + 500.000
    expect(result.totalExpenses).toBe(177722);
    expect(result.available).toBe(660000 - 177722); // 482.278
  });

  it("Modo Variable sin tarifa fija suma días marcados individualmente", () => {
    const workDays: WorkDay[] = [
      { date: "2026-11-02", worked: true, amount: 25000 },
      { date: "2026-11-03", worked: true, amount: 30000 },
      { date: "2026-11-04", worked: false, amount: 0 },
    ];

    const result = calculateBalance({
      incomeMode: "daily",
      fixedSalary: 500000,
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      movements: [],
      workDays,
      daysRemaining: 20,
    });

    expect(result.workDaysTotal).toBe(55000);
    expect(result.workedDaysCount).toBe(2);
    expect(result.avgDailyRate).toBe(27500);
    expect(result.totalIncome).toBe(55000);
    expect(result.available).toBe(55000);
  });

  it("Maneja saldos negativos cuando los gastos superan los ingresos", () => {
    const movements: Movement[] = [
      {
        id: "1",
        date: "2026-11-02",
        amount: 800000,
        kind: "expense",
        categoryId: "otros",
        source: "manual",
        createdAt: "2026-11-02T10:00:00Z",
      },
    ];

    const result = calculateBalance({
      incomeMode: "salary",
      fixedSalary: 700000,
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      movements,
      workDays: [],
      daysRemaining: 10,
    });

    expect(result.available).toBe(-100000);
    expect(result.dailySuggested).toBe(0);
    expect(result.spentPercentage).toBe(100);
  });
});
