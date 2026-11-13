/**
 * Cifrado de los datos de Bolsillo (Web Crypto, sin paquetes externos).
 *
 * Esquema:
 * - master: 32 bytes aleatorios. Nunca se guarda en claro; de él se derivan (HKDF-SHA256):
 *     enc → AES-256-GCM para cifrar cada registro
 *     mac → HMAC-SHA256 para "disfrazar" las claves primarias (ids, fechas) en la base
 * - El master se guarda envuelto dos veces con AES-256-GCM:
 *     con una clave derivada de la contraseña (PBKDF2-SHA256, ≥ 600.000 iteraciones, sal aleatoria)
 *     con una clave derivada del código de recuperación (ídem, otra sal)
 * - Cada registro: IV aleatorio de 12 bytes + AES-GCM, con datos asociados "tabla|clave guardada"
 *   para que no se pueda mover un registro cifrado a otro lugar sin que falle.
 */

export const PBKDF2_ITERATIONS = 600_000;
const te = new TextEncoder();
const td = new TextDecoder();
const subtle = globalThis.crypto.subtle;
type Bytes = Uint8Array<ArrayBuffer>;

export class WrongSecretError extends Error {
  constructor() {
    super("Contraseña o código incorrecto");
    this.name = "WrongSecretError";
  }
}

export interface VaultKeys {
  enc: CryptoKey;
  mac: CryptoKey;
}

export interface VaultPrefs {
  lockAfterMs: number; // 0 = inmediato, 5000, 30000, 60000
  wipeAfter10: boolean; // borrar todo después de 10 intentos fallidos
  theme: "light" | "dark"; // para dibujar la pantalla de bloqueo sin descifrar nada
}

/** Lo único que queda sin cifrar: datos para abrir la caja fuerte, nunca datos del usuario. */
export interface VaultMeta {
  id: "main";
  v: 1;
  iterations: number;
  pwSalt: string;
  pwWrapped: string;
  rcSalt: string;
  rcWrapped: string;
  failedAttempts: number;
  lockoutUntil: number; // ms epoch
  prefs: VaultPrefs;
}

// ---------- base64 ----------
export function toB64(bytes: Bytes): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromB64(b64: string): Bytes {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
const randomBytes = (n: number): Bytes => globalThis.crypto.getRandomValues(new Uint8Array(n));

// ---------- primitivas ----------
async function deriveKek(secret: string, salt: Bytes, iterations: number): Promise<CryptoKey> {
  const base = await subtle.importKey("raw", te.encode(secret.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function seal(key: CryptoKey, plain: Bytes, aad: string): Promise<string> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv, additionalData: te.encode(aad) }, key, plain));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return toB64(out);
}

async function open(key: CryptoKey, sealed: string, aad: string): Promise<Bytes> {
  const raw = fromB64(sealed);
  if (raw.length < 12 + 16) throw new WrongSecretError();
  try {
    return new Uint8Array(
      await subtle.decrypt({ name: "AES-GCM", iv: raw.subarray(0, 12), additionalData: te.encode(aad) }, key, raw.subarray(12))
    );
  } catch {
    throw new WrongSecretError();
  }
}

async function keysFromMaster(master: Bytes): Promise<VaultKeys> {
  const hk = await subtle.importKey("raw", master, "HKDF", false, ["deriveKey"]);
  const salt = new Uint8Array(32);
  const enc = await subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: te.encode("bolsillo/v1/data-enc") },
    hk,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  const mac = await subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: te.encode("bolsillo/v1/key-mac") },
    hk,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign"]
  );
  return { enc, mac };
}

const AAD_PW = "bolsillo/v1/wrap/password";
const AAD_RC = "bolsillo/v1/wrap/recovery";

// ---------- código de recuperación ----------
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32: sin I, L, O, U (no se confunden)

/** 24 caracteres (120 bits) en 6 grupos de 4: "7KQ2-M9XD-…", fácil de copiar en papel. */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(24);
  const chars = Array.from(bytes, (b) => ALPHABET[b & 31]); // 256 es múltiplo de 32: sin sesgo
  return chars.join("").match(/.{4}/g)!.join("-");
}

