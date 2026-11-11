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

export async function toggleWorkDay(
  dateStr: string,
  worked: boolean,
  dailyRate?: number
): Promise<void> {
  let amount = dailyRate;
  if (amount === undefined) {
    const s = await getSettings();
    amount = s.dailyRate;
  }
  await db.workDays.put({
    date: dateStr,
    worked,
    amount: worked ? amount : 0,
  });
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
  try {
    const data = JSON.parse(jsonContent);

    if (!data || typeof data !== "object") {
      return { success: false, error: "El archivo no tiene un formato JSON válido" };
    }

    if (!data.settings || !Array.isArray(data.movements)) {
      return {
        success: false,
        error: "Estructura de copia de seguridad no válida (faltan ajustes o movimientos)",
      };
    }

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

        await db.settings.put(data.settings);
        if (data.movements?.length) await db.movements.bulkPut(data.movements);
        if (data.recurrings?.length) await db.recurrings.bulkPut(data.recurrings);
        if (data.installments?.length) await db.installments.bulkPut(data.installments);
        if (data.workDays?.length) await db.workDays.bulkPut(data.workDays);
        if (data.dayLogs?.length) await db.dayLogs.bulkPut(data.dayLogs);
        if (data.debts?.length) await db.debts.bulkPut(data.debts);
      }
    );

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al procesar el archivo JSON",
    };
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
