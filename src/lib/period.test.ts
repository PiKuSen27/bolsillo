import { describe, it, expect } from "vitest";
import { calculatePeriod, calculateVariablePeriod, clampDateToMonth } from "./period";

describe("period.ts - Cálculo de períodos y fechas", () => {
  it("Período estándar del 1 al último día de mes", () => {
    // 10 de noviembre de 2026, cobro el 1
    const period = calculatePeriod("2026-11-10", 1);
    expect(period.startDate).toBe("2026-11-01");
    expect(period.endDate).toBe("2026-11-30");
    expect(period.daysInPeriod).toBe(30);
    expect(period.daysRemaining).toBe(21); // Del 10 al 30 incl = 21 días
  });

  it("Período con cobro el día 15", () => {
    // Si hoy es 16 de noviembre, el período arrancó el 15 de nov y termina el 14 de dic
    const periodAfter = calculatePeriod("2026-11-16", 15);
    expect(periodAfter.startDate).toBe("2026-11-15");
    expect(periodAfter.endDate).toBe("2026-12-14");

    // Si hoy es 10 de noviembre, el período arrancó el 15 de octubre y termina el 14 de nov
    const periodBefore = calculatePeriod("2026-11-10", 15);
    expect(periodBefore.startDate).toBe("2026-10-15");
    expect(periodBefore.endDate).toBe("2026-11-14");
    expect(periodBefore.daysRemaining).toBe(5); // 10, 11, 12, 13, 14 = 5 días
  });

  it("Período variable por rango con fechas válidas", () => {
    const period = calculateVariablePeriod("2026-11-10", "2026-11-25", "2026-11-10");
    expect(period.startDate).toBe("2026-11-10");
    expect(period.endDate).toBe("2026-11-25");
    expect(period.daysInPeriod).toBe(16);
    expect(period.daysRemaining).toBe(16);
  });

  it("Período variable con fechas invertidas: auto-intercambia y nunca da días negativos", () => {
    // Usuario pone por error Fin = 10 y Inicio = 25
    const period = calculateVariablePeriod("2026-11-25", "2026-11-10", "2026-11-10");
    expect(period.startDate).toBe("2026-11-10");
    expect(period.endDate).toBe("2026-11-25");
    expect(period.daysInPeriod).toBe(16);
    expect(period.daysRemaining).toBeGreaterThanOrEqual(1);
  });

  it("Maneja día de cobro 31 en febrero (año no bisiesto)", () => {
    // Febrero 2025 tiene 28 días
    const clampedFeb = clampDateToMonth(2025, 1, 31);
    expect(clampedFeb.getDate()).toBe(28);

    const period = calculatePeriod("2025-02-15", 31);
    // Period started Jan 31, ends Feb 27 (day before Feb 28)
    expect(period.startDate).toBe("2025-01-31");
    expect(period.endDate).toBe("2025-02-27");
  });

  it("Maneja día de cobro 31 en febrero (año bisiesto 2024)", () => {
    const clampedFebLeap = clampDateToMonth(2024, 1, 31);
    expect(clampedFebLeap.getDate()).toBe(29);

    const period = calculatePeriod("2024-02-10", 31);
    expect(period.startDate).toBe("2024-01-31");
    expect(period.endDate).toBe("2024-02-28");
  });

  it("Maneja fin de año (diciembre a enero)", () => {
    const period = calculatePeriod("2026-12-20", 15);
    expect(period.startDate).toBe("2026-12-15");
    expect(period.endDate).toBe("2027-01-14");
  });

  it("isTodayInPeriod: dentro, antes y después del rango variable", () => {
    expect(calculateVariablePeriod("2026-11-10", "2026-11-20", "2026-11-15").isTodayInPeriod).toBe(true);
    expect(calculateVariablePeriod("2026-11-10", "2026-11-20", "2026-11-09").isTodayInPeriod).toBe(false);
    expect(calculateVariablePeriod("2026-11-10", "2026-11-20", "2026-11-21").isTodayInPeriod).toBe(false);
    // Rango vencido: daysRemaining nunca baja de 1 (evita dividir por cero en "podés gastar X/día")
    expect(calculateVariablePeriod("2026-11-10", "2026-11-20", "2026-11-25").daysRemaining).toBe(1);
  });
});
