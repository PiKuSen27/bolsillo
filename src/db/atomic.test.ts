import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import { store } from "./store";
import { saveAutoCharges } from "./repo";
import { Installment, Movement } from "../types";

const inst: Installment = {
  id: "tele", name: "Tele", totalAmount: 100000, installmentsCount: 3, installmentAmount: 33333,
  firstDueDate: "2026-10-15", paidCount: 0, categoryId: "otros", autoAdd: false, active: true,
};
const mv: Movement = { id: "auto1", date: "2026-11-10", amount: 5000, kind: "expense", categoryId: "x", source: "recurring", createdAt: "x" };
// Un registro sin id hace fallar la escritura: simula que la app se corta a mitad de camino
const broken = { ...inst, id: undefined } as unknown as Installment;

describe("Integridad de la plata (A-01, A-02)", () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await store.installments.put(inst);
  });

  it("Antes (escrituras separadas): si falla la segunda, el gasto queda guardado igual → inconsistencia", async () => {
    await store.movements.put(mv);
    await expect(store.installments.put(broken)).rejects.toThrow();
    expect(await db.movements.count()).toBe(1); // reproduce el problema de la auditoría
  });

  it("A-01: los cobros automáticos se guardan todo o nada", async () => {
    await expect(saveAutoCharges({ movementsToAdd: [mv], updatedRecurrings: [], updatedInstallments: [broken] })).rejects.toThrow();
    expect(await db.movements.count()).toBe(0);
    await saveAutoCharges({ movementsToAdd: [mv], updatedRecurrings: [], updatedInstallments: [{ ...inst, paidCount: 1 }] });
    expect(await db.movements.count()).toBe(1);
    expect((await store.installments.get("tele"))!.paidCount).toBe(1);
  });
});
