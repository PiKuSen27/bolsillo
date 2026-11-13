import { db } from "./db";
import { DayLog, Debt, Installment, Movement, Recurring, ReminderSent, Settings, WorkDay } from "../types";
import {
  VaultKeys,
  VaultMeta,
  VaultPrefs,
  WIPE_AFTER_ATTEMPTS,
  WrongSecretError,
  changePassword as changeVaultPassword,
  createVault,
  decryptRecord,
  encryptRecord,
  lockoutDelayMs,
  recoverWithCode,
  storedKeyFor,
  unlockWithPassword,
} from "../lib/vault";

/**
 * Única puerta a la base de datos. Si el cifrado está activo:
 *  - cada registro se guarda como { <clave primaria disfrazada con HMAC>, enc: <AES-GCM> }
 *  - el cifrado y descifrado ocurren FUERA de las transacciones de IndexedDB (Web Crypto es asíncrono y
 *    una transacción se cierra sola si espera otra cosa); las escrituras de varios registros se preparan
 *    primero y después se aplican en una sola transacción: todo o nada.
 * Las claves solo viven en esta variable mientras la app está desbloqueada.
 */
let keys: VaultKeys | null = null;
let meta: VaultMeta | null = null;
let metaLoaded = false;

export class LockedError extends Error {
  constructor() {
    super("Bolsillo está bloqueado");
    this.name = "LockedError";
  }
}

export type TableName =
  | "settings"
  | "movements"
  | "recurrings"
  | "installments"
  | "workDays"
  | "dayLogs"
  | "debts"
  | "remindersSent";

const PK: Record<TableName, string> = {
  settings: "id",
  movements: "id",
  recurrings: "id",
  installments: "id",
  workDays: "date",
  dayLogs: "date",
  debts: "id",
  remindersSent: "key",
};
export const DATA_TABLES = Object.keys(PK) as TableName[];

// ---------- estado de la caja fuerte ----------
export async function loadVaultMeta(): Promise<VaultMeta | null> {
  meta = (await db.vault.get("main")) ?? null;
  metaLoaded = true;
  return meta;
}
export const isVaultEnabled = () => !!meta;
export const isUnlocked = () => !meta || !!keys;
export const getVaultPrefs = (): VaultPrefs | null => meta?.prefs ?? null;
export const getLockState = () => ({ failedAttempts: meta?.failedAttempts ?? 0, lockoutUntil: meta?.lockoutUntil ?? 0 });

async function ready(): Promise<VaultKeys | null> {
  if (!metaLoaded) await loadVaultMeta();
  if (!meta) return null;
  if (!keys) throw new LockedError();
  return keys;
}

// ---------- codificar / decodificar registros ----------
type Row = Record<string, unknown>;

async function encodeWith(k: VaultKeys | null, table: TableName, rec: Row): Promise<Row> {
  if (!k) return rec;
  const sk = await storedKeyFor(k, table, String(rec[PK[table]]));
  return { [PK[table]]: sk, enc: await encryptRecord(k, table, sk, rec) };
}

async function decodeWith<T>(k: VaultKeys | null, table: TableName, row: Row): Promise<T> {
  if (typeof row.enc !== "string") return row as T;
  if (!k) throw new LockedError();
  return decryptRecord<T>(k, table, String(row[PK[table]]), row.enc);
}

async function keyWith(k: VaultKeys | null, table: TableName, realKey: string): Promise<string> {
  return k ? storedKeyFor(k, table, realKey) : realKey;
}

class SecureTable<T> {
  constructor(private name: TableName) {}
  private get raw() {
    return db.table(this.name);
  }
  async toArray(): Promise<T[]> {
    const k = await ready();
    const rows = await this.raw.toArray();
    return Promise.all(rows.map((r) => decodeWith<T>(k, this.name, r)));
  }
  async get(key: string): Promise<T | undefined> {
    const k = await ready();
    const row = await this.raw.get(await keyWith(k, this.name, key));
    return row ? decodeWith<T>(k, this.name, row) : undefined;
  }
  async bulkGet(keys: string[]): Promise<(T | undefined)[]> {
    const k = await ready();
    const rows = await this.raw.bulkGet(await Promise.all(keys.map((x) => keyWith(k, this.name, x))));
    return Promise.all(rows.map((r) => (r ? decodeWith<T>(k, this.name, r) : undefined)));
  }
  async put(rec: T): Promise<void> {
    const k = await ready();
    await this.raw.put(await encodeWith(k, this.name, rec as Row));
  }
  async bulkPut(recs: T[]): Promise<void> {
    const k = await ready();
    await this.raw.bulkPut(await Promise.all(recs.map((r) => encodeWith(k, this.name, r as Row))));
  }
  async delete(key: string): Promise<void> {
    const k = await ready();
    await this.raw.delete(await keyWith(k, this.name, key));
  }
}

