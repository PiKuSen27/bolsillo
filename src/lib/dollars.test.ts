import { describe, it, expect } from "vitest";
import { debtArs, fetchQuote, parseQuote, usdToArs } from "./dollars";
import { groupDebtsByPerson } from "./debts";
import { Debt } from "../types";

const debt = (id: string, amount: number, extra: Partial<Debt> = {}): Debt => ({
  id, person: "Rocio", kind: "they_owe", amount, settled: false, createdAt: "2026-11-01T10:00:00Z", ...extra,
});

describe("dollars.ts - Cotización y deudas en dólares", () => {
  it("Toma la cotización de venta de dolarapi, redondeada a pesos, con su fecha", () => {
    expect(parseQuote({ casa: "blue", compra: 1570, venta: 1590.4, fechaActualizacion: "2026-11-14T17:24:00.000Z" }, "blue")).toEqual({
      rate: 1590, date: "2026-11-14", type: "blue",
    });
    expect(() => parseQuote({ venta: "mucho" }, "oficial")).toThrow();
    expect(() => parseQuote({ venta: -5 }, "oficial")).toThrow();
  });

  it("Sin conexión o con error del servicio avisa que se puede escribir a mano", async () => {
    const offline = () => Promise.reject(new TypeError("Failed to fetch"));
    await expect(fetchQuote("oficial", offline as unknown as typeof fetch)).rejects.toThrow(/a mano/);
    const bad = () => Promise.resolve(new Response("x", { status: 500 }));
    await expect(fetchQuote("oficial", bad as unknown as typeof fetch)).rejects.toThrow(/a mano/);
    const ok = (url: string) => {
      expect(url).toBe("https://dolarapi.com/v1/dolares/bolsa");
      return Promise.resolve(new Response(JSON.stringify({ venta: 1584.5, fechaActualizacion: "2026-11-16T10:00:00Z" })));
    };
    expect((await fetchQuote("bolsa", ok as unknown as typeof fetch)).rate).toBe(1585);
  });

  it("Conversión: 300 USD a $ 1.500 = $ 450.000; una deuda en pesos queda igual", () => {
    expect(usdToArs(300, 1500)).toBe(450000);
    expect(debtArs(debt("a", 300, { currency: "USD", rate: 1500 }))).toBe(450000);
    expect(debtArs(debt("b", 20000))).toBe(20000);
  });

  it("Los totales por persona suman en pesos con la cotización guardada de cada deuda", () => {
    const [g] = groupDebtsByPerson([
      debt("a", 300, { currency: "USD", rate: 1500 }),
      debt("b", 100, { currency: "USD", rate: 1000 }),
      debt("c", 50000, { kind: "i_owe" }),
    ]);
    expect(g.theyOwe).toBe(550000);
    expect(g.iOwe).toBe(50000);
    expect(g.net).toBe(500000);
  });
});
