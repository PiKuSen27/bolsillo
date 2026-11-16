import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "./db";
import {
  DATA_TABLES,
  LockedError,
  __resetMemoryForTests,
  changePassword,
  disableEncryption,
  enableEncryption,
  isUnlocked,
  loadVaultMeta,
  lock,
  recover,
  store,
  unlock,
  updateVaultPrefs,
  verifyPassword,
  disablePin,
  enablePin,
  lockMode,
  switchToPin,
  unlockPin,
} from "./store";
import { exportAllData, getSettings, importAllData, updateSettings } from "./repo";
import { decryptBackup, encryptBackup, generateRecoveryCode } from "../lib/vault";
import { validateBackup } from "../lib/backup";

const PW = "caballo bateria grapa";
const prefs = { lockAfterMs: 5000, wipeAfter10: false, theme: "light" as const };
// Datos con textos y montos "raros" para poder buscarlos en lo guardado
const SECRETS = ["PizzaSecreta", "987654", "RocioTest", "NetflixTest", "TeleTest", "1234567", "424242"];

async function seed() {
  await updateSettings({ fixedSalary: 1234567, dailyRate: 424242, onboardingDone: true });
  await store.movements.bulkPut([
    { id: "m1", date: "2026-11-10", amount: 987654, kind: "expense", categoryId: "comida", note: "PizzaSecreta", source: "manual", createdAt: "2026-11-10T12:00:00.000Z" },
    { id: "m2", date: "2026-11-11", amount: 5000, kind: "income", categoryId: "income", source: "manual", createdAt: "2026-11-11T12:00:00.000Z" },
  ]);
  await store.recurrings.put({ id: "r1", name: "NetflixTest", amount: 5000, categoryId: "suscripciones", dueDay: 10, autoAdd: true, active: true });
  await store.installments.put({ id: "i1", name: "TeleTest", totalAmount: 100000, installmentsCount: 3, installmentAmount: 33333, firstDueDate: "2026-10-15", paidCount: 1, categoryId: "otros", autoAdd: true, active: true });
  await store.workDays.put({ date: "2026-11-15", worked: true, amount: 55555 });
  await store.dayLogs.put({ date: "2026-11-09", logged: true, noExpenses: true });
  await store.debts.put({ id: "d1", kind: "they_owe", person: "RocioTest", amount: 15000, note: "Cena", settled: false, createdAt: "2026-11-01T10:00:00.000Z" });
  await store.remindersSent.put({ key: "due_alert_r1_2026-11-10_0", sentAt: "2026-11-10T21:00:00.000Z" });
}

async function rawDump(): Promise<string> {
  const parts: unknown[] = [];
  for (const t of [...DATA_TABLES, "vault"]) parts.push(await db.table(t).toArray());
  return JSON.stringify(parts);
}

async function snapshot() {
  const out: Record<string, unknown> = {};
  for (const t of DATA_TABLES) out[t] = (await store[t].toArray()).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return out;
}

