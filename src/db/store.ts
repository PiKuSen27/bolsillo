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
  createPin,
  verifyPin,
  PinMeta,
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
// Modo "Simple": PIN que solo traba la entrada (los datos no se cifran)
let pinMeta: PinMeta | null = null;
let pinUnlocked = false;

export async function loadVaultMeta(): Promise<VaultMeta | null> {
  meta = (await db.vault.get("main")) ?? null;
  pinMeta = ((await db.table("vault").get("pin")) as PinMeta | undefined) ?? null;
  metaLoaded = true;
  return meta;
}
/** "none" sin bloqueo · "pin" bloqueo simple · "encrypted" contraseña con datos cifrados */
export const lockMode = (): "none" | "pin" | "encrypted" => (meta ? "encrypted" : pinMeta ? "pin" : "none");
export const isVaultEnabled = () => !!meta;
export const isUnlocked = () => (meta ? !!keys : pinMeta ? pinUnlocked : true);
export const getVaultPrefs = (): VaultPrefs | null => meta?.prefs ?? pinMeta?.prefs ?? null;
export const getLockState = () => {
  const m = meta ?? pinMeta;
  return { failedAttempts: m?.failedAttempts ?? 0, lockoutUntil: m?.lockoutUntil ?? 0 };
};

// ---------- candado interno ----------
// Activar, desactivar o borrar todo ("exclusivo") espera a que terminen las lecturas/escrituras en curso
// ("compartidas"), y las nuevas esperan a que termine. Así nada se escribe con el estado viejo a mitad de camino.
let inflight = 0;
let drained: (() => void) | null = null;
let exclusiveRun: Promise<unknown> | null = null;

async function shared<T>(fn: () => Promise<T>): Promise<T> {
  while (exclusiveRun) await exclusiveRun.catch(() => {});
  inflight++;
  try {
    return await fn();
  } finally {
    inflight--;
    if (inflight === 0 && drained) drained();
  }
}

// OJO: dentro de un exclusive() no llamar a store.* (esperaría a sí mismo); usar db directo.
async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  while (exclusiveRun) await exclusiveRun.catch(() => {});
  const run = (async () => {
    while (inflight > 0) await new Promise<void>((r) => (drained = r));
    drained = null;
    return fn();
  })();
  exclusiveRun = run;
  try {
    return await run;
  } finally {
    if (exclusiveRun === run) exclusiveRun = null;
  }
}

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

/** Con el cifrado activo, un registro sin cifrar no lo escribió la app: se ignora (no se muestra ni se cuenta). */
async function decodeTrusted<T>(k: VaultKeys | null, table: TableName, row: Row | undefined): Promise<T | undefined> {
  if (!row) return undefined;
  if (k && typeof row.enc !== "string") return undefined;
  return decodeWith<T>(k, table, row);
}

async function keyWith(k: VaultKeys | null, table: TableName, realKey: string): Promise<string> {
  return k ? storedKeyFor(k, table, realKey) : realKey;
}