/** Acepta minúsculas, espacios y guiones; I/L → 1 y O → 0 (letras que se confunden al copiar). */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[IL]/g, "1").replace(/O/g, "0").replace(/[^0-9A-Z]/g, "");
}

// ---------- caja fuerte ----------
export async function createVault(
  password: string,
  recoveryCode: string,
  prefs: VaultPrefs,
  iterations = PBKDF2_ITERATIONS
): Promise<{ meta: VaultMeta; keys: VaultKeys }> {
  const master = randomBytes(32);
  try {
    const pwSalt = randomBytes(16);
    const rcSalt = randomBytes(16);
    const meta: VaultMeta = {
      id: "main",
      v: 1,
      iterations,
      pwSalt: toB64(pwSalt),
      pwWrapped: await seal(await deriveKek(password, pwSalt, iterations), master, AAD_PW),
      rcSalt: toB64(rcSalt),
      rcWrapped: await seal(await deriveKek(normalizeRecoveryCode(recoveryCode), rcSalt, iterations), master, AAD_RC),
      failedAttempts: 0,
      lockoutUntil: 0,
      prefs,
    };
    return { meta, keys: await keysFromMaster(master) };
  } finally {
    master.fill(0);
  }
}

/** Lo guardado en la base podría estar manipulado: no aceptar menos iteraciones que las de fábrica. */
function checkIterations(meta: VaultMeta) {
  if (!Number.isInteger(meta.iterations) || meta.iterations < PBKDF2_ITERATIONS || meta.iterations > 10_000_000) {
    throw new Error("Los datos de seguridad de Bolsillo están dañados");
  }
}

async function masterFromPassword(meta: VaultMeta, password: string): Promise<Bytes> {
  checkIterations(meta);
  return open(await deriveKek(password, fromB64(meta.pwSalt), meta.iterations), meta.pwWrapped, AAD_PW);
}

async function masterFromRecovery(meta: VaultMeta, code: string): Promise<Bytes> {
  checkIterations(meta);
  return open(await deriveKek(normalizeRecoveryCode(code), fromB64(meta.rcSalt), meta.iterations), meta.rcWrapped, AAD_RC);
}

/** Abre la caja con la contraseña. Lanza WrongSecretError si no es la correcta. */
export async function unlockWithPassword(meta: VaultMeta, password: string): Promise<VaultKeys> {
  const master = await masterFromPassword(meta, password);
  try {
    return await keysFromMaster(master);
  } finally {
    master.fill(0);
  }
}

/** Cambia la contraseña: solo vuelve a envolver el master (los datos no se re-cifran). */
export async function changePassword(meta: VaultMeta, oldPassword: string, newPassword: string): Promise<VaultMeta> {
  const master = await masterFromPassword(meta, oldPassword);
  try {
    return await rewrapWithPassword(meta, master, newPassword);
  } finally {
    master.fill(0);
  }
}

/** "Olvidé mi contraseña": entra con el código de recuperación y deja una contraseña nueva. */
export async function recoverWithCode(
  meta: VaultMeta,
  code: string,
  newPassword: string
): Promise<{ meta: VaultMeta; keys: VaultKeys }> {
  const master = await masterFromRecovery(meta, code);
  try {
    return { meta: await rewrapWithPassword(meta, master, newPassword), keys: await keysFromMaster(master) };
  } finally {
    master.fill(0);
  }
}

async function rewrapWithPassword(meta: VaultMeta, master: Bytes, newPassword: string): Promise<VaultMeta> {
  const pwSalt = randomBytes(16);
  return {
    ...meta,
    pwSalt: toB64(pwSalt),
    pwWrapped: await seal(await deriveKek(newPassword, pwSalt, meta.iterations), master, AAD_PW),
  };
}

