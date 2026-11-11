import { describe, it, expect } from "vitest";
import { shouldCalculatorHandleKey } from "./keyboard";

describe("keyboard.ts - Teclado de la calculadora", () => {
  it("Con un panel o modal abierto, la calculadora ignora el teclado (Enter no guarda)", () => {
    expect(shouldCalculatorHandleKey({ activeTag: "BODY", dialogOpen: true })).toBe(false);
    expect(shouldCalculatorHandleKey({ activeTag: "BUTTON", dialogOpen: true })).toBe(false);
  });

  it("Escribiendo en un campo de texto, fecha o select, la calculadora no captura teclas", () => {
    for (const tag of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(shouldCalculatorHandleKey({ activeTag: tag, dialogOpen: false })).toBe(false);
    }
  });

  it("Sin paneles abiertos y sin foco en campos, la calculadora maneja el teclado", () => {
    expect(shouldCalculatorHandleKey({ activeTag: "BODY", dialogOpen: false })).toBe(true);
    expect(shouldCalculatorHandleKey({ activeTag: undefined, dialogOpen: false })).toBe(true);
  });
});
