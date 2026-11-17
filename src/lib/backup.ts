import { isValid, parse } from "date-fns";
import {
  Category,
  DailyRateChange,
  DayLog,
  Debt,
  Installment,
  Movement,
  Recurring,
  Settings,
  WorkDay,
  DollarMove,
} from "../types";
import { DEFAULT_SETTINGS, MAX_AMOUNT, TEXT_LIMITS } from "./constants";

export interface ValidBackup {
  version: number;
  settings: Settings;
  movements: Movement[];
  recurrings: Recurring[];
  installments: Installment[];
  workDays: WorkDay[];
  dayLogs: DayLog[];
  debts: Debt[];
  dollars: DollarMove[];
}

export type BackupResult = { ok: true; data: ValidBackup } | { ok: false; error: string };

const MAX_BYTES = 10 * 1024 * 1024;

class Invalid extends Error {}
const fail = (msg: string): never => {
  throw new Invalid(msg);
};

// ---------- validadores chicos ----------
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown, field: string, where: string, opts: { optional?: boolean; max?: number } = {}): string | undefined => {
  if (v === undefined || v === null || v === "") {
    if (opts.optional) return undefined;
    fail(`${where}: falta "${field}"`);
  }
  if (typeof v !== "string") fail(`${where}: "${field}" tiene que ser texto`);
  if ((v as string).length > (opts.max ?? 500)) fail(`${where}: "${field}" es demasiado largo`);
  return v as string;
};

const dateStr = (v: unknown, field: string, where: string, optional = false): string | undefined => {
  const s = str(v, field, where, { optional });
  if (s === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !isValid(parse(s, "yyyy-MM-dd", new Date()))) {
    fail(`${where}: "${field}" no es una fecha válida (${s}); tiene que ser AAAA-MM-DD`);
  }
  return s;
};

const amount = (v: unknown, field: string, where: string, { min = 0, max = MAX_AMOUNT } = {}): number => {
  if (typeof v !== "number" || !Number.isInteger(v)) fail(`${where}: "${field}" tiene que ser un número entero`);
  const n = v as number;
  if (n < min || n > max) fail(`${where}: "${field}" está fuera de rango (${n})`);
  return n;
};

const bool = (v: unknown, field: string, where: string, fallback?: boolean): boolean => {
  if (typeof v === "boolean") return v;
  if (v === undefined && fallback !== undefined) return fallback;
  return fail(`${where}: "${field}" tiene que ser verdadero o falso`);
};

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], field: string, where: string): T => {
  if (typeof v !== "string" || !allowed.includes(v as T)) {
    fail(`${where}: "${field}" tiene un valor desconocido (${String(v)})`);
  }
  return v as T;
};

const list = (v: unknown, field: string): Obj[] => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return fail(`"${field}" tiene que ser una lista`);
  const arr = v as unknown[];
  if (arr.length > 200000) fail(`"${field}" tiene demasiados registros`);
  return arr.map((item, i) => (isObj(item) ? item : fail(`${field}[${i}] no es un registro válido`)));
};

const uniqueIds = (items: { id?: string; date?: string; key?: string }[], field: string, keyName: "id" | "date") => {
  const seen = new Set<string>();
  for (const it of items) {
    const k = it[keyName] as string;
    if (seen.has(k)) fail(`${field}: ${keyName} repetido "${k}"`);
    seen.add(k);
  }
};

// ---------- entidades ----------
const MOVEMENT_KINDS = ["expense", "income"] as const;
const MOVEMENT_SOURCES = ["manual", "recurring", "installment", "salary", "daily", "debt"] as const;
const DEBT_KINDS = ["i_owe", "they_owe"] as const;

function movement(o: Obj, i: number): Movement {
  const where = `movimiento #${i + 1}${typeof o.id === "string" ? ` (${o.id})` : ""}`;
  return {
    id: str(o.id, "id", where, { max: 200 })!,
    date: dateStr(o.date, "date", where)!,
    amount: amount(o.amount, "amount", where),
    kind: oneOf(o.kind, MOVEMENT_KINDS, "kind", where),
    categoryId: str(o.categoryId, "categoryId", where, { max: 100 })!,
    note: str(o.note, "note", where, { optional: true, max: TEXT_LIMITS.note }),
    source: oneOf(o.source, MOVEMENT_SOURCES, "source", where),
    recurringId: str(o.recurringId, "recurringId", where, { optional: true, max: 200 }),
    installmentId: str(o.installmentId, "installmentId", where, { optional: true, max: 200 }),
    debtId: str(o.debtId, "debtId", where, { optional: true, max: 200 }),
    usdId: str(o.usdId, "usdId", where, { optional: true, max: 200 }),
    createdAt: str(o.createdAt, "createdAt", where, { optional: true, max: 40 }) ?? `${o.date}T00:00:00.000Z`,
  };
}

