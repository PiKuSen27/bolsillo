import { describe, it, expect } from "vitest";
import {
  PBKDF2_ITERATIONS,
  WrongSecretError,
  changePassword,
  createVault,
  decryptBackup,
  decryptRecord,
  encryptBackup,
  encryptRecord,
  generateRecoveryCode,
  isEncryptedBackup,
  lockoutDelayMs,
  normalizeRecoveryCode,
  passwordStrength,
  recoverWithCode,
  storedKeyFor,
  unlockWithPassword,
} from "./vault";

const prefs = { lockAfterMs: 5000, wipeAfter10: false, theme: "light" as const };
const FAST = PBKDF2_ITERATIONS; // menos iteraciones se rechazan (ver test de manipulación)

describe("vault.ts - Cifrado de datos", () => {
  it("Por defecto usa PBKDF2 con al menos 600.000 iteraciones y sales distintas", async () => {
    const { meta } = await createVault("una frase larga", generateRecoveryCode(), prefs);
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
    expect(meta.iterations).toBe(PBKDF2_ITERATIONS);
    expect(meta.pwSalt).not.toBe(meta.rcSalt);
  });

  it("Cifra y descifra un registro ida y vuelta; el texto cifrado no contiene los datos", async () => {
    const { keys } = await createVault("caballo bateria grapa", generateRecoveryCode(), prefs, FAST);
    const sk = await storedKeyFor(keys, "movements", "m1");
    const rec = { id: "m1", amount: 987654, note: "PizzaSecreta" };
    const sealed = await encryptRecord(keys, "movements", sk, rec);
    expect(sealed).not.toContain("Pizza");
    expect(atob(sealed)).not.toContain("PizzaSecreta");
    expect(await decryptRecord(keys, "movements", sk, sealed)).toEqual(rec);
    // la clave guardada no deja ver el id real y es siempre la misma para el mismo id
    expect(sk).not.toContain("m1");
    expect(await storedKeyFor(keys, "movements", "m1")).toBe(sk);
    expect(await storedKeyFor(keys, "debts", "m1")).not.toBe(sk);
  });

  it("Un registro movido a otra clave o tabla, o alterado, no se descifra", async () => {
    const { keys } = await createVault("caballo bateria grapa", generateRecoveryCode(), prefs, FAST);
    const sk1 = await storedKeyFor(keys, "movements", "m1");
    const sk2 = await storedKeyFor(keys, "movements", "m2");
    const sealed = await encryptRecord(keys, "movements", sk1, { amount: 1 });
    await expect(decryptRecord(keys, "movements", sk2, sealed)).rejects.toThrow(WrongSecretError);
    await expect(decryptRecord(keys, "debts", sk1, sealed)).rejects.toThrow(WrongSecretError);
    const bytes = Uint8Array.from(atob(sealed), (c) => c.charCodeAt(0));
    bytes[bytes.length - 1] ^= 1;
    await expect(decryptRecord(keys, "movements", sk1, btoa(String.fromCharCode(...bytes)))).rejects.toThrow(WrongSecretError);
  });

  it("Contraseña incorrecta rechazada; la correcta abre y descifra lo cifrado antes", async () => {
    const { meta, keys } = await createVault("caballo bateria grapa", generateRecoveryCode(), prefs, FAST);
    const sk = await storedKeyFor(keys, "debts", "d1");
    const sealed = await encryptRecord(keys, "debts", sk, { person: "Rocio" });
    await expect(unlockWithPassword(meta, "caballo bateria grapA")).rejects.toThrow(WrongSecretError);
    const again = await unlockWithPassword(meta, "caballo bateria grapa");
    expect(await decryptRecord(again, "debts", await storedKeyFor(again, "debts", "d1"), sealed)).toEqual({ person: "Rocio" });
  });

  it("Recuperación: con el código se entra y se elige contraseña nueva; los datos siguen y la vieja deja de andar", async () => {
    const code = generateRecoveryCode();
    const { meta, keys } = await createVault("vieja contraseña 1", code, prefs, FAST);
    const sk = await storedKeyFor(keys, "movements", "m1");
    const sealed = await encryptRecord(keys, "movements", sk, { amount: 5 });
    await expect(recoverWithCode(meta, "AAAA-BBBB-CCCC-DDDD-EEEE-FFFF", "nueva contraseña 2")).rejects.toThrow(WrongSecretError);
    // escrito en minúsculas y sin guiones también vale
    const r = await recoverWithCode(meta, code.toLowerCase().replace(/-/g, " "), "nueva contraseña 2");
    expect(await decryptRecord(r.keys, "movements", sk, sealed)).toEqual({ amount: 5 });
    await expect(unlockWithPassword(r.meta, "vieja contraseña 1")).rejects.toThrow(WrongSecretError);
    await unlockWithPassword(r.meta, "nueva contraseña 2");
    expect(r.meta.rcWrapped).toBe(meta.rcWrapped); // el código anotado en papel sigue sirviendo
  });

  it("Cambiar la contraseña solo re-envuelve la clave: lo cifrado antes se sigue leyendo", async () => {
    const { meta, keys } = await createVault("primera clave 123", generateRecoveryCode(), prefs, FAST);
    const sk = await storedKeyFor(keys, "settings", "main");
    const sealed = await encryptRecord(keys, "settings", sk, { fixedSalary: 700000 });
    await expect(changePassword(meta, "otra", "segunda clave 456")).rejects.toThrow(WrongSecretError);
    const m2 = await changePassword(meta, "primera clave 123", "segunda clave 456");
    expect(m2.pwSalt).not.toBe(meta.pwSalt);
    const k2 = await unlockWithPassword(m2, "segunda clave 456");
    expect(await decryptRecord(k2, "settings", sk, sealed)).toEqual({ fixedSalary: 700000 });
    await expect(unlockWithPassword(m2, "primera clave 123")).rejects.toThrow(WrongSecretError);
  });

  it("Backup cifrado: ida y vuelta con la contraseña, rechaza la incorrecta y no deja datos legibles", async () => {
    const json = JSON.stringify({ version: 2, movements: [{ note: "PizzaSecreta", amount: 987654 }] });
    const file = await encryptBackup(json, "mi contraseña larga", 100_000);
    expect(isEncryptedBackup(file)).toBe(true);
    expect(isEncryptedBackup(json)).toBe(false);
    expect(file).not.toContain("Pizza");
    expect(file).not.toContain("987654");
    expect(await decryptBackup(file, "mi contraseña larga")).toBe(json);
    await expect(decryptBackup(file, "otra")).rejects.toThrow(WrongSecretError);
  });

  it("Código de recuperación: 6 grupos de 4, sin letras que se confunden, y normalización al tipearlo", () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){5}$/);
    expect(generateRecoveryCode()).not.toBe(code);
    expect(normalizeRecoveryCode(" ab1o-il ")).toBe("AB10" + "11");
  });

  it("Fuerza de contraseña: mínimo 8, sin PIN corto, sin contraseñas comunes", () => {
    expect(passwordStrength("abc").ok).toBe(false);
    expect(passwordStrength("12345679").ok).toBe(false); // PIN de 8 números
    expect(passwordStrength("123456789012").ok).toBe(false); // 12 números todavía es poco
    expect(passwordStrength("31415926535897").ok).toBe(true); // 14 números sí
    expect(passwordStrength("password").ok).toBe(false);
    expect(passwordStrength("aaaaaaaaaa").ok).toBe(false);
    expect(passwordStrength("gatito22")).toMatchObject({ ok: false, score: 1 }); // débil: no alcanza
    expect(passwordStrength("caballo bateria grapa correcta").score).toBe(4);
  });

  it("Revisión #9: si alguien baja las iteraciones guardadas, se rechaza", async () => {
    const { meta } = await createVault("caballo bateria grapa", generateRecoveryCode(), prefs);
    await expect(unlockWithPassword({ ...meta, iterations: 1 }, "caballo bateria grapa")).rejects.toThrow(/dañados/);
  });

  it("Intentos fallidos: libres hasta 4; después 30 s, 1 min, 5 min, 15 min y 1 h como máximo", () => {
    expect([0, 4].map(lockoutDelayMs)).toEqual([0, 0]);
    expect([5, 6, 7, 8, 9, 20].map(lockoutDelayMs)).toEqual([30_000, 60_000, 300_000, 900_000, 3_600_000, 3_600_000]);
  });
});