class SecureTable<T> {
  constructor(private name: TableName) {}
  private get raw() {
    return db.table(this.name);
  }
  toArray(): Promise<T[]> {
    return shared(async () => {
      const k = await ready();
      const rows = await this.raw.toArray();
      const out = await Promise.all(rows.map((r) => decodeTrusted<T>(k, this.name, r)));
      return out.filter((x): x is Awaited<T> => x !== undefined) as T[];
    });
  }
  get(key: string): Promise<T | undefined> {
    return shared(async () => {
      const k = await ready();
      return decodeTrusted<T>(k, this.name, await this.raw.get(await keyWith(k, this.name, key)));
    });
  }
  bulkGet(keys: string[]): Promise<(T | undefined)[]> {
    return shared(async () => {
      const k = await ready();
      const rows = await this.raw.bulkGet(await Promise.all(keys.map((x) => keyWith(k, this.name, x))));
      return Promise.all(rows.map((r) => decodeTrusted<T>(k, this.name, r)));
    });
  }
  put(rec: T): Promise<void> {
    return shared(async () => {
      const k = await ready();
      await this.raw.put(await encodeWith(k, this.name, rec as Row));
    });
  }
  bulkPut(recs: T[]): Promise<void> {
    return shared(async () => {
      const k = await ready();
      await this.raw.bulkPut(await Promise.all(recs.map((r) => encodeWith(k, this.name, r as Row))));
    });
  }
  delete(key: string): Promise<void> {
    return shared(async () => {
      const k = await ready();
      await this.raw.delete(await keyWith(k, this.name, key));
    });
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
export function applyAtomically(ops: Op[]): Promise<void> {
  return shared(() => applyAtomicallyNow(ops));
}

async function applyAtomicallyNow(ops: Op[]): Promise<void> {
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
  for (const t of DATA_TABLES) {
    const rows = await Promise.all(raw[t].map((r) => decodeTrusted<Row>(k, t, r)));
    out[t] = rows.filter((r): r is Row => r !== undefined); // con cifrado, filas en claro metidas por afuera no se copian
  }
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
export function enableEncryption(password: string, recoveryCode: string, prefs: VaultPrefs): Promise<void> {
  return exclusive(() => enableNow(password, recoveryCode, prefs));
}

async function enableNow(password: string, recoveryCode: string, prefs: VaultPrefs): Promise<void> {
  if (await loadVaultMeta()) throw new Error("El cifrado ya está activo");
  const prevPin = pinMeta; // pasar de PIN a Cifrada: el PIN se reemplaza por la contraseña
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
    await db.table("vault").delete("pin");
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
      if (prevPin) await db.table("vault").put(prevPin);
    });
    meta = null;
    throw new Error(`No se pudo activar el cifrado; tus datos quedaron como estaban. (${e instanceof Error ? e.message : e})`);
  }
  meta = created.meta;
  keys = created.keys;
  pinMeta = null;
}

/** Desactiva el cifrado: pide la contraseña, descifra todo y lo guarda en claro (todo o nada). */
export function disableEncryption(password: string): Promise<void> {
  return exclusive(() => disableNow(password));
}

async function disableNow(password: string): Promise<void> {
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
  pinUnlocked = false;
}

export type UnlockResult =
  | { ok: true }
  | { ok: false; reason: "wrong"; failedAttempts: number; lockoutUntil: number; wiped: boolean }
  | { ok: false; reason: "lockout"; lockoutUntil: number };

async function saveMeta(next: VaultMeta) {
  await db.vault.put(next);
  meta = next;
}

async function savePin(next: PinMeta) {
  await db.table("vault").put(next);
  pinMeta = next;
}

type Lockable = { failedAttempts: number; lockoutUntil: number; prefs: VaultPrefs };
type Slot<M extends Lockable> = { load: () => Promise<M | null>; save: (m: M) => Promise<void> };
const mainSlot: Slot<VaultMeta> = { load: async () => (await loadVaultMeta(), meta), save: saveMeta };
const pinSlot: Slot<PinMeta> = { load: async () => (await loadVaultMeta(), pinMeta), save: savePin };

let attemptChain: Promise<unknown> = Promise.resolve();

/**
 * Un intento por vez. El intento se cuenta ANTES de probar la clave (si la app se cierra a mitad de
 * camino, igual cuenta); si sale bien, el contador vuelve a cero. La espera se guarda en la base.
 * check() lanza WrongSecretError si la clave no es la correcta.
 */
function attempt<M extends Lockable>(slot: Slot<M>, check: (m: M) => Promise<{ next?: M; apply: () => void }>): Promise<UnlockResult> {
  const run = attemptChain.catch(() => {}).then(() => attemptNow(slot, check));
  attemptChain = run;
  return run;
}