function recurring(o: Obj, i: number): Recurring {
  const where = `fijo #${i + 1}${typeof o.name === "string" ? ` (${o.name})` : ""}`;
  return {
    id: str(o.id, "id", where, { max: 200 })!,
    name: str(o.name, "name", where, { max: TEXT_LIMITS.name })!,
    amount: amount(o.amount, "amount", where),
    categoryId: str(o.categoryId, "categoryId", where, { max: 100 })!,
    dueDay: amount(o.dueDay, "dueDay", where, { min: 1, max: 31 }),
    autoAdd: bool(o.autoAdd, "autoAdd", where, true),
    active: bool(o.active, "active", where, true),
    lastAppliedDate: dateStr(o.lastAppliedDate, "lastAppliedDate", where, true),
    createdAt: dateStr(o.createdAt, "createdAt", where, true),
  };
}

function installment(o: Obj, i: number): Installment {
  const where = `cuota #${i + 1}${typeof o.name === "string" ? ` (${o.name})` : ""}`;
  const count = amount(o.installmentsCount, "installmentsCount", where, { min: 1, max: 600 });
  return {
    id: str(o.id, "id", where, { max: 200 })!,
    name: str(o.name, "name", where, { max: TEXT_LIMITS.name })!,
    totalAmount: amount(o.totalAmount, "totalAmount", where),
    installmentsCount: count,
    installmentAmount: amount(o.installmentAmount, "installmentAmount", where),
    firstDueDate: dateStr(o.firstDueDate, "firstDueDate", where)!,
    paidCount: amount(o.paidCount, "paidCount", where, { min: 0, max: count }),
    categoryId: str(o.categoryId, "categoryId", where, { max: 100 })!,
    autoAdd: bool(o.autoAdd, "autoAdd", where, true),
    active: bool(o.active, "active", where, true),
    lastAppliedDate: dateStr(o.lastAppliedDate, "lastAppliedDate", where, true),
  };
}

function workDay(o: Obj, i: number): WorkDay {
  const where = `día trabajado #${i + 1}`;
  return {
    date: dateStr(o.date, "date", where)!,
    worked: bool(o.worked, "worked", where),
    amount: amount(o.amount ?? 0, "amount", where),
  };
}

function dayLog(o: Obj, i: number): DayLog {
  const where = `día anotado #${i + 1}`;
  return {
    date: dateStr(o.date, "date", where)!,
    logged: bool(o.logged, "logged", where, true),
    noExpenses: bool(o.noExpenses, "noExpenses", where, false),
  };
}

function debt(o: Obj, i: number): Debt {
  const where = `deuda #${i + 1}${typeof o.person === "string" ? ` (${o.person})` : ""}`;
  return {
    id: str(o.id, "id", where, { max: 200 })!,
    kind: oneOf(o.kind, DEBT_KINDS, "kind", where),
    person: str(o.person, "person", where, { max: TEXT_LIMITS.name })!,
    amount: amount(o.amount, "amount", where),
    currency: o.currency === undefined ? undefined : oneOf(o.currency, ["ARS", "USD"] as const, "currency", where),
    rate: o.rate === undefined || o.rate === null ? undefined : amount(o.rate, "rate", where, { min: 1, max: 10_000_000 }),
    rateDate: dateStr(o.rateDate, "rateDate", where, true),
    rateType: o.rateType === undefined ? undefined : oneOf(o.rateType, ["oficial", "blue", "bolsa"] as const, "rateType", where),
    payments:
      o.payments === undefined
        ? undefined
        : list(o.payments, `${where}.payments`).map((p, j) => {
            const w = `${where}, pago #${j + 1}`;
            return { id: str(p.id, "id", w, { max: 200 })!, amount: amount(p.amount, "amount", w, { min: 1 }), date: dateStr(p.date, "date", w)! };
          }),
    dueDate: dateStr(o.dueDate, "dueDate", where, true),
    note: str(o.note, "note", where, { optional: true, max: TEXT_LIMITS.note }),
    settled: bool(o.settled, "settled", where, false),
    settledAt: str(o.settledAt, "settledAt", where, { optional: true, max: 40 }),
    createdAt: str(o.createdAt, "createdAt", where, { optional: true, max: 40 }) ?? new Date().toISOString(),
  };
}