describe("Cifrado de la base (store.ts)", () => {
  beforeEach(async () => {
    __resetMemoryForTests();
    await Promise.all(db.tables.map((t) => t.clear()));
    __resetMemoryForTests();
    await seed();
  });

  it("Al activarlo con datos existentes, nada legible queda guardado (montos, notas, nombres, fechas, ids)", async () => {
    const before = await snapshot();
    expect(SECRETS.every((x) => JSON.stringify(before).includes(x))).toBe(true);
    await enableEncryption(PW, generateRecoveryCode(), prefs);
    const raw = await rawDump();
    const leaks = [...SECRETS, "2026-11-", '"id":"m1"', '"id":"d1"', '"date":"2026', '"amount"', '"note"', '"person"', '"fixedSalary"', "Cena", "due_alert"];
    for (const secret of leaks) expect(raw).not.toContain(secret);
    // y la app sigue leyendo todo igual
    expect(await snapshot()).toEqual(before);
  });

  it("Bloqueado no se puede leer ni escribir; contraseña incorrecta rechazada; la correcta abre", async () => {
    await enableEncryption(PW, generateRecoveryCode(), prefs);
    lock();
    expect(isUnlocked()).toBe(false);
    await expect(store.movements.toArray()).rejects.toThrow(LockedError);
    await expect(store.movements.put({} as never)).rejects.toThrow(LockedError);
    expect(await unlock("otra")).toMatchObject({ ok: false, reason: "wrong", failedAttempts: 1 });
    expect(await unlock(PW)).toEqual({ ok: true });
    expect((await store.debts.get("d1"))?.person).toBe("RocioTest");
  });

  it("Los intentos fallidos se guardan: cerrar y abrir la app no reinicia la espera", async () => {
    await enableEncryption(PW, generateRecoveryCode(), prefs);
    lock();
    for (let i = 0; i < 4; i++) expect((await unlock("mal")).ok).toBe(false);
    const fifth = await unlock("mal");
    expect(fifth).toMatchObject({ reason: "wrong", failedAttempts: 5 });
    __resetMemoryForTests(); // "cerrar la app"
    await loadVaultMeta();
    expect(await unlock(PW)).toMatchObject({ ok: false, reason: "lockout" }); // ni siquiera la correcta durante la espera
    vi.useFakeTimers({ now: Date.now() + 31_000, toFake: ["Date"] });
    try {
      expect(await unlock(PW)).toEqual({ ok: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it("Con 'borrar después de 10 intentos', el décimo fallo borra todo", async () => {
    await enableEncryption(PW, generateRecoveryCode(), { ...prefs, wipeAfter10: true });
    lock();
    let r;
    for (let i = 0; i < 10; i++) {
      vi.useFakeTimers({ now: Date.now() + i * 4 * 3_600_000, toFake: ["Date"] });
      r = await unlock("mal");
      vi.useRealTimers();
    }
    expect(r).toMatchObject({ reason: "wrong", wiped: true });
    expect(await loadVaultMeta()).toBeNull();
    expect(await db.movements.count()).toBe(0);
  });

  it("Olvidé mi contraseña: el código de recuperación abre y deja una contraseña nueva", async () => {
    const code = generateRecoveryCode();
    await enableEncryption(PW, code, prefs);
    lock();
    expect((await recover("0000-0000-0000-0000-0000-0000", "nueva contraseña larga")).ok).toBe(false);
    expect(await recover(code, "nueva contraseña larga")).toEqual({ ok: true });
    expect((await store.movements.get("m1"))?.note).toBe("PizzaSecreta");
    lock();
    expect((await unlock(PW)).ok).toBe(false);
    expect((await unlock("nueva contraseña larga")).ok).toBe(true);
  });

  it("Cambiar la contraseña no re-cifra los datos y la nueva abre", async () => {
    await enableEncryption(PW, generateRecoveryCode(), prefs);
    const rawBefore = JSON.stringify(await db.movements.toArray());
    await changePassword(PW, "otra contraseña larga");
    expect(JSON.stringify(await db.movements.toArray())).toBe(rawBefore);
    lock();
    expect((await unlock("otra contraseña larga")).ok).toBe(true);
  });

  it("Desactivar pide la contraseña y deja todo en claro como antes", async () => {
    const before = await snapshot();
    await enableEncryption(PW, generateRecoveryCode(), prefs);
    await expect(disableEncryption("mal")).rejects.toThrow();
    await disableEncryption(PW);
    expect(await loadVaultMeta()).toBeNull();
    expect(await rawDump()).toContain("PizzaSecreta");
    expect(await snapshot()).toEqual(before);
  });

  it("Si el cifrado falla a mitad de camino, no se pierde ni se cambia nada", async () => {
    const before = await rawDump();
    // El sexto registro que se cifra falla (como si se cortara a mitad de camino)
    const original = globalThis.crypto.subtle.encrypt.bind(globalThis.crypto.subtle);
    let calls = 0;
    const spy = vi.spyOn(globalThis.crypto.subtle, "encrypt").mockImplementation((...args: Parameters<SubtleCrypto["encrypt"]>) => {
      if (++calls === 6) return Promise.reject(new Error("falla simulada"));
      return original(...args);
    });
    try {
      await expect(enableEncryption(PW, generateRecoveryCode(), prefs)).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }
    expect(await loadVaultMeta()).toBeNull();
    expect(await rawDump()).toBe(before);
  });

  it("Backup con cifrado activo: el archivo va cifrado con la contraseña y se puede importar", async () => {
    await enableEncryption(PW, generateRecoveryCode(), prefs);
    expect(await verifyPassword("mal")).toBe(false);
    expect(await verifyPassword(PW)).toBe(true);
    const file = await encryptBackup(await exportAllData(), PW, 100_000);
    for (const secret of SECRETS) expect(file).not.toContain(secret);
    const json = await decryptBackup(file, PW);
    expect(validateBackup(json).ok).toBe(true);
    // importarlo en la base cifrada lo guarda cifrado
    await store.movements.delete("m1");
    expect((await importAllData(json)).success).toBe(true);
    expect((await store.movements.get("m1"))?.note).toBe("PizzaSecreta");
    expect(await rawDump()).not.toContain("PizzaSecreta");
  });

  it("Revisión #1: lo que se guarda MIENTRAS se activa el cifrado queda cifrado y no se pierde", async () => {
    const enabling = enableEncryption(PW, generateRecoveryCode(), prefs);
    const writing = store.movements.put({ id: "durante", date: "2026-11-12", amount: 555777, kind: "expense", categoryId: "comida", note: "EscritoDurante", source: "manual", createdAt: "2026-11-12T10:00:00.000Z" });
    await Promise.all([enabling, writing]);
    expect(await rawDump()).not.toContain("EscritoDurante");
    expect((await store.movements.get("durante"))?.amount).toBe(555777);
  });

  it("Revisión #1: lo que se guarda MIENTRAS se desactiva queda legible y la app no se traba", async () => {
    await enableEncryption(PW, generateRecoveryCode(), prefs);
    const disabling = disableEncryption(PW);
    const writing = store.debts.put({ id: "d9", kind: "i_owe", person: "Durante", amount: 1, settled: false, createdAt: "2026-11-12T10:00:00.000Z" });
    await Promise.all([disabling, writing]);
    expect((await store.debts.toArray()).map((d) => d.id).sort()).toEqual(["d1", "d9"]);
  });

  it("Revisión #2: con cifrado activo, un registro sin cifrar metido por afuera se ignora", async () => {
    await enableEncryption(PW, generateRecoveryCode(), prefs);
    await db.movements.put({ id: "falso", date: "2026-11-12", amount: 1, kind: "income", categoryId: "income", source: "manual", createdAt: "x" });
    expect((await store.movements.toArray()).some((m) => m.id === "falso")).toBe(false);
    expect(await store.movements.get("falso")).toBeUndefined();
  });

  it("Revisión: si la verificación después de escribir falla, se restaura todo como estaba", async () => {
    const before = await rawDump();
    const original = globalThis.crypto.subtle.decrypt.bind(globalThis.crypto.subtle);
    const spy = vi.spyOn(globalThis.crypto.subtle, "decrypt").mockImplementation(() => Promise.reject(new Error("falla al verificar")));
    try {
      await expect(enableEncryption(PW, generateRecoveryCode(), prefs)).rejects.toThrow(/quedaron como estaban/);
    } finally {
      spy.mockRestore();
    }
    void original;
    expect(await loadVaultMeta()).toBeNull();
    expect(await rawDump()).toBe(before);
  });

  it("Revisión #7: dos intentos al mismo tiempo cuentan como dos", async () => {
    await enableEncryption(PW, generateRecoveryCode(), prefs);
    lock();
    await Promise.all([unlock("mal1"), unlock("mal2")]);
    __resetMemoryForTests();
    expect((await loadVaultMeta())?.failedAttempts).toBe(2);
  });

  it("Las preferencias de la pantalla de bloqueo quedan fuera del cifrado y los ajustes se completan al leer", async () => {
    await enableEncryption(PW, generateRecoveryCode(), prefs);
    await updateVaultPrefs({ lockAfterMs: 0, theme: "dark" });
    __resetMemoryForTests();
    expect((await loadVaultMeta())?.prefs).toEqual({ lockAfterMs: 0, wipeAfter10: false, theme: "dark" });
    expect((await unlock(PW)).ok).toBe(true);
    expect((await getSettings()).fixedSalary).toBe(1234567);
  });

  it("Bloqueo simple (PIN): traba la entrada pero los datos quedan sin cifrar", async () => {
    await enablePin("4826", prefs);
    expect(lockMode()).toBe("pin");
    expect(await rawDump()).toContain("PizzaSecreta");
    lock();
    expect(isUnlocked()).toBe(false);
    expect(await unlockPin("0000")).toMatchObject({ ok: false, reason: "wrong", failedAttempts: 1 });
    expect(await unlockPin("4826")).toEqual({ ok: true });
    expect(isUnlocked()).toBe(true);
    __resetMemoryForTests();
    await loadVaultMeta();
    expect(lockMode()).toBe("pin"); // se recuerda al reabrir
  });

  it("El PIN también tiene espera después de 5 intentos", async () => {
    await enablePin("4826", prefs);
    lock();
    for (let i = 0; i < 5; i++) await unlockPin("0000");
    expect(await unlockPin("4826")).toMatchObject({ ok: false, reason: "lockout" });
  });

  it("Pasar de PIN a Cifrada y de Cifrada a PIN", async () => {
    await enablePin("4826", prefs);
    await enableEncryption(PW, generateRecoveryCode(), prefs);
    expect(lockMode()).toBe("encrypted");
    expect(await rawDump()).not.toContain("PizzaSecreta");
    await expect(switchToPin("mal", "1111", prefs)).rejects.toThrow();
    await switchToPin(PW, "1111", prefs);
    expect(lockMode()).toBe("pin");
    expect(await rawDump()).toContain("PizzaSecreta");
    await expect(disablePin("0000")).rejects.toThrow();
    await disablePin("1111");
    expect(lockMode()).toBe("none");
  });
});
