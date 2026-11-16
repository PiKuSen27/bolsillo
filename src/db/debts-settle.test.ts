import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import { settleDebts } from "./repo";
import { Debt } from "../types";

const debt = (id: string, amount: number, kind: Debt["kind"] = "they_owe"): Debt => ({
  id, person: "Rocio", amount, kind, settled: false, createdAt: "2026-11-01T10:00:00.000Z",
});

describe("Saldar varias deudas y deshacer", () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.debts.bulkPut([debt("a", 100000), debt("b", 50000), debt("c", 55000), debt("x", 9000, "i_owe")]);
  });

  it("Saldar todo con movimientos: marca las deudas y anota un movimiento por cada una", async () => {
    await settleDebts(["a", "b", "c"], true, "2026-11-12");
    const ds = await db.debts.bulkGet(["a", "b", "c", "x"]);
    expect(ds.map((d) => d!.settled)).toEqual([true, true, true, false]);
    const movs = await db.movements.toArray();
    expect(movs.length).toBe(3);
    expect(movs.every((m) => m.kind === "income" && m.date === "2026-11-12" && m.source === "debt")).toBe(true);
    expect(movs.reduce((s, m) => s + m.amount, 0)).toBe(205000);
  });

  it("Deshacer vuelve las deudas a pendientes y borra los movimientos creados", async () => {
    const undo = await settleDebts(["a", "b", "c"], true, "2026-11-12");
    await undo();
    const ds = await db.debts.bulkGet(["a", "b", "c"]);
    expect(ds.every((d) => d!.settled === false && d!.settledAt === undefined)).toBe(true);
    expect(await db.movements.count()).toBe(0);
  });

  it("Solo saldar (sin mover saldo) no crea movimientos; una deuda ya saldada no se vuelve a saldar", async () => {
    await settleDebts(["a"], false, "2026-11-12");
    expect(await db.movements.count()).toBe(0);
    const undo = await settleDebts(["a", "b"], true, "2026-11-13");
    expect((await db.movements.toArray()).map((m) => m.debtId)).toEqual(["b"]);
    await undo();
    expect((await db.debts.get("a"))!.settled).toBe(true); // seguía saldada de antes
    expect((await db.debts.get("b"))!.settled).toBe(false);
  });
});

import { registerDebtPayment } from "./repo";

describe("Pagos parciales en la base", () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.debts.bulkPut([debt("a", 100000), { ...debt("u", 300, "i_owe"), currency: "USD" as const, rate: 1500 }]);
  });

  it("Guarda el pago, anota el movimiento en pesos y Deshacer vuelve todo atrás", async () => {
    const undo = await registerDebtPayment("u", 100, "2026-11-12", true);
    const d = await db.debts.get("u");
    expect(d!.payments!.map((p) => p.amount)).toEqual([100]);
    const [m] = await db.movements.toArray();
    expect(m).toMatchObject({ kind: "expense", amount: 150000, date: "2026-11-12", source: "debt", debtId: "u" });
    await undo();
    expect((await db.debts.get("u"))!.payments).toBeUndefined();
    expect(await db.movements.count()).toBe(0);
  });

  it("El último pago la deja saldada; Saldar después usa el saldo", async () => {
    await registerDebtPayment("a", 40000, "2026-11-12", false);
    await settleDebts(["a"], true, "2026-11-13");
    const [m] = await db.movements.toArray();
    expect(m.amount).toBe(60000);
    expect((await db.debts.get("a"))!.settled).toBe(true);
  });
});
