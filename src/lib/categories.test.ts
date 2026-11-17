import { describe, it, expect } from "vitest";
import { newCategory } from "./categories";
import { DEFAULT_CATEGORIES, TEXT_LIMITS } from "./constants";

describe("categories.ts - Crear categorías (M-03)", () => {
  it("El id nunca choca con una categoría existente ni con las reservadas (income, compra_usd)", () => {
    const cats = [...DEFAULT_CATEGORIES, { id: "viajes", name: "Turismo", icon: "Tag", color: "#000000" }];
    expect(newCategory(cats, "Viajes", "#111111")!.id).toBe("viajes_2");
    expect(newCategory(cats, "Income", "#111111")!.id).toBe("income_2");
    expect(newCategory(cats, "Compra USD", "#111111")!.id).toBe("compra_usd_2");
    expect(newCategory(cats, "Mascotas", "#111111")!.id).toBe("mascotas");
  });
  it("Rechaza nombre vacío o repetido (sin importar mayúsculas ni acentos) y recorta al largo del backup", () => {
    expect(newCategory(DEFAULT_CATEGORIES, "   ", "#111111")).toBeNull();
    expect(newCategory(DEFAULT_CATEGORIES, "comida", "#111111")).toBeNull();
    expect(newCategory(DEFAULT_CATEGORIES, "Súper ", "#111111")).toBeNull();
    expect(newCategory(DEFAULT_CATEGORIES, "a".repeat(80), "#111111")!.name.length).toBe(TEXT_LIMITS.category);
  });
});
