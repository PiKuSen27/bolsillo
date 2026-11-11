import { describe, it, expect } from "vitest";
import { evaluateCalcExpression } from "./calc";
import { MAX_AMOUNT } from "./constants";

describe("calc.ts - Calculadora y evaluación de expresiones", () => {
  it("Criterio: resuelve 3500 × 4 = 14000", () => {
    expect(evaluateCalcExpression("3500 × 4")).toBe(14000);
    expect(evaluateCalcExpression("3500 * 4")).toBe(14000);
  });

  it("Resuelve expresiones con puntos de miles en vivo: 20.000 + 5.000 = 25000", () => {
    expect(evaluateCalcExpression("20.000 + 5.000")).toBe(25000);
    expect(evaluateCalcExpression("3.500 × 4")).toBe(14000);
  });

  it("Soporta suma, resta y división", () => {
    expect(evaluateCalcExpression("1200 + 800 - 500")).toBe(1500);
    expect(evaluateCalcExpression("1000 ÷ 4")).toBe(250);
    expect(evaluateCalcExpression("1000 / 4")).toBe(250);
  });

  it("Blindaje contra operadores incompletos finales: 20000 + evalúa a 20000", () => {
    expect(evaluateCalcExpression("20000 +")).toBe(20000);
    expect(evaluateCalcExpression("20.000 ×")).toBe(20000);
    expect(evaluateCalcExpression("15000 - +")).toBe(15000);
    expect(evaluateCalcExpression("+")).toBe(0);
  });

  it("Respeta precedencia de operadores (* y / antes que + y -)", () => {
    expect(evaluateCalcExpression("100 + 200 * 3")).toBe(700);
    expect(evaluateCalcExpression("500 - 300 / 2")).toBe(350);
  });

  it("Redondea montos con coma decimal a enteros", () => {
    expect(evaluateCalcExpression("100 / 3")).toBe(33);
  });

  it("Maneja números negativos y espacios", () => {
    expect(evaluateCalcExpression("-50 + 150")).toBe(100);
    expect(evaluateCalcExpression("   500   +   250  ")).toBe(750);
  });

  it("Tope de monto: rechaza resultados mayores a $ 1.000.000.000.000 (MAX_AMOUNT)", () => {
    expect(evaluateCalcExpression("1000000000000")).toBe(MAX_AMOUNT);
    expect(() => evaluateCalcExpression("1000000000001")).toThrow("Monto demasiado grande");
    expect(() => evaluateCalcExpression("999999999999 × 999999999999")).toThrow("Monto demasiado grande");
    expect(() => evaluateCalcExpression("-999999999999 × 999999999999")).toThrow("Monto demasiado grande");
  });

  it("Lanza error ante división por cero o sintaxis inválida", () => {
    expect(() => evaluateCalcExpression("100 / 0")).toThrow("División por cero");
    expect(() => evaluateCalcExpression("abc + 123")).toThrow("Expresión inválida");
  });
});