export const store = {
  settings: new SecureTable<Settings>("settings"),
  movements: new SecureTable<Movement>("movements"),
  recurrings: new SecureTable<Recurring>("recurrings"),
  installments: new SecureTable<Installment>("installments"),
  workDays: new SecureTable<WorkDay>("workDays"),
  dayLogs: new SecureTable<DayLog>("dayLogs"),
  debts: new SecureTable<Debt>("debts"),
  remindersSent: new SecureTable<ReminderSent>("remindersSent"),
};

export type Op =
  | { type: "put"; table: TableName; recs: unknown[] }
  | { type: "delete"; table: TableName; keys: string[] }
  | { type: "clear"; table: TableName };

/** Aplica varias escrituras de una vez: primero cifra todo, después una sola transacción (todo o nada). */
export async function applyAtomically(ops: Op[]): Promise<void> {
  const k = await ready();
  const encoded = await Promise.all(
    ops.map(async (op) =>
      op.type === "put"
        ? { ...op, rows: await Promise.all(op.recs.map((r) => encodeWith(k, op.table, r as Row))) }
        : op.type === "delete"
        ? { ...op, rawKeys: await Promise.all(op.keys.map((x) => keyWith(k, op.table, x))) }
        : op
    )
  );
  const tables = [...new Set(ops.map((o) => o.table))].map((t) => db.table(t));
  await db.transaction("rw", tables, async () => {
    for (const op of encoded) {
      const t = db.table(op.table);
      if (op.type === "clear") await t.clear();
      else if (op.type === "put") await t.bulkPut((op as { rows: Row[] }).rows);
      else await t.bulkDelete((op as { rawKeys: string[] }).rawKeys);
    }
  });
}

// ---------- activar / desactivar ----------
async function readAllRaw(): Promise<Record<TableName, Row[]>> {
  const out = {} as Record<TableName, Row[]>;
  for (const t of DATA_TABLES) out[t] = await db.table(t).toArray();
  return out;
}

async function decodeAll(k: VaultKeys | null, raw: Record<TableName, Row[]>): Promise<Record<TableName, Row[]>> {
  const out = {} as Record<TableName, Row[]>;
  for (const t of DATA_TABLES) out[t] = await Promise.all(raw[t].map((r) => decodeWith<Row>(k, t, r)));
  return out;
}

const sortByKey = (t: TableName, rows: Row[]) => [...rows].sort((a, b) => String(a[PK[t]]).localeCompare(String(b[PK[t]])));
const sameData = (a: Record<TableName, Row[]>, b: Record<TableName, Row[]>) =>
  DATA_TABLES.every((t) => JSON.stringify(sortByKey(t, a[t])) === JSON.stringify(sortByKey(t, b[t])));

/**
 * Activa el cifrado sobre los datos que ya hay. Copia de seguridad: los datos en claro quedan en memoria
 * (no se escriben a disco para no dejar una copia sin cifrar). Todo se cifra antes; se escribe en una
 * transacción; después se relee y se compara. Si algo no coincide, se restaura la copia y no se pierde nada.
 */
export async function enableEncryption(password: string, recoveryCode: string, prefs: VaultPrefs): Promise<void> {
  if (await loadVaultMeta()) throw new Error("El cifrado ya está activo");
  const plain = await readAllRaw();
  const created = await createVault(password, recoveryCode, prefs);
  const encoded = {} as Record<TableName, Row[]>;
  for (const t of DATA_TABLES) encoded[t] = await Promise.all(plain[t].map((r) => encodeWith(created.keys, t, r)));

  const all = [...DATA_TABLES.map((t) => db.table(t)), db.vault];
  await db.transaction("rw", all, async () => {
    for (const t of DATA_TABLES) {
      await db.table(t).clear();
      await db.table(t).bulkPut(encoded[t]);
    }
    await db.vault.put(created.meta);
  });

  try {
    const check = await decodeAll(created.keys, await readAllRaw());
    if (!sameData(plain, check)) throw new Error("La verificación no coincide");
  } catch (e) {
    await db.transaction("rw", all, async () => {
      for (const t of DATA_TABLES) {
        await db.table(t).clear();
        await db.table(t).bulkPut(plain[t]);
      }
      await db.vault.delete("main");
    });
    meta = null;
    throw new Error(`No se pudo activar el cifrado; tus datos quedaron como estaban. (${e instanceof Error ? e.message : e})`);
  }
  meta = created.meta;
  keys = created.keys;
}