function dollarMove(o: Obj, i: number): DollarMove {
  const where = `dólares #${i + 1}`;
  return {
    id: str(o.id, "id", where, { max: 200 })!,
    date: dateStr(o.date, "date", where)!,
    amount: amount(o.amount, "amount", where, { min: 1 }),
    kind: oneOf(o.kind, ["in", "out"] as const, "kind", where),
    note: str(o.note, "note", where, { optional: true, max: TEXT_LIMITS.note }),
    source: oneOf(o.source, ["manual", "buy", "sell"] as const, "source", where),
    rate: o.rate === undefined || o.rate === null ? undefined : amount(o.rate, "rate", where, { min: 1, max: 10_000_000 }),
    pesos: o.pesos === undefined || o.pesos === null ? undefined : amount(o.pesos, "pesos", where),
    movementId: str(o.movementId, "movementId", where, { optional: true, max: 200 }),
    createdAt: str(o.createdAt, "createdAt", where, { optional: true, max: 40 }) ?? new Date().toISOString(),
  };
}

function category(o: Obj, i: number): Category {
  const where = `categoría #${i + 1}`;
  const color = str(o.color, "color", where, { max: 20 })!;
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) fail(`${where}: "color" tiene que ser #RRGGBB`);
  return {
    id: str(o.id, "id", where, { max: 100 })!,
    name: str(o.name, "name", where, { max: TEXT_LIMITS.category })!,
    icon: str(o.icon, "icon", where, { optional: true, max: 60 }) ?? "Tag",
    color,
    limit: o.limit === undefined || o.limit === null || o.limit === 0 ? undefined : amount(o.limit, "limit", where),
  };
}

function rateChange(o: Obj, i: number): DailyRateChange {
  const where = `cambio de tarifa #${i + 1}`;
  return {
    fromDate: dateStr(o.fromDate, "fromDate", where)!,
    rate: amount(o.rate, "rate", where),
  };
}

function settings(raw: unknown): Settings {
  if (!isObj(raw)) fail('Falta la sección "settings" (ajustes)');
  const o = raw as Obj;
  const where = "ajustes";
  const d = DEFAULT_SETTINGS;
  const pick = <T>(v: unknown, fallback: T, check: (x: unknown) => T): T => (v === undefined ? fallback : check(v));

  const cats = o.categories === undefined ? d.categories : list(o.categories, "categories").map(category);
  if (cats.length === 0) fail(`${where}: tiene que haber al menos una categoría`);

  const prev = o.dailyPreviousRange;
  const dailyPreviousRange = isObj(prev)
    ? { startDate: dateStr(prev.startDate, "dailyPreviousRange.startDate", where)!, endDate: dateStr(prev.endDate, "dailyPreviousRange.endDate", where)! }
    : undefined;

  return {
    id: "main",
    currency: "ARS",
    incomeMode: pick(o.incomeMode, d.incomeMode, (v) => oneOf(v, ["salary", "daily"] as const, "incomeMode", where)),
    fixedSalary: pick(o.fixedSalary, d.fixedSalary, (v) => amount(v, "fixedSalary", where)),
    payday: pick(o.payday, d.payday, (v) => amount(v, "payday", where, { min: 1, max: 31 })),
    dailyRate: pick(o.dailyRate, d.dailyRate, (v) => amount(v, "dailyRate", where)),
    dailyRateChanges: o.dailyRateChanges === undefined ? [] : list(o.dailyRateChanges, "dailyRateChanges").map(rateChange),
    dailyRangeStart: dateStr(o.dailyRangeStart, "dailyRangeStart", where, true),
    dailyRangeEnd: dateStr(o.dailyRangeEnd, "dailyRangeEnd", where, true),
    dailyPreviousRange,
    reminderTime: pick(o.reminderTime, d.reminderTime, (v) => {
      const s = str(v, "reminderTime", where, { max: 5 })!;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) fail(`${where}: "reminderTime" tiene que ser HH:MM`);
      return s;
    }),
    reminderEnabled: bool(o.reminderEnabled, "reminderEnabled", where, d.reminderEnabled),
    dueAlertDays: pick(o.dueAlertDays, d.dueAlertDays, (v) => amount(v, "dueAlertDays", where, { min: 0, max: 60 })),
    theme: pick(o.theme, d.theme, (v) => oneOf(v, ["dark", "light"] as const, "theme", where)),
    categories: cats,
    onboardingDone: bool(o.onboardingDone, "onboardingDone", where, true),
    closeToTray: bool(o.closeToTray, "closeToTray", where, d.closeToTray),
    autostart: bool(o.autostart, "autostart", where, d.autostart),
    windowZoom: pick(o.windowZoom, d.windowZoom, (v) => oneOf(v, ["auto", "small", "medium", "large"] as const, "windowZoom", where)),
    createdAt: str(o.createdAt, "createdAt", where, { optional: true, max: 40 }) ?? d.createdAt,
    hideAmounts: bool(o.hideAmounts, "hideAmounts", where, d.hideAmounts),
    startHidden: bool(o.startHidden, "startHidden", where, d.startHidden),
    tutorialDone: bool(o.tutorialDone, "tutorialDone", where, true),
    usdQuote: isObj(o.usdQuote)
      ? {
          rate: amount(o.usdQuote.rate, "usdQuote.rate", where, { min: 1, max: 10_000_000 }),
          date: dateStr(o.usdQuote.date, "usdQuote.date", where)!,
          type: oneOf(o.usdQuote.type, ["oficial", "blue", "bolsa"] as const, "usdQuote.type", where),
        }
      : undefined,
    useDollars: bool(o.useDollars, "useDollars", where, d.useDollars),
    dollarType: pick(o.dollarType, d.dollarType, (v) => oneOf(v, ["oficial", "blue", "bolsa"] as const, "dollarType", where)),
    savingsMode: pick(o.savingsMode, d.savingsMode, (v) => oneOf(v, ["percent", "amount"] as const, "savingsMode", where)),
    savingsValue: pick(o.savingsValue, d.savingsValue, (v) => amount(v, "savingsValue", where)),
    lastSeenVersion: str(o.lastSeenVersion, "lastSeenVersion", where, { optional: true, max: 20 }),
    lastBackupAt: str(o.lastBackupAt, "lastBackupAt", where, { optional: true, max: 40 }),
  };
}

