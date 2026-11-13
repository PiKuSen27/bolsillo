import { describe, it, expect } from "vitest";
import { formatCurrency, formatRelativeDue, getDayInitial, formatAmountInput, formatNumberWithDots, formatLocalDate, parseLocalDate } from "./format";
import { MAX_AMOUNT } from "./constants";

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

  it("Formatea negativos con el signo antes del $ y montos grandes", () => {
    expect(formatCurrency(-5000)).toBe("-$ 5.000");
    expect(formatCurrency(1500000)).toBe("$ 1.500.000");
    expect(formatCurrency(0)).toBe("$ 0");
    expect(formatCurrency(NaN)).toBe("$ 0");
  });

  it("formatAmountInput: solo dígitos, puntos de miles y tope MAX_AMOUNT", () => {
    expect(formatAmountInput("20000")).toBe("20.000");
    expect(formatAmountInput("2a0.0b00")).toBe("20.000");
    expect(formatAmountInput("")).toBe("");
    expect(formatAmountInput("0007")).toBe("7");
    expect(formatAmountInput("99999999999999999")).toBe(formatNumberWithDots(MAX_AMOUNT));
  });

  it("parseLocalDate/formatLocalDate no corren la fecha por zona horaria", () => {
    expect(formatLocalDate(parseLocalDate("2026-11-10"))).toBe("2026-11-10");
    expect(formatLocalDate(parseLocalDate("2026-11-10T23:59:00.000Z"))).toBe("2026-11-10");
  });
});

import { setAmountsHidden, formatCurrencyVisible, HIDDEN_AMOUNT } from "./format";

describe("format.ts - Ocultar montos", () => {
  it("Con montos ocultos, formatCurrency tapa todo y formatCurrencyVisible (calculadora) sigue mostrando", () => {
    setAmountsHidden(true);
    try {
      expect(formatCurrency(20000)).toBe(HIDDEN_AMOUNT);
      expect(formatCurrency(-5000)).toBe("$ ••••••");
      expect(formatCurrencyVisible(20000)).toBe("$ 20.000");
    } finally {
      setAmountsHidden(false);
    }
    expect(formatCurrency(20000)).toBe("$ 20.000");
  });
});