/** Desactiva el cifrado: pide la contraseña, descifra todo y lo guarda en claro (todo o nada). */
export async function disableEncryption(password: string): Promise<void> {
  if (!meta) return;
  const k = await unlockWithPassword(meta, password);
  const plain = await decodeAll(k, await readAllRaw());
  await db.transaction("rw", [...DATA_TABLES.map((t) => db.table(t)), db.vault], async () => {
    for (const t of DATA_TABLES) {
      await db.table(t).clear();
      await db.table(t).bulkPut(plain[t]);
    }
    await db.vault.delete("main");
  });
  meta = null;
  keys = null;
}

// ---------- bloquear / desbloquear ----------
export function lock(): void {
  keys = null;
}

export type UnlockResult =
  | { ok: true }
  | { ok: false; reason: "wrong"; failedAttempts: number; lockoutUntil: number; wiped: boolean }
  | { ok: false; reason: "lockout"; lockoutUntil: number };

async function saveMeta(next: VaultMeta) {
  await db.vault.put(next);
  meta = next;
}

/** Cuenta un intento fallido (se guarda: no se reinicia cerrando la app) y borra todo si corresponde. */
async function registerFailure(): Promise<UnlockResult> {
  const m = meta!;
  const failedAttempts = m.failedAttempts + 1;
  if (m.prefs.wipeAfter10 && failedAttempts >= WIPE_AFTER_ATTEMPTS) {
    await wipeEverything();
    return { ok: false, reason: "wrong", failedAttempts, lockoutUntil: 0, wiped: true };
  }
  const delay = lockoutDelayMs(failedAttempts);
  const lockoutUntil = delay ? Date.now() + delay : 0;
  await saveMeta({ ...m, failedAttempts, lockoutUntil });
  return { ok: false, reason: "wrong", failedAttempts, lockoutUntil, wiped: false };
}

async function attempt(fn: (m: VaultMeta) => Promise<{ keys: VaultKeys; meta?: VaultMeta }>): Promise<UnlockResult> {
  const m = meta ?? (await loadVaultMeta());
  if (!m) return { ok: true };
  if (m.lockoutUntil > Date.now()) return { ok: false, reason: "lockout", lockoutUntil: m.lockoutUntil };
  try {
    const r = await fn(m);
    await saveMeta({ ...(r.meta ?? m), failedAttempts: 0, lockoutUntil: 0 });
    keys = r.keys;
    return { ok: true };
  } catch (e) {
    if (e instanceof WrongSecretError) return registerFailure();
    throw e;
  }
}

export const unlock = (password: string) => attempt(async (m) => ({ keys: await unlockWithPassword(m, password) }));

/** "Olvidé mi contraseña": entra con el código y deja una contraseña nueva. */
export const recover = (code: string, newPassword: string) => attempt((m) => recoverWithCode(m, code, newPassword));

/** Comprueba la contraseña actual sin tocar nada (para exportar el backup cifrado). */
export async function verifyPassword(password: string): Promise<boolean> {
  if (!meta) return false;
  try {
    await unlockWithPassword(meta, password);
    return true;
  } catch (e) {
    if (e instanceof WrongSecretError) return false;
    throw e;
  }
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  if (!meta) throw new Error("El cifrado no está activo");
  await saveMeta(await changeVaultPassword(meta, oldPassword, newPassword));
}

export async function updateVaultPrefs(partial: Partial<VaultPrefs>): Promise<void> {
  if (!meta) return;
  await saveMeta({ ...meta, prefs: { ...meta.prefs, ...partial } });
}

/** Borra absolutamente todo (datos y caja fuerte). La app vuelve a empezar desde la bienvenida. */
export async function wipeEverything(): Promise<void> {
  await db.transaction("rw", [...DATA_TABLES.map((t) => db.table(t)), db.vault], async () => {
    for (const t of DATA_TABLES) await db.table(t).clear();
    await db.vault.clear();
  });
  meta = null;
  keys = null;
}

/** Solo para tests: olvida el estado en memoria como si la app se cerrara. */
export function __resetMemoryForTests(): void {
  keys = null;
  meta = null;
  metaLoaded = false;
}
