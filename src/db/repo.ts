import { db } from "./db";
import {
  DayLog,
  Debt,
  Installment,
  Movement,
  Recurring,
  Settings,
  WorkDay,
} from "../types";
import { DEFAULT_SETTINGS } from "../lib/constants";
import { validateBackup, ValidBackup } from "../lib/backup";

export interface DatabaseExport {
  version: number;
  exportedAt: string;
  settings: Settings;
  movements: Movement[];
  recurrings: Recurring[];
  installments: Installment[];
  workDays: WorkDay[];
  dayLogs: DayLog[];
  debts?: Debt[];
}

export async function getSettings(): Promise<Settings> {
  const current = await db.settings.get("main");
  if (!current) {
    return await db.initDefaults();
  }
  return current;
}

export async function updateSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated: Settings = { ...current, ...partial };
  await db.settings.put(updated);
  return updated;
}

export async function markDayAsNoExpenses(dateStr: string): Promise<void> {
  await db.dayLogs.put({
    date: dateStr,
    logged: true,
    noExpenses: true,
  });
}

export async function markDayAsLogged(dateStr: string): Promise<void> {
  const existing = await db.dayLogs.get(dateStr);
  await db.dayLogs.put({
    date: dateStr,
    logged: true,
    noExpenses: existing?.noExpenses || false,
  });
}

/** Guarda el valor propio de un día (modo variable). worked=false → "Día libre". */
export async function setWorkDay(dateStr: string, worked: boolean, amount: number): Promise<void> {
  await db.workDays.put({ date: dateStr, worked, amount: worked ? Math.max(0, Math.round(amount)) : 0 });
}

/** Vuelve un día a su valor por defecto (tarifa, o libre si es domingo). */
export async function resetWorkDay(dateStr: string): Promise<void> {
  await db.workDays.delete(dateStr);
}

export async function addDebt(debt: Omit<Debt, "id" | "settled" | "createdAt">): Promise<Debt> {
  const newDebt: Debt = {
    ...debt,
    id: `debt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    settled: false,
    createdAt: new Date().toISOString(),
  };
  await db.debts.put(newDebt);
  return newDebt;
}

export async function settleDebt(debtId: string, addToMovement: boolean, todayStr: string): Promise<void> {
  const debt = await db.debts.get(debtId);
  if (!debt || debt.settled) return;

  const settledAt = new Date().toISOString();
  await db.debts.put({
    ...debt,
    settled: true,
    settledAt,
  });

  if (addToMovement) {
    const movement: Movement = {
      id: `mov_debt_${debt.id}_${Date.now()}`,
      date: todayStr,
      amount: debt.amount,
      kind: debt.kind === "i_owe" ? "expense" : "income",
      categoryId: "otros",
      note: debt.kind === "i_owe" ? `Pago a ${debt.person}` : `Cobro a ${debt.person}`,
      source: "debt",
      debtId: debt.id,
      createdAt: settledAt,
    };
    await db.movements.put(movement);
  }
}

export async function deleteDebt(id: string): Promise<void> {
  await db.debts.delete(id);
}

export async function exportAllData(): Promise<string> {
  const settings = await getSettings();
  const movements = await db.movements.toArray();
  const recurrings = await db.recurrings.toArray();
  const installments = await db.installments.toArray();
  const workDays = await db.workDays.toArray();
  const dayLogs = await db.dayLogs.toArray();
  const debts = await db.debts.toArray();

  const exportData: DatabaseExport = {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings,
    movements,
    recurrings,
    installments,
    workDays,
    dayLogs,
    debts,
  };

  return JSON.stringify(exportData, null, 2);
}

export async function importAllData(jsonContent: string): Promise<{ success: boolean; error?: string }> {
  const result = validateBackup(jsonContent);
  if (!result.ok) return { success: false, error: result.error };
  return importValidatedBackup(result.data);
}

/** Reemplaza TODA la base con un backup ya validado (todo o nada: si algo falla, no se pierde nada). */
export async function importValidatedBackup(data: ValidBackup): Promise<{ success: boolean; error?: string }> {
  try {
    await db.transaction(
      "rw",
      [db.settings, db.movements, db.recurrings, db.installments, db.workDays, db.dayLogs, db.remindersSent, db.debts],
      async () => {
        await Promise.all([
          db.settings.clear(), db.movements.clear(), db.recurrings.clear(), db.installments.clear(),
          db.workDays.clear(), db.dayLogs.clear(), db.remindersSent.clear(), db.debts.clear(),
        ]);
        await db.settings.put(data.settings);
        await db.movements.bulkPut(data.movements);
        await db.recurrings.bulkPut(data.recurrings);
        await db.installments.bulkPut(data.installments);
        await db.workDays.bulkPut(data.workDays);
        await db.dayLogs.bulkPut(data.dayLogs);
        await db.debts.bulkPut(data.debts);
      }
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Error al guardar los datos" };
  }
}

export async function resetAllData(): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.settings,
      db.movements,
      db.recurrings,
      db.installments,
      db.workDays,
      db.dayLogs,
      db.remindersSent,
      db.debts,
    ],
    async () => {
      await db.settings.clear();
      await db.movements.clear();
      await db.recurrings.clear();
      await db.installments.clear();
      await db.workDays.clear();
      await db.dayLogs.clear();
      await db.remindersSent.clear();
      await db.debts.clear();

      await db.settings.put(DEFAULT_SETTINGS);
    }
  );
}
