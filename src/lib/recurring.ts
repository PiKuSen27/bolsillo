import { addMonths, differenceInCalendarDays } from "date-fns";
import {
  Installment,
  Movement,
  Recurring,
  UpcomingItem,
} from "../types";
import { clampDateToMonth } from "./period";
import { formatLocalDate, parseLocalDate } from "./format";

export interface RecurringApplicationResult {
  movementsToAdd: Movement[];
  updatedRecurrings: Recurring[];
  updatedInstallments: Installment[];
  completedInstallments: Installment[];
}

/**
 * Calculates the next due date for a monthly recurring rule relative to a reference date.
 */
export function getNextMonthlyDueDate(dueDay: number, refDate: Date = new Date()): Date {
  const currentMonthDue = clampDateToMonth(
    refDate.getFullYear(),
    refDate.getMonth(),
    dueDay
  );

  if (refDate.getTime() <= currentMonthDue.getTime()) {
    return currentMonthDue;
  }

  // Next month
  const nextMonthIndex = refDate.getMonth() + 1;
  const nextMonthYear = refDate.getFullYear() + Math.floor(nextMonthIndex / 12);
  const normalizedMonth = (nextMonthIndex % 12 + 12) % 12;
  return clampDateToMonth(nextMonthYear, normalizedMonth, dueDay);
}

/** Monto de la cuota n (1-based). La última absorbe el redondeo para que la suma dé el total exacto. */
export function getInstallmentAmount(inst: Installment, n: number): number {
  if (n >= inst.installmentsCount) {
    return inst.totalAmount - inst.installmentAmount * (inst.installmentsCount - 1);
  }
  return inst.installmentAmount;
}

/**
 * Calculates next due date for an installment item
 */
export function getNextInstallmentDueDate(inst: Installment): Date | null {
  if (!inst.active || inst.paidCount >= inst.installmentsCount) return null;
  const firstDate = parseLocalDate(inst.firstDueDate);
  // nth installment is firstDate + paidCount months
  return addMonths(firstDate, inst.paidCount);
}

/**
 * Computes upcoming items for the widget/column sorted by nearest due date.
 */
export function getUpcomingItems(params: {
  recurrings: Recurring[];
  installments: Installment[];
  refDateInput?: string | Date;
}): UpcomingItem[] {
  const refDate =
    typeof params.refDateInput === "string"
      ? parseLocalDate(params.refDateInput)
      : params.refDateInput || new Date();

  const refDayOnly = new Date(
    refDate.getFullYear(),
    refDate.getMonth(),
    refDate.getDate()
  );

  const items: UpcomingItem[] = [];

  // Active recurring
  for (const rec of params.recurrings) {
    if (!rec.active) continue;
    const nextDue = getNextMonthlyDueDate(rec.dueDay, refDayOnly);
    const daysUntil = differenceInCalendarDays(nextDue, refDayOnly);

    items.push({
      id: rec.id,
      type: "recurring",
      name: rec.name,
      amount: rec.amount,
      dueDate: formatLocalDate(nextDue),
      daysUntil,
      categoryId: rec.categoryId,
      autoAdd: rec.autoAdd,
      active: rec.active,
    });
  }

  // Active installments
  for (const inst of params.installments) {
    if (!inst.active || inst.paidCount >= inst.installmentsCount) continue;
    const nextDue = getNextInstallmentDueDate(inst);
    if (!nextDue) continue;

    const daysUntil = differenceInCalendarDays(nextDue, refDayOnly);
    items.push({
      id: inst.id,
      type: "installment",
      name: inst.name,
      amount: getInstallmentAmount(inst, inst.paidCount + 1),
      dueDate: formatLocalDate(nextDue),
      daysUntil,
      categoryId: inst.categoryId,
      progressText: `Cuota ${inst.paidCount + 1}/${inst.installmentsCount}`,
      autoAdd: inst.autoAdd,
      active: inst.active,
    });
  }

  // Sort ascending by daysUntil (nearest first)
  items.sort((a, b) => a.daysUntil - b.daysUntil);
  return items;
}

/**
 * Checks recurring and installments with autoAdd and produces new movements to apply.
 * Prevents duplicates by checking existing movements and lastAppliedDate.
 */
