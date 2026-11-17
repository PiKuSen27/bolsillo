import { store, applyAtomically, DATA_TABLES, wipeEverything } from "./store";
import {
  DayLog,
  Debt,
  DollarMove,
  Installment,
  Movement,
  Recurring,
  Settings,
  WorkDay,
} from "../types";
import { DEFAULT_SETTINGS } from "../lib/constants";
import { validateBackup, ValidBackup } from "../lib/backup";
import { debtArs, debtUnitsToArs } from "../lib/dollars";
import { applyPayment } from "../lib/debts";
import { getInstallmentAmount } from "../lib/recurring";

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
  dollars?: DollarMove[];
}

export async function getSettings(): Promise<Settings> {
  const current = await store.settings.get("main");
  if (!current) {
    const fresh = { ...DEFAULT_SETTINGS, createdAt: new Date().toISOString() };
    await store.settings.put(fresh);
    return fresh;
  }
  // Campos nuevos que una versión vieja no tenía (y que una migración no puede agregar a un registro cifrado)
  return { ...DEFAULT_SETTINGS, ...current };
}

export async function updateSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated: Settings = { ...current, ...partial };
  await store.settings.put(updated);
  return updated;
}

export async function markDayAsNoExpenses(dateStr: string): Promise<void> {
  await store.dayLogs.put({
    date: dateStr,
    logged: true,
    noExpenses: true,
  });
}

export async function markDayAsLogged(dateStr: string): Promise<void> {
  const existing = await store.dayLogs.get(dateStr);
  await store.dayLogs.put({
    date: dateStr,
    logged: true,
    noExpenses: existing?.noExpenses || false,
  });
}

/** Guarda el valor propio de un día (modo variable). worked=false → "Día libre". */
export async function setWorkDay(dateStr: string, worked: boolean, amount: number): Promise<void> {
  await store.workDays.put({ date: dateStr, worked, amount: worked ? Math.max(0, Math.round(amount)) : 0 });
}

/** Vuelve un día a su valor por defecto (tarifa, o libre si es domingo). */
export async function resetWorkDay(dateStr: string): Promise<void> {
  await store.workDays.delete(dateStr);
}

