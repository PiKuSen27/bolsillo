import { describe, it, expect } from "vitest";
import { calculatePreviousPeriodBalance } from "./carryover";
import { Movement, Settings } from "../types";
import { DEFAULT_SETTINGS } from "./constants";

const mv = (date: string, amount: number, kind: "expense" | "income" = "expense"): Movement => ({
  id: `${date}-${amount}`,
  date,
  amount,
  kind,
  categoryId: "x",
  source: "manual",
  createdAt: `${date}T10:00:00Z`,
});

describe("carryover.ts - Saldo del período anterior (solo informativo)", () => {
  it("Modo fijo: sueldo 700.000, gastos 500.000 en el período anterior → quedó 200.000 a favor", () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, incomeMode: "salary", fixedSalary: 700000, payday: 10, createdAt: "2026-09-01T00:00:00Z" };
    const movements = [mv("2026-10-15", 300000), mv("2026-10-28", 200000), mv("2026-11-12", 50000)];
    // Hoy 12/11 → período actual 10/11–09/12, anterior 10/10–09/11
    expect(
      calculatePreviousPeriodBalance({ settings, movements, workDays: [], currentPeriodStart: "2026-11-10" })
    ).toBe(200000);
  });

  it("Modo fijo: cerró abajo (gastos > sueldo) → número negativo", () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, incomeMode: "salary", fixedSalary: 100000, payday: 1, createdAt: "2026-09-01T00:00:00Z" };
    const movements = [mv("2026-10-05", 150000), mv("2026-10-20", 20000, "income")];
    expect(
      calculatePreviousPeriodBalance({ settings, movements, workDays: [], currentPeriodStart: "2026-11-01" })
    ).toBe(-30000);
  });

  it("Sin movimientos en el período anterior → null (no se muestra nada)", () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, incomeMode: "salary", fixedSalary: 700000, payday: 1, createdAt: "2026-09-01T00:00:00Z" };
    expect(
      calculatePreviousPeriodBalance({ settings, movements: [mv("2026-11-03", 1000)], workDays: [], currentPeriodStart: "2026-11-01" })
    ).toBeNull();
  });

  it("Si la app se empezó a usar en este período → null", () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, incomeMode: "salary", fixedSalary: 700000, payday: 1, createdAt: "2026-11-02T00:00:00Z" };
    expect(
      calculatePreviousPeriodBalance({ settings, movements: [mv("2026-10-20", 1000)], workDays: [], currentPeriodStart: "2026-11-01" })
    ).toBeNull();
  });

  it("Modo variable: usa el rango anterior guardado (tarifa L-S, domingos libres) menos gastos", () => {
    // Rango anterior lun 02/11 – dom 08/11 → 6 × 40.000 = 240.000
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      incomeMode: "daily",
      dailyRate: 40000,
      dailyRangeStart: "2026-11-09",
      dailyRangeEnd: "2026-11-15",
      dailyPreviousRange: { startDate: "2026-11-02", endDate: "2026-11-08" },
      createdAt: "2026-10-01T00:00:00Z",
    };
    const movements = [mv("2026-11-04", 90000), mv("2026-11-10", 5000)];
    expect(
      calculatePreviousPeriodBalance({ settings, movements, workDays: [], currentPeriodStart: "2026-11-09" })
    ).toBe(150000);
  });

  it("Modo variable sin rango anterior guardado → null", () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, incomeMode: "daily", dailyRangeStart: "2026-11-09", dailyRangeEnd: "2026-11-15", createdAt: "2026-10-01T00:00:00Z" };
    expect(
      calculatePreviousPeriodBalance({ settings, movements: [mv("2026-11-04", 90000)], workDays: [], currentPeriodStart: "2026-11-09" })
    ).toBeNull();
  });
});
