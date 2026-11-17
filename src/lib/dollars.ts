import { Debt, DollarMove, DollarType, Movement } from "../types";
import { formatLocalDate } from "./format";

/** Único servicio externo de la app (dolarapi.com, gratuito). Solo se usa al tocar "Cotización del día". */
export const QUOTE_API = "https://dolarapi.com/v1/dolares/";
export const DOLLAR_LABELS: Record<DollarType, string> = { oficial: "Oficial", blue: "Blue", bolsa: "MEP" };

export interface Quote {
  rate: number; // pesos por dólar (venta), entero
  date: string; // YYYY-MM-DD
  type: DollarType;
}

export function parseQuote(json: unknown, type: DollarType): Quote {
  const o = (json ?? {}) as { venta?: unknown; fechaActualizacion?: unknown };
  const venta = Number(o.venta);
  if (typeof o.venta !== "number" || !isFinite(venta) || venta <= 0 || venta > 1e7) {
    throw new Error("La cotización que llegó no es válida. Escribila a mano.");
  }
  const d = typeof o.fechaActualizacion === "string" ? new Date(o.fechaActualizacion) : new Date();
  return { rate: Math.round(venta), date: formatLocalDate(isNaN(d.getTime()) ? new Date() : d), type };
}

/** Pide la cotización de venta UNA vez. Sin internet o con error, el mensaje invita a escribirla a mano. */
export async function fetchQuote(type: DollarType, fetchImpl: typeof fetch = fetch): Promise<Quote> {
  let res: Response;
  try {
    res = await fetchImpl(`${QUOTE_API}${type}`, { signal: AbortSignal.timeout?.(8000), cache: "no-store" });
  } catch {
    throw new Error("No se pudo conectar. Revisá internet o escribí la cotización a mano.");
  }
  if (!res.ok) throw new Error("El servicio de cotizaciones no respondió. Escribí la cotización a mano.");
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("La cotización que llegó no es válida. Escribila a mano.");
  }
  return parseQuote(json, type);
}

export const usdToArs = (usd: number, rate: number) => Math.round(usd * rate);

/** Valor en pesos de una cantidad en la moneda de la deuda (con la cotización guardada en esa deuda). */
export const debtUnitsToArs = (d: Pick<Debt, "currency" | "rate">, units: number) =>
  d.currency === "USD" ? usdToArs(units, d.rate ?? 0) : units;

/** Lo ya pagado de la deuda (en su moneda). */
export const debtPaid = (d: Debt) => (d.payments ?? []).reduce((s, p) => s + p.amount, 0);

/** Saldo de la deuda en su moneda (lo que falta pagar). */
export const debtBalance = (d: Debt) => Math.max(0, d.amount - debtPaid(d));

/** Saldo de la deuda en pesos. */
export const debtArs = (d: Debt) => debtUnitsToArs(d, debtBalance(d));

// ---------- ahorros en dólares ----------
/** Categoría especial (no editable) del gasto en pesos al comprar dólares. */
export const USD_BUY_CATEGORY = { id: "compra_usd", name: "Compra de dólares", icon: "DollarSign", color: "#0F766E" };

export const usdBalance = (moves: DollarMove[]) => moves.reduce((s, m) => s + (m.kind === "in" ? m.amount : -m.amount), 0);

/** Mensaje si se quieren sacar más dólares de los que hay; null si se puede. */
export function checkUsdOut(balance: number, amount: number): string | null {
  return amount > balance ? `No te alcanzan: tenés USD ${balance}.` : null;
}

interface Trade {
  usd: number;
  pesos?: number; // lo que se pagó o cobró
  rate?: number; // o la cotización
  date: string;
  id: string;
  note?: string;
}

function tradeValues(t: Trade) {
  const usd = Math.round(t.usd);
  if (!(usd > 0)) throw new Error("Escribí cuántos dólares");
  const pesos = t.pesos && t.pesos > 0 ? Math.round(t.pesos) : t.rate && t.rate > 0 ? usdToArs(usd, t.rate) : 0;
  if (!pesos) throw new Error("Escribí cuántos pesos o la cotización");
  return { usd, pesos, rate: Math.round(pesos / usd) };
}

const nowIso = () => new Date().toISOString();

/** "Compré dólares": suma USD a los ahorros y resta los pesos del Disponible como gasto. */
export function buyDollars(t: Trade): { move: DollarMove; movement: Movement } {
  const { usd, pesos, rate } = tradeValues(t);
  const move: DollarMove = { id: `usd_${t.id}`, date: t.date, amount: usd, kind: "in", source: "buy", rate, pesos, note: t.note, movementId: `mov_usd_${t.id}`, createdAt: nowIso() };
  const movement: Movement = {
    id: `mov_usd_${t.id}`, date: t.date, amount: pesos, kind: "expense", categoryId: USD_BUY_CATEGORY.id,
    note: `Compra de USD ${usd}`, source: "manual", usdId: move.id, createdAt: move.createdAt,
  };
  return { move, movement };
}

/** "Vendí dólares": resta USD de los ahorros y suma los pesos al Disponible como ingreso. */
export function sellDollars(t: Trade): { move: DollarMove; movement: Movement } {
  const { usd, pesos, rate } = tradeValues(t);
  const move: DollarMove = { id: `usd_${t.id}`, date: t.date, amount: usd, kind: "out", source: "sell", rate, pesos, note: t.note, movementId: `mov_usd_${t.id}`, createdAt: nowIso() };
  const movement: Movement = {
    id: `mov_usd_${t.id}`, date: t.date, amount: pesos, kind: "income", categoryId: "income",
    note: `Venta de USD ${usd}`, source: "manual", usdId: move.id, createdAt: move.createdAt,
  };
  return { move, movement };
}

/**
 * ¿Editar (edited) o borrar (removeId) un movimiento en dólares deja el saldo negativo?
 * Devuelve el mensaje para mostrar, o null si se puede.
 */
export function checkUsdChange(moves: DollarMove[], edited: DollarMove | null, removeId?: string): string | null {
  const next = moves.filter((m) => m.id !== removeId).map((m) => (edited && m.id === edited.id ? edited : m));
  const bal = usdBalance(next);
  return bal < 0 ? `No se puede: tus dólares quedarían en negativo (USD ${bal}).` : null;
}

/** Al editar en pesos el movimiento de una compra/venta, la compra/venta guarda los pesos y la cotización nuevos. */
export const syncTradePesos = (m: DollarMove, pesos: number): DollarMove => ({ ...m, pesos, rate: Math.round(pesos / m.amount) });
