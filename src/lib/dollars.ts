import { Debt, DollarType } from "../types";
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

/** Saldo de la deuda en su moneda (lo que falta pagar). */
export const debtBalance = (d: Debt) => d.amount;

/** Saldo de la deuda en pesos. */
export const debtArs = (d: Debt) => debtUnitsToArs(d, debtBalance(d));