// ---------- registros ----------
/** Clave primaria disfrazada (HMAC): la base no ve ids ni fechas reales, pero se puede buscar por clave. */
export async function storedKeyFor(keys: VaultKeys, table: string, realKey: string): Promise<string> {
  const sig = new Uint8Array(await subtle.sign("HMAC", keys.mac, te.encode(`${table}\u0000${realKey}`)));
  return toB64(sig).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function encryptRecord(keys: VaultKeys, table: string, storedKey: string, value: unknown): Promise<string> {
  return seal(keys.enc, te.encode(JSON.stringify(value)), `rec|${table}|${storedKey}`);
}

export async function decryptRecord<T>(keys: VaultKeys, table: string, storedKey: string, sealed: string): Promise<T> {
  return JSON.parse(td.decode(await open(keys.enc, sealed, `rec|${table}|${storedKey}`))) as T;
}

// ---------- backup cifrado ----------
const BACKUP_FORMAT = "bolsillo-backup-cifrado";
const AAD_BACKUP = "bolsillo/v1/backup";

export async function encryptBackup(json: string, password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = randomBytes(16);
  const data = await seal(await deriveKek(password, salt, iterations), te.encode(json), AAD_BACKUP);
  return JSON.stringify({ format: BACKUP_FORMAT, v: 1, iterations, salt: toB64(salt), data }, null, 2);
}

export function isEncryptedBackup(text: string): boolean {
  try {
    return JSON.parse(text)?.format === BACKUP_FORMAT;
  } catch {
    return false;
  }
}

/** Devuelve el JSON del backup en claro. Lanza WrongSecretError si la contraseña no es la del archivo. */
export async function decryptBackup(text: string, password: string): Promise<string> {
  const f = JSON.parse(text);
  const iterations = Number(f.iterations);
  if (f.format !== BACKUP_FORMAT || !Number.isInteger(iterations) || iterations < 100_000 || iterations > 10_000_000) {
    throw new Error("El archivo no es un backup cifrado válido");
  }
  return td.decode(await open(await deriveKek(password, fromB64(f.salt), iterations), f.data, AAD_BACKUP));
}

// ---------- contraseña ----------
const COMMON = new Set([
  "password", "contraseña", "contrasena", "12345678", "123456789", "1234567890", "qwerty123", "qwertyui",
  "11111111", "00000000", "abc12345", "bolsillo", "bolsillo1", "iloveyou", "aaaaaaaa", "asdfghjk", "password1",
]);

/** Fuerza de la contraseña: ok = se puede usar; score 0..4 para el indicador. */
export function passwordStrength(pw: string): { ok: boolean; score: 0 | 1 | 2 | 3 | 4; label: string; hint?: string } {
  if (pw.length < 8) return { ok: false, score: 0, label: "Muy corta", hint: "Usá al menos 8 caracteres." };
  if (/^\d+$/.test(pw) && pw.length < 14) {
    return { ok: false, score: 0, label: "PIN muy fácil", hint: "Un número se adivina rápido: sumá letras o usá 14 números o más." };
  }
  if (COMMON.has(pw.toLowerCase()) || /^(.)\1+$/.test(pw)) {
    return { ok: false, score: 0, label: "Muy común", hint: "Esa contraseña es de las primeras que se prueban." };
  }
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/\d/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
  const bits = pw.length * Math.log2(pool || 1);
  // Débil no se acepta: con los archivos copiados, una clave así se adivina en minutos aunque haya PBKDF2
  if (bits < 45) return { ok: false, score: 1, label: "Débil", hint: "Hacela más larga: probá con una frase de 3 o 4 palabras." };
  if (bits < 60) return { ok: true, score: 2, label: "Aceptable" };
  if (bits < 80) return { ok: true, score: 3, label: "Buena" };
  return { ok: true, score: 4, label: "Muy buena" };
}

// ---------- intentos fallidos ----------
export const FREE_ATTEMPTS = 5;
export const WIPE_AFTER_ATTEMPTS = 10;
const DELAYS = [30_000, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

/** Espera después de N intentos fallidos: nada hasta 4; 30 s, 1 min, 5 min, 15 min y 1 h como máximo. */
export function lockoutDelayMs(failedAttempts: number): number {
  if (failedAttempts < FREE_ATTEMPTS) return 0;
  return DELAYS[Math.min(failedAttempts - FREE_ATTEMPTS, DELAYS.length - 1)];
}
