import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { db } from "./db";
import {
  __resetMemoryForTests, changePin, enableEncryption, enablePin, isUnlocked, loadVaultMeta, lock, store,
  verifyCurrentPin, verifyPassword, SettingsLockoutError,
} from "./store";
import { generateRecoveryCode, WrongSecretError } from "../lib/vault";

const PW = "caballo bateria grapa";
const prefs = { lockAfterMs: 5000, wipeAfter10: true, theme: "light" as const }; // borrado a los 10 activado a propósito
const mv = { id: "m1", date: "2026-11-10", amount: 1, kind: "expense" as const, categoryId: "x", note: "Dato", source: "manual" as const, createdAt: "x" };

describe("C-02: verificar la clave desde Ajustes", () => {
  beforeEach(async () => {
    __resetMemoryForTests();
    await Promise.all(db.tables.map((t) => t.clear()));
    __resetMemoryForTests();
    await store.movements.put(mv);
  });
  afterEach(() => vi.useRealTimers());

  it("Antes: probar contraseñas en Ajustes no tenía límite (ahora: después de 5, hay espera aunque la siguiente sea la correcta)", async () => {
    await enableEncryption(PW, generateRecoveryCode(), prefs);
    for (let i = 0; i < 5; i++) expect(await verifyPassword("mal" + i)).toBe(false);
    await expect(verifyPassword(PW)).rejects.toThrow(SettingsLockoutError);
  });

  it("La espera crece y NUNCA dispara el borrado de 10 intentos (eso es solo para la pantalla de bloqueo)", async () => {
    await enableEncryption(PW, generateRecoveryCode(), prefs);
    let now = Date.now();
    for (let i = 0; i < 14; i++) {
      vi.useFakeTimers({ now: (now += 2 * 3_600_000), toFake: ["Date"] });
      expect(await verifyPassword("mal")).toBe(false);
    }
    expect(await loadVaultMeta()).not.toBeNull();
    expect((await store.movements.get("m1"))?.note).toBe("Dato");
  });

  it("Verificar bien no tiene efectos: no desbloquea, no toca el contador de la pantalla de bloqueo", async () => {
    await enableEncryption(PW, generateRecoveryCode(), prefs);
    const before = await db.vault.get("main");
    lock();
    expect(await verifyPassword(PW)).toBe(true);
    expect(isUnlocked()).toBe(false);
    expect(await db.vault.get("main")).toEqual(before);
  });

  it("El PIN en Ajustes (verificar y cambiar) también cuenta intentos y espera", async () => {
    await enablePin("4826", prefs);
    for (let i = 0; i < 4; i++) expect(await verifyCurrentPin("0000")).toBe(false);
    await expect(changePin("1111", "2222")).rejects.toThrow(WrongSecretError);
    await expect(verifyCurrentPin("4826")).rejects.toThrow(SettingsLockoutError);
  });
});