async function attemptNow<M extends Lockable>(
  slot: Slot<M>,
  check: (m: M) => Promise<{ next?: M; apply: () => void }>
): Promise<UnlockResult> {
  const m = await slot.load();
  if (!m) return { ok: true };
  if (m.lockoutUntil > Date.now()) return { ok: false, reason: "lockout", lockoutUntil: m.lockoutUntil };
  const failedAttempts = m.failedAttempts + 1;
  await slot.save({ ...m, failedAttempts });
  let r: { next?: M; apply: () => void };
  try {
    r = await check(m);
  } catch (e) {
    if (!(e instanceof WrongSecretError)) {
      await slot.save({ ...m }); // no fue la clave (p. ej. error del sistema): no cuenta
      throw e;
    }
    if (m.prefs.wipeAfter10 && failedAttempts >= WIPE_AFTER_ATTEMPTS) {
      await wipeNow();
      return { ok: false, reason: "wrong", failedAttempts, lockoutUntil: 0, wiped: true };
    }
    const delay = lockoutDelayMs(failedAttempts);
    const lockoutUntil = delay ? Date.now() + delay : 0;
    await slot.save({ ...m, failedAttempts, lockoutUntil });
    return { ok: false, reason: "wrong", failedAttempts, lockoutUntil, wiped: false };
  }
  await slot.save({ ...(r.next ?? m), failedAttempts: 0, lockoutUntil: 0 });
  r.apply();
  return { ok: true };
}

export const unlock = (password: string) =>
  attempt(mainSlot, async (m) => {
    const k = await unlockWithPassword(m, password);
    return { apply: () => (keys = k) };
  });

export const unlockPin = (pin: string) =>
  attempt(pinSlot, async (m) => {
    if (!(await verifyPin(m, pin))) throw new WrongSecretError();
    return { apply: () => (pinUnlocked = true) };
  });

/** Activa el bloqueo simple con PIN (sin cifrar los datos). */
export function enablePin(pin: string, prefs: VaultPrefs): Promise<void> {
  return exclusive(async () => {
    if (await loadVaultMeta()) throw new Error("Primero pasá la contraseña a PIN desde Seguridad");
    await savePin(await createPin(pin, prefs));
    pinUnlocked = true;
  });
}

/** Quita el bloqueo simple: pide el PIN actual. */
export async function disablePin(pin: string): Promise<void> {
  await loadVaultMeta();
  if (!pinMeta || !(await verifyPin(pinMeta, pin))) throw new WrongSecretError();
  await db.table("vault").delete("pin");
  pinMeta = null;
  pinUnlocked = false;
}

export async function changePin(oldPin: string, newPin: string): Promise<void> {
  if (!pinMeta || !(await verifyPin(pinMeta, oldPin))) throw new WrongSecretError();
  await savePin({ ...(await createPin(newPin, pinMeta.prefs)) });
}

/** Comprueba el PIN sin contar intentos (para pasar de Simple a Cifrada). */
export async function verifyCurrentPin(pin: string): Promise<boolean> {
  return !!pinMeta && (await verifyPin(pinMeta, pin));
}

/** De Cifrada a Simple: pide la contraseña, descifra todo y deja el PIN nuevo. */
export function switchToPin(password: string, pin: string, prefs: VaultPrefs): Promise<void> {
  return exclusive(async () => {
    const pinRecord = await createPin(pin, prefs);
    await disableNow(password);
    await savePin(pinRecord);
    pinUnlocked = true;
  });
}

/** "Olvidé mi contraseña": entra con el código y deja una contraseña nueva. */
export const recover = (code: string, newPassword: string) =>
  attempt(mainSlot, async (m) => {
    const r = await recoverWithCode(m, code, newPassword);
    return { next: r.meta, apply: () => (keys = r.keys) };
  });

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
  if (meta) await saveMeta({ ...meta, prefs: { ...meta.prefs, ...partial } });
  else if (pinMeta) await savePin({ ...pinMeta, prefs: { ...pinMeta.prefs, ...partial } });
}

/** Borra absolutamente todo (datos y caja fuerte). La app vuelve a empezar desde la bienvenida. */
export function wipeEverything(): Promise<void> {
  return exclusive(wipeNow);
}

async function wipeNow(): Promise<void> {
  await db.transaction("rw", [...DATA_TABLES.map((t) => db.table(t)), db.vault], async () => {
    for (const t of DATA_TABLES) await db.table(t).clear();
    await db.vault.clear();
  });
  meta = null;
  keys = null;
  pinMeta = null;
  pinUnlocked = false;
}

/** Solo para tests: olvida el estado en memoria como si la app se cerrara. */
export function __resetMemoryForTests(): void {
  keys = null;
  meta = null;
  pinMeta = null;
  pinUnlocked = false;
  metaLoaded = false;
}