// ---------- API ----------
/** Valida un backup JSON completo. Si algo está mal, dice exactamente qué registro falló. */
export function validateBackup(jsonContent: string): BackupResult {
  try {
    if (jsonContent.length > MAX_BYTES) fail("El archivo es demasiado grande (máximo 10 MB)");
    let raw: unknown;
    try {
      raw = JSON.parse(jsonContent);
    } catch {
      fail("El archivo no tiene un formato JSON válido");
    }
    if (!isObj(raw)) fail("El archivo no parece una copia de seguridad de Bolsillo");
    const o = raw as Obj;

    const version = typeof o.version === "number" ? o.version : 1;
    if (![1, 2].includes(version)) fail(`Versión de backup desconocida (${version})`);
    if (!isObj(o.settings) || !Array.isArray(o.movements)) {
      fail("Estructura de copia de seguridad no válida (faltan ajustes o movimientos)");
    }

    const movements = list(o.movements, "movements").map(movement);
    const recurrings = list(o.recurrings, "recurrings").map(recurring);
    const installments = list(o.installments, "installments").map(installment);
    const workDays = list(o.workDays, "workDays").map(workDay);
    const dayLogs = list(o.dayLogs, "dayLogs").map(dayLog);
    const debts = list(o.debts, "debts").map(debt);
    const dollars = list(o.dollars, "dollars").map(dollarMove);
    uniqueIds(dollars, "dólares", "id");

    uniqueIds(movements, "movimientos", "id");
    uniqueIds(recurrings, "fijos", "id");
    uniqueIds(installments, "cuotas", "id");
    uniqueIds(debts, "deudas", "id");
    uniqueIds(workDays, "días trabajados", "date");
    uniqueIds(dayLogs, "días anotados", "date");

    return {
      ok: true,
      data: { version, settings: settings(o.settings), movements, recurrings, installments, workDays, dayLogs, debts, dollars },
    };
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, error: err.message };
    return { ok: false, error: "Error inesperado al leer el archivo" };
  }
}

/** Texto corto para el cartel de confirmación: "320 movimientos, 4 fijos, …" */
export function summarizeBackup(d: ValidBackup): string {
  const n = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`;
  return [
    n(d.movements.length, "movimiento", "movimientos"),
    n(d.recurrings.length, "fijo", "fijos"),
    n(d.installments.length, "cuota", "cuotas"),
    n(d.debts.length, "deuda", "deudas"),
    ...(d.dollars.length ? [n(d.dollars.length, "movimiento en dólares", "movimientos en dólares")] : []),
    n(d.workDays.length, "día trabajado editado", "días trabajados editados"),
  ].join(", ");
}
