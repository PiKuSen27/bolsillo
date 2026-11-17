import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Edit2, Trash2 } from "lucide-react";
import { DollarMove, DollarType } from "../types";
import { QuoteField } from "../components/QuoteField";
import { DateField } from "../components/DateField";
import { Quote, usdToArs } from "../lib/dollars";
import { formatAmountInput, formatCurrency, formatNumberWithDots, formatShortDate, formatUsd } from "../lib/format";

const field = (isLight?: boolean) =>
  `w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border focus:outline-none ${
    isLight ? "bg-zinc-100 border-zinc-300 text-black" : "bg-zinc-900 border-zinc-700 text-white"
  }`;
const primary = (isLight?: boolean) =>
  `px-4 py-1.5 rounded-xl font-extrabold text-xs cursor-pointer disabled:opacity-50 ${
    isLight ? "bg-black text-white hover:bg-zinc-800" : "bg-white text-black hover:bg-zinc-200"
  }`;
const num = (s: string) => parseInt(s.replace(/\./g, ""), 10) || 0;

/** Historial de los ahorros en dólares, con editar y borrar. */
export function DollarsPanel({
  moves,
  isLight,
  onUpdate,
  onDelete,
}: {
  moves: DollarMove[];
  isLight?: boolean;
  onUpdate: (m: DollarMove) => void;
  onDelete: (m: DollarMove) => void;
}) {
  const [editing, setEditing] = useState<{ id: string; amount: string; note: string } | null>(null);
  const muted = isLight ? "text-zinc-600" : "text-zinc-400";
  const card = isLight ? "bg-white border-zinc-200" : "bg-[#0E0E10] border-[#222224]";

  if (moves.length === 0) {
    return <p className={`py-8 text-center text-xs font-bold ${muted}`}>Todavía no anotaste dólares. Usá la calculadora en "Dólares" o "Compré dólares".</p>;
  }

  return (
    <div className="flex flex-col gap-1.5 select-none">
      {moves.map((m) => {
        const isIn = m.kind === "in";
        const label =
          m.source === "buy"
            ? `Compra · pagaste ${formatCurrency(m.pesos ?? 0)} (a ${formatCurrency(m.rate ?? 0)})`
            : m.source === "sell"
            ? `Venta · cobraste ${formatCurrency(m.pesos ?? 0)} (a ${formatCurrency(m.rate ?? 0)})`
            : m.note || (isIn ? "Ingresé dólares" : "Saqué dólares");
        if (editing?.id === m.id) {
          return (
            <div key={m.id} className={`p-3 rounded-2xl border flex flex-col gap-2 ${card}`}>
              <div className="grid grid-cols-2 gap-2">
                <input aria-label="Dólares" inputMode="numeric" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: formatAmountInput(e.target.value) })} className={field(isLight)} />
                <input aria-label="Nota" placeholder="Nota" value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} className={field(isLight)} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(null)} className="px-3 py-1 text-xs font-bold opacity-75 cursor-pointer">Cancelar</button>
                <button
                  type="button"
                  className={primary(isLight)}
                  onClick={() => {
                    const amount = num(editing.amount);
                    if (amount > 0) onUpdate({ ...m, amount, note: editing.note.trim() || undefined });
                    setEditing(null);
                  }}
                >
                  Guardar
                </button>
              </div>
            </div>
          );
        }
        return (
          <div key={m.id} className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${card}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isIn ? "bg-emerald-500/15 text-[#16A34A]" : "bg-red-500/15 text-[#EF4444]"}`}>
                {isIn ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
              </span>
              <span className="flex flex-col min-w-0">
                <span className="text-xs font-extrabold break-words">{label}</span>
                <span className={`text-[10px] font-bold ${muted}`}>{formatShortDate(m.date)}</span>
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className={`text-sm font-extrabold tabular-numbers ${isIn ? "text-[#16A34A]" : "text-[#EF4444]"}`}>
                {isIn ? "+ " : "− "}
                {formatUsd(m.amount)}
              </span>
              {m.source === "manual" && (
                <button
                  type="button"
                  aria-label="Editar"
                  onClick={() => setEditing({ id: m.id, amount: formatNumberWithDots(m.amount), note: m.note ?? "" })}
                  className={`p-1 rounded-md cursor-pointer ${isLight ? "text-zinc-500 hover:text-black" : "text-zinc-400 hover:text-white"}`}
                >
                  <Edit2 size={13} />
                </button>
              )}
              <button type="button" aria-label="Borrar" onClick={() => onDelete(m)} className={`p-1 rounded-md hover:text-red-500 cursor-pointer ${isLight ? "text-zinc-500" : "text-zinc-400"}`}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** "Compré dólares" / "Vendí dólares": dólares y lo que se pagó/cobró en pesos (o la cotización). */
export function DollarTradeForm({
  kind,
  defaultDate,
  dollarType,
  quote: initialQuote,
  isLight,
  onSubmit,
}: {
  kind: "buy" | "sell";
  defaultDate: string;
  dollarType: DollarType;
  quote?: Quote;
  isLight?: boolean;
  onSubmit: (t: { usd: number; pesos?: number; rate?: number; date: string; note?: string }) => Promise<string | null>;
}) {
  const [usd, setUsd] = useState("");
  const [pesos, setPesos] = useState("");
  const [quote, setQuote] = useState<Quote | null>(initialQuote ?? null);
  const [date, setDate] = useState(defaultDate);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const usdN = num(usd);
  const pesosN = num(pesos) || (quote ? usdToArs(usdN, quote.rate) : 0);
  const buy = kind === "buy";

  return (
    <div className="flex flex-col gap-3 select-none">
      <p className={`text-[11px] font-bold ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>
        {buy
          ? "Suma los dólares a tus ahorros y resta los pesos de tu Disponible (como gasto \"Compra de dólares\")."
          : "Resta los dólares de tus ahorros y suma los pesos a tu Disponible (como ingreso)."}
      </p>
      <label className="flex flex-col gap-1 text-[10px] font-bold opacity-90">
        Dólares
        <input aria-label="Dólares" inputMode="numeric" placeholder="Ej. 100" value={usd} onChange={(e) => setUsd(formatAmountInput(e.target.value))} className={field(isLight)} />
      </label>
      <QuoteField usd={usdN} value={quote} onChange={setQuote} dollarType={dollarType} isLight={isLight} />
      <label className="flex flex-col gap-1 text-[10px] font-bold opacity-90">
        {buy ? "O lo que pagaste en pesos" : "O lo que cobraste en pesos"}
        <input aria-label="Pesos" inputMode="numeric" placeholder="Ej. 150.000" value={pesos} onChange={(e) => setPesos(formatAmountInput(e.target.value))} className={field(isLight)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[10px] font-bold opacity-90">
          Fecha
          <DateField ariaLabel="Fecha" value={date} onChange={setDate} isLight={isLight} />
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-bold opacity-90">
          Nota (opcional)
          <input aria-label="Nota" value={note} onChange={(e) => setNote(e.target.value)} className={field(isLight)} />
        </label>
      </div>
      {usdN > 0 && pesosN > 0 && (
        <p className={`text-xs font-extrabold tabular-numbers ${isLight ? "text-zinc-800" : "text-zinc-200"}`}>
          {buy ? `+ ${formatUsd(usdN)} a tus ahorros · − ${formatCurrency(pesosN)} del Disponible` : `− ${formatUsd(usdN)} de tus ahorros · + ${formatCurrency(pesosN)} al Disponible`}
        </p>
      )}
      {error && (
        <p role="alert" className="text-[11px] font-bold text-[#DC2626]">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!usdN || !pesosN}
        className={`${primary(isLight)} self-end`}
        onClick={async () => setError(await onSubmit({ usd: usdN, pesos: num(pesos) || undefined, rate: quote?.rate, date, note: note.trim() || undefined }))}
      >
        {buy ? "Guardar compra" : "Guardar venta"}
      </button>
    </div>
  );
}
