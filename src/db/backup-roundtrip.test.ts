import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import { exportAllData, importAllData, updateSettings } from "./repo";
import { DEFAULT_SETTINGS } from "../lib/constants";

/** Base con un registro en cada tabla (incluidas las nuevas: dailyRateChanges, windowZoom, debts). */
async function seedFullDatabase() {
  await updateSettings({
    ...DEFAULT_SETTINGS,
    incomeMode: "daily",
    dailyRate: 40000,
    dailyRateChanges: [{ fromDate: "2026-11-20", rate: 45000 }],
    dailyRangeStart: "2026-11-10",
    dailyRangeEnd: "2026-11-30",
    dailyPreviousRange: { startDate: "2026-10-20", endDate: "2026-11-09" },
    theme: "light",
    windowZoom: "medium",
    onboardingDone: true,
    createdAt: "2026-10-01T10:00:00.000Z",
  });
  await db.movements.bulkPut([
    { id: "m1", date: "2026-11-10", amount: 20000, kind: "expense", categoryId: "comida", note: "Pizza", source: "manual", createdAt: "2026-11-10T12:00:00.000Z" },
    { id: "m2", date: "2026-11-11", amount: 500000, kind: "income", categoryId: "income", source: "manual", createdAt: "2026-11-11T12:00:00.000Z" },
  ]);
  await db.recurrings.put({ id: "r1", name: "Netflix", amount: 5000, categoryId: "suscripciones", dueDay: 10, autoAdd: true, active: true, lastAppliedDate: "2026-11-10", createdAt: "2026-10-01" });
  await db.installments.put({ id: "i1", name: "Tele", totalAmount: 100000, installmentsCount: 3, installmentAmount: 33333, firstDueDate: "2026-10-15", paidCount: 1, categoryId: "otros", autoAdd: true, active: true, lastAppliedDate: "2026-10-15" });
  await db.workDays.put({ date: "2026-11-15", worked: false, amount: 0 });
  await db.dayLogs.put({ date: "2026-11-09", logged: true, noExpenses: true });
  await db.debts.put({ id: "d1", kind: "they_owe", person: "Juan", amount: 15000, dueDate: "2026-11-30", note: "Cena", settled: false, createdAt: "2026-11-01T10:00:00.000Z" });
  await db.remindersSent.put({ key: "daily_2026-11-10", sentAt: "2026-11-10T21:00:00.000Z" });
}

async function snapshot() {
  const [settings, movements, recurrings, installments, workDays, dayLogs, debts] = await Promise.all([
    db.settings.get("main"),
    db.movements.orderBy("id").toArray(),
    db.recurrings.orderBy("id").toArray(),
    db.installments.orderBy("id").toArray(),
    db.workDays.orderBy("date").toArray(),
    db.dayLogs.orderBy("date").toArray(),
    db.debts.orderBy("id").toArray(),
  ]);
  return { settings, movements, recurrings, installments, workDays, dayLogs, debts };
}

async function wipe() {
  await Promise.all(db.tables.map((t) => t.clear()));
}

describe("Backup ida y vuelta sobre la base real (IndexedDB simulada)", () => {
  beforeEach(wipe);

  it("Exportar una base con datos en todas las tablas e importarla en una base vacía la deja idéntica", async () => {
    await seedFullDatabase();
    const before = await snapshot();
    const json = await exportAllData();

    await wipe();
    expect((await snapshot()).movements).toEqual([]);

    const res = await importAllData(json);
    expect(res).toEqual({ success: true });
    expect(await snapshot()).toEqual(before);
    // remindersSent no viaja en el backup: la base nueva arranca sin recordatorios enviados
    expect(await db.remindersSent.count()).toBe(0);
  });

  it("Un archivo roto se rechaza sin tocar los datos que ya están", async () => {
    await seedFullDatabase();
    const before = await snapshot();

    for (const broken of ["{no json", JSON.stringify({ version: 2 }), JSON.stringify({ version: 99, settings: {}, movements: [] })]) {
      const res = await importAllData(broken);
      expect(res.success).toBe(false);
      expect(res.error).toBeTruthy();
    }
    // Un backup con un movimiento inválido tampoco entra (todo o nada)
    const good = JSON.parse(await exportAllData());
    good.movements[0].amount = -1;
    expect((await importAllData(JSON.stringify(good))).success).toBe(false);

    expect(await snapshot()).toEqual(before);
    expect(await db.remindersSent.count()).toBe(1);
  });
});
