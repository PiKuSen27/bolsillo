import { describe, it, expect } from "vitest";
import { calculateBalance } from "./balance";
import { Movement } from "../types";

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
      daysRemaining: 25,
      todayDateStr: "2026-11-05",
    });

    expect(result.fixedSalary).toBe(700000);
    expect(result.totalExpenses).toBe(22000);
    expect(result.available).toBe(678000);
    expect(result.dailySuggested).toBe(Math.floor(678000 / 25));
  });

  it("Modo Variable excluyente: suma días del rango x tarifa + ingresos manuales del rango", () => {
    const movements: Movement[] = [
      {
        id: "inc-before",
        date: "2026-11-08", // 2 días antes del inicio del rango (10): NO cuenta
        amount: 99000,
        kind: "income",
        categoryId: "income",
        source: "manual",
        createdAt: "2026-11-08T10:00:00Z",
      },
      {
        id: "inc-1",
        date: "2026-11-12", // Dentro del rango: suma
        amount: 500000,
        kind: "income",
        categoryId: "income",
        source: "manual",
        createdAt: "2026-11-12T10:00:00Z",
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

    // Rango del 10 al 25: la suma de los días (calculada en workdays.ts) es $160.000
    const result = calculateBalance({
      incomeMode: "daily",
      fixedSalary: 500000, // No debe sumarse al estar en modo daily
      variableIncome: 160000,
      periodStart: "2026-11-10",
      periodEnd: "2026-11-25",
      movements,
      daysRemaining: 16,
      todayDateStr: "2026-11-10",
    });

    expect(result.baseIncome).toBe(160000);
    expect(result.manualIncome).toBe(500000);
    expect(result.totalIncome).toBe(660000); // 160.000 + 500.000
    expect(result.totalExpenses).toBe(177722);
    expect(result.available).toBe(660000 - 177722); // 482.278
  });

  it("Modo Variable sin rango (variableIncome ausente): ingreso 0 y nunca usa el sueldo fijo", () => {
    const result = calculateBalance({
      incomeMode: "daily",
      fixedSalary: 500000,
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      movements: [],
      daysRemaining: 20,
      todayDateStr: "2026-11-10",
    });

    expect(result.baseIncome).toBe(0);
    expect(result.totalIncome).toBe(0);
    expect(result.available).toBe(0);
  });

  it("Bug #1: un gasto del período anterior NO se resta del sueldo nuevo", () => {
    // Cobro el día 10, hoy 11/11 → período 10/11 al 09/12. El gasto del 05/11 es del período anterior.
    const movements: Movement[] = [
      { id: "prev", date: "2026-11-05", amount: 300000, kind: "expense", categoryId: "otros", source: "manual", createdAt: "2026-11-05T10:00:00Z" },
      { id: "prev-inc", date: "2026-11-06", amount: 50000, kind: "income", categoryId: "income", source: "manual", createdAt: "2026-11-06T10:00:00Z" },
      { id: "today", date: "2026-11-11", amount: 10000, kind: "expense", categoryId: "comida", source: "manual", createdAt: "2026-11-11T10:00:00Z" },
    ];

    const result = calculateBalance({
      incomeMode: "salary",
      fixedSalary: 1000000,
      periodStart: "2026-11-10",
      periodEnd: "2026-12-09",
      movements,
      daysRemaining: 29,
      todayDateStr: "2026-11-11",
    });

    expect(result.totalExpenses).toBe(10000);
    expect(result.manualIncome).toBe(0);
    expect(result.available).toBe(990000);
  });

  it("Bug #2: con el rango variable vencido, los gastos nuevos siguen bajando el Disponible", () => {
    // Rango 01/11 al 07/11 (suma de días = $70.000). Hoy 10/11, ya vencido.
    const movements: Movement[] = [
      { id: "in-range", date: "2026-11-03", amount: 20000, kind: "expense", categoryId: "comida", source: "manual", createdAt: "2026-11-03T10:00:00Z" },
      { id: "after", date: "2026-11-10", amount: 30000, kind: "expense", categoryId: "comida", source: "manual", createdAt: "2026-11-10T10:00:00Z" },
    ];

    const result = calculateBalance({
      incomeMode: "daily",
      fixedSalary: 0,
      variableIncome: 70000,
      periodStart: "2026-11-01",
      periodEnd: "2026-11-07",
      movements,
      daysRemaining: 1,
      todayDateStr: "2026-11-10",
    });

    expect(result.baseIncome).toBe(70000);
    expect(result.totalExpenses).toBe(50000);
    expect(result.available).toBe(20000);
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
      daysRemaining: 10,
    });

    expect(result.available).toBe(-100000);
    expect(result.dailySuggested).toBe(0);
    expect(result.spentPercentage).toBe(100);
  });
});