export async function addDebt(debt: Omit<Debt, "id" | "settled" | "createdAt">): Promise<Debt> {
  const newDebt: Debt = {
    ...debt,
    id: `debt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    settled: false,
    createdAt: new Date().toISOString(),
  };
  await store.debts.put(newDebt);
  return newDebt;
}

/**
 * Salda varias deudas de una vez (todo o nada). Si addToMovement, anota un movimiento por cada una.
 * Devuelve una función para deshacer: las deudas vuelven a como estaban y se borran los movimientos creados.
 */
export async function settleDebts(
  debtIds: string[],
  addToMovement: boolean,
  todayStr: string
): Promise<() => Promise<void>> {
  const before: Debt[] = [];
  const settled: Debt[] = [];
  const created: Movement[] = [];
  const settledAt = new Date().toISOString();
  for (const debt of await store.debts.bulkGet(debtIds)) {
    if (!debt || debt.settled) continue;
    before.push(debt);
    settled.push({ ...debt, settled: true, settledAt });
    if (addToMovement) {
      created.push({
        id: `mov_debt_${debt.id}_${Date.now()}`,
        date: todayStr,
        amount: debtArs(debt), // en pesos (dólares × cotización guardada)
        kind: debt.kind === "i_owe" ? "expense" : "income",
        categoryId: "otros",
        note: debt.kind === "i_owe" ? `Pago a ${debt.person}` : `Cobro a ${debt.person}`,
        source: "debt",
        debtId: debt.id,
        createdAt: settledAt,
      });
    }
  }
  await applyAtomically([
    { type: "put", table: "debts", recs: settled },
    { type: "put", table: "movements", recs: created },
  ]);
  return async () => {
    await applyAtomically([
      { type: "put", table: "debts", recs: before },
      { type: "delete", table: "movements", keys: created.map((m) => m.id) },
    ]);
  };
}

/**
 * Pago parcial de una deuda (en su moneda). Si addToMovement, anota el movimiento en pesos
 * (dólares × cotización guardada). Devuelve la función para deshacer.
 */
export async function registerDebtPayment(
  debtId: string,
  amount: number,
  date: string,
  addToMovement: boolean
): Promise<() => Promise<void>> {
  const before = await store.debts.get(debtId);
  if (!before) throw new Error("No se encontró la deuda");
  const after = applyPayment(before, Math.round(amount), date, `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const movement: Movement | null = addToMovement
    ? {
        id: `mov_debtpay_${before.id}_${Date.now()}`,
        date,
        amount: debtUnitsToArs(before, Math.round(amount)),
        kind: before.kind === "i_owe" ? "expense" : "income",
        categoryId: before.kind === "i_owe" ? "otros" : "income",
        note: before.kind === "i_owe" ? `Pago parcial a ${before.person}` : `Cobro parcial a ${before.person}`,
        source: "debt",
        debtId: before.id,
        createdAt: new Date().toISOString(),
      }
    : null;
  await applyAtomically([
    { type: "put", table: "debts", recs: [after] },
    { type: "put", table: "movements", recs: movement ? [movement] : [] },
  ]);
  return async () => {
    await applyAtomically([
      { type: "put", table: "debts", recs: [before] },
      { type: "delete", table: "movements", keys: movement ? [movement.id] : [] },
    ]);
  };
}

/** Cobros automáticos de fijos y cuotas: gastos y fijos/cuotas actualizados se guardan todo o nada. */
export async function saveAutoCharges(r: { movementsToAdd: Movement[]; updatedRecurrings: Recurring[]; updatedInstallments: Installment[] }) {
  await applyAtomically([
    { type: "put", table: "movements", recs: r.movementsToAdd },
    { type: "put", table: "recurrings", recs: r.updatedRecurrings },
    { type: "put", table: "installments", recs: r.updatedInstallments },
  ]);
}

/** Pago manual de la próxima cuota: gasto y cuota juntos (todo o nada). Devuelve la función para deshacer. */
export async function payInstallment(inst: Installment, todayStr: string): Promise<() => Promise<void>> {
  if (inst.paidCount >= inst.installmentsCount) return async () => {};
  const nextPaid = inst.paidCount + 1;
  const movement: Movement = {
    id: `mov_inst_${inst.id}_${nextPaid}_${Date.now()}`,
    date: todayStr,
    amount: getInstallmentAmount(inst, nextPaid),
    kind: "expense",
    categoryId: inst.categoryId,
    note: `${inst.name} (Cuota ${nextPaid}/${inst.installmentsCount})`,
    source: "installment",
    installmentId: inst.id,
    createdAt: new Date().toISOString(),
  };
  await applyAtomically([
    { type: "put", table: "movements", recs: [movement] },
    { type: "put", table: "installments", recs: [{ ...inst, paidCount: nextPaid, active: nextPaid < inst.installmentsCount }] },
  ]);
  return () =>
    applyAtomically([
      { type: "delete", table: "movements", keys: [movement.id] },
      { type: "put", table: "installments", recs: [inst] },
    ]);
}

export async function deleteDebt(id: string): Promise<void> {
  await store.debts.delete(id);
}

export async function exportAllData(): Promise<string> {
  const settings = await getSettings();
  const movements = await store.movements.toArray();
  const recurrings = await store.recurrings.toArray();
  const installments = await store.installments.toArray();
  const workDays = await store.workDays.toArray();
  const dayLogs = await store.dayLogs.toArray();
  const debts = await store.debts.toArray();
  const dollars = await store.dollars.toArray();

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
    dollars,
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
    await applyAtomically([
      ...DATA_TABLES.map((table) => ({ type: "clear" as const, table })),
      { type: "put", table: "settings", recs: [data.settings] },
      { type: "put", table: "movements", recs: data.movements },
      { type: "put", table: "recurrings", recs: data.recurrings },
      { type: "put", table: "installments", recs: data.installments },
      { type: "put", table: "workDays", recs: data.workDays },
      { type: "put", table: "dayLogs", recs: data.dayLogs },
      { type: "put", table: "debts", recs: data.debts },
      { type: "put", table: "dollars", recs: data.dollars },
    ]);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Error al guardar los datos" };
  }
}

/** "Borrar todos los datos": también apaga el cifrado y vuelve a los ajustes por defecto. */
export async function resetAllData(): Promise<void> {
  await wipeEverything();
  await store.settings.put({ ...DEFAULT_SETTINGS, createdAt: new Date().toISOString() });
}
