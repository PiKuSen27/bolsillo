import { describe, it, expect } from "vitest";
import { limitStatus, limitWarning } from "./limits";

describe("limits.ts - Tope por categoría", () => {
  it("Estado según lo gastado: bien, cerca (80%) o pasado", () => {
    expect(limitStatus(50000, 100000)).toEqual({ level: "ok", pct: 50 });
    expect(limitStatus(80000, 100000)).toEqual({ level: "near", pct: 80 });
    expect(limitStatus(100000, 100000)).toEqual({ level: "near", pct: 100 });
    expect(limitStatus(100001, 100000)).toEqual({ level: "over", pct: 100 });
    expect(limitStatus(5000, undefined)).toBeNull();
    expect(limitStatus(5000, 0)).toBeNull();
  });

  it("Aviso solo cuando un gasto nuevo cruza el 80% o se pasa del tope", () => {
    expect(limitWarning(70000, 85000, 100000, "Comida")).toBe("Llegaste al 80% del tope de Comida");
    expect(limitWarning(85000, 90000, 100000, "Comida")).toBeNull(); // ya estaba arriba del 80%
    expect(limitWarning(90000, 120000, 100000, "Comida")).toBe("Te pasaste del tope de Comida ($ 100.000)");
    expect(limitWarning(10000, 120000, 100000, "Comida")).toBe("Te pasaste del tope de Comida ($ 100.000)");
    expect(limitWarning(120000, 130000, 100000, "Comida")).toBe("Te pasaste del tope de Comida ($ 100.000)");
    expect(limitWarning(1000, 2000, undefined, "Comida")).toBeNull();
  });
});
