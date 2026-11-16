import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { DollarType } from "../types";
import { DOLLAR_LABELS, fetchQuote, Quote, usdToArs } from "../lib/dollars";
import { formatAmountInput, formatCurrency, formatLocalDate, formatNumberWithDots, formatShortDate } from "../lib/format";

/**
 * Cotización para algo en dólares: se escribe a mano o se busca UNA vez con "Cotización del día".
 * Queda fija (con su fecha) hasta que la persona la cambie.
 */
export function QuoteField({
  usd,
  value,
  onChange,
  dollarType,
  isLight,
  buttonLabel = "Cotización del día",
}: {
  usd: number;
  value: Quote | null;
  onChange: (q: Quote | null) => void;
  dollarType: DollarType;
  isLight?: boolean;
  buttonLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = `flex-1 min-w-0 text-xs font-bold px-2.5 py-1.5 rounded-lg border focus:outline-none ${
    isLight ? "bg-zinc-100 border-zinc-300 text-black" : "bg-zinc-900 border-zinc-700 text-white"
  }`;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold opacity-75">Cotización ($ por dólar)</label>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          aria-label="Cotización en pesos por dólar"
          placeholder="Ej. 1.500"
          value={value ? formatNumberWithDots(value.rate) : ""}
          onChange={(e) => {
            const rate = parseInt(formatAmountInput(e.target.value).replace(/\./g, ""), 10) || 0;
            onChange(rate ? { rate, date: formatLocalDate(new Date()), type: value?.type ?? dollarType } : null);
          }}
          className={input}
        />
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              onChange(await fetchQuote(dollarType));
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
          className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold border cursor-pointer disabled:opacity-60 ${
            isLight ? "bg-white border-zinc-300 hover:bg-zinc-100" : "bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
          }`}
        >
          <RefreshCw size={12} className={busy ? "animate-spin" : ""} />
          {busy ? "Buscando…" : buttonLabel}
        </button>
      </div>
      {value && (
        <span className={`text-[11px] font-bold tabular-numbers ${isLight ? "text-zinc-700" : "text-zinc-300"}`}>
          1 USD = {formatCurrency(value.rate)} → {usd || 0} USD = {formatCurrency(usdToArs(usd || 0, value.rate))}
          <span className="opacity-75"> · {DOLLAR_LABELS[value.type]} del {formatShortDate(value.date)}</span>
        </span>
      )}
      {error && (
        <span role="alert" className="text-[11px] font-bold text-[#DC2626]">
          {error}
        </span>
      )}
    </div>
  );
}
