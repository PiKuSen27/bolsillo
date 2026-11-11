import { describe, it, expect } from "vitest";
import { formatCurrency, formatRelativeDue, getDayInitial } from "./format";

describe("format.ts - Formato de moneda, fechas y días", () => {
  it("Formatea moneda en pesos argentinos (ARS)", () => {
    const formatted = formatCurrency(700000);
    // Should contain $ and 700.000
    expect(formatted).toMatch(/\$\s?700\.000/);
  });

  it("Formatea texto relativo de vencimiento", () => {
    expect(formatRelativeDue(0)).toBe("Vence hoy");
    expect(formatRelativeDue(1)).toBe("Vence mañana");
    expect(formatRelativeDue(3)).toBe("en 3 días");
    expect(formatRelativeDue(-1)).toBe("Venció ayer");
    expect(formatRelativeDue(-4)).toBe("Venció hace 4 días");
  });

  it("Devuelve inicial del día de la semana (L, M, X, J, V, S, D)", () => {
    // 2026-11-09 es Lunes
    expect(getDayInitial("2026-11-09")).toBe("L");
    // 2026-11-10 es Martes
    expect(getDayInitial("2026-11-10")).toBe("M");
    // 2026-11-11 es Miércoles -> X
    expect(getDayInitial("2026-11-11")).toBe("X");
    // 2026-11-12 es Jueves -> J
    expect(getDayInitial("2026-11-12")).toBe("J");
    // 2026-11-13 es Viernes -> V
    expect(getDayInitial("2026-11-13")).toBe("V");
    // 2026-11-14 es Sábado -> S
    expect(getDayInitial("2026-11-14")).toBe("S");
    // 2026-11-15 es Domingo -> D
    expect(getDayInitial("2026-11-15")).toBe("D");
  });
});