export function processAutoAddRules(params: {
  recurrings: Recurring[];
  installments: Installment[];
  existingMovements: Movement[];
  todayStr: string;
}): RecurringApplicationResult {
  const { recurrings, installments, existingMovements, todayStr } = params;
  const today = parseLocalDate(todayStr);

  const movementsToAdd: Movement[] = [];
  const updatedRecurrings: Recurring[] = [];
  const updatedInstallments: Installment[] = [];
  const completedInstallments: Installment[] = [];

  // Existing movements set by key "recurringId_date" or "installmentId_date"
  const existingSet = new Set<string>();
  for (const m of existingMovements) {
    if (m.recurringId) existingSet.add(`rec_${m.recurringId}_${m.date}`);
    if (m.installmentId) existingSet.add(`inst_${m.installmentId}_${m.date}`);
  }

  // 1. Process Recurrings
  for (const rec of recurrings) {
    if (!rec.active || !rec.autoAdd) continue;

    let updatedRec = { ...rec };
    let hasChanged = false;

    // Desde el mes siguiente al último cobro; si nunca se cobró, desde el mes en que se creó
    // (si la app estuvo cerrada desde entonces, los meses atrasados se cobran igual)
    const firstMonth = parseLocalDate(rec.createdAt ?? todayStr);
    const startCheckDate = rec.lastAppliedDate
      ? addMonths(parseLocalDate(rec.lastAppliedDate), 1)
      : new Date(firstMonth.getFullYear(), firstMonth.getMonth(), 1);

    // Iterating months up to today's month
    let curYear = startCheckDate.getFullYear();
    let curMonth = startCheckDate.getMonth();
    const endYear = today.getFullYear();
    const endMonth = today.getMonth();

    while (
      curYear < endYear ||
      (curYear === endYear && curMonth <= endMonth)
    ) {
      const dueDate = clampDateToMonth(curYear, curMonth, rec.dueDay);
      const dueDateStr = formatLocalDate(dueDate);

      // Un fijo creado después de su vencimiento arranca recién el mes siguiente (bug #8)
      const beforeCreation = rec.createdAt ? dueDateStr < rec.createdAt : false;
      if (dueDate.getTime() <= today.getTime() && !beforeCreation) {
        const key = `rec_${rec.id}_${dueDateStr}`;
        if (!existingSet.has(key)) {
          movementsToAdd.push({
            id: `rec_${rec.id}_${dueDateStr}`,
            date: dueDateStr,
            amount: rec.amount,
            kind: "expense",
            categoryId: rec.categoryId,
            note: `${rec.name} (Suscripción/Fijo)`,
            source: "recurring",
            recurringId: rec.id,
            createdAt: new Date().toISOString(),
          });
          existingSet.add(key);
          updatedRec.lastAppliedDate = dueDateStr;
          hasChanged = true;
        }
      }

      curMonth++;
      if (curMonth > 11) {
        curMonth = 0;
        curYear++;
      }
    }

    if (hasChanged) {
      updatedRecurrings.push(updatedRec);
    }
  }

  // 2. Process Installments
  for (const inst of installments) {
    if (!inst.active || !inst.autoAdd || inst.paidCount >= inst.installmentsCount) {
      continue;
    }

    let updatedInst = { ...inst };
    let hasChanged = false;
    const firstDate = parseLocalDate(inst.firstDueDate);

    while (updatedInst.paidCount < updatedInst.installmentsCount) {
      const nthDueDate = addMonths(firstDate, updatedInst.paidCount);
      const dueDateStr = formatLocalDate(nthDueDate);

      if (nthDueDate.getTime() <= today.getTime()) {
        const key = `inst_${inst.id}_${dueDateStr}`;
        if (!existingSet.has(key)) {
          movementsToAdd.push({
            id: `inst_${inst.id}_${dueDateStr}_${updatedInst.paidCount + 1}`,
            date: dueDateStr,
            amount: getInstallmentAmount(inst, updatedInst.paidCount + 1),
            kind: "expense",
            categoryId: inst.categoryId,
            note: `${inst.name} (Cuota ${updatedInst.paidCount + 1}/${inst.installmentsCount})`,
            source: "installment",
            installmentId: inst.id,
            createdAt: new Date().toISOString(),
          });
          existingSet.add(key);
        }

        updatedInst.paidCount += 1;
        updatedInst.lastAppliedDate = dueDateStr;
        hasChanged = true;

        if (updatedInst.paidCount >= updatedInst.installmentsCount) {
          updatedInst.active = false;
          completedInstallments.push(updatedInst);
          break;
        }
      } else {
        // Future installment, stop
        break;
      }
    }

    if (hasChanged) {
      updatedInstallments.push(updatedInst);
    }
  }

  return {
    movementsToAdd,
    updatedRecurrings,
    updatedInstallments,
    completedInstallments,
  };
}
