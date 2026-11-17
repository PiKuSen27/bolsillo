import { motion } from "motion/react";
import { DOLLAR_LABELS, fetchQuote, Quote, usdToArs } from "../lib/dollars";
import { DollarType } from "../types";
import { TrendingUp, TrendingDown, ChevronRight, CalendarDays, Eye, EyeOff, PieChart } from "lucide-react";
import { BalanceSummary } from "../lib/balance";
import type { spendingPlan } from "../lib/spending";
import { useState } from "react";
import { AnimatedNumber } from "./AnimatedNumber";
import { formatAmountInput, formatCurrency, formatLocalDate, formatShortDate, formatUsd } from "../lib/format";

interface HeroProps {
  summary: BalanceSummary;
  plan: ReturnType<typeof spendingPlan>; // Podés gastar = (Disponible − fijos por vencer − ahorro) ÷ días
  previousBalance?: number | null; // saldo con el que cerró el período anterior (informativo)
  daysRemaining: number;
  isLight?: boolean;
  onOpenMovements: () => void;
  onOpenWorkDays?: () => void; // solo en modo variable
  onOpenSummary?: () => void;
  amountsHidden?: boolean;
  onToggleHidden?: () => void; // el ojo: tapa todos los montos de la app
  /** Pestaña Dólares (solo con "Usar dólares"): ahorros separados del Disponible */
  dollars?: {
    tab: "ARS" | "USD";
    onTab: (t: "ARS" | "USD") => void;
    balance: number;
    quote?: Quote;
    dollarType: DollarType;
    onQuote: (q: Quote) => void;
    onOpenHistory: () => void;
    onTrade: (kind: "buy" | "sell") => void;
  };
}

export function Hero({ summary, plan, previousBalance, daysRemaining, isLight, onOpenMovements, onOpenWorkDays, onOpenSummary, amountsHidden, onToggleHidden, dollars }: HeroProps) {
  const usd = dollars?.tab === "USD";
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteMsg, setQuoteMsg] = useState<string | null>(null);
  const [manualRate, setManualRate] = useState<string | null>(null);
  const isPositive = summary.available >= 0;
  const [explain, setExplain] = useState(false);

  return (
    <div
      data-tour="hero"
      role="button"
      tabIndex={0}
      onClick={usd ? dollars!.onOpenHistory : onOpenMovements}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") (usd ? dollars!.onOpenHistory : onOpenMovements)();
      }}
      // Sin escala ni cambio de fondo al tocar: en WebKitGTK el transform dejaba el texto borroso
      className={`w-full rounded-2xl p-3.5 flex flex-col gap-2 [@media(max-width:479px)_and_(max-height:700px)]:p-3 [@media(max-width:479px)_and_(max-height:700px)]:gap-1 cursor-pointer relative select-none border ${
        isLight
          ? "bg-[#F4F4F5] border-[#E4E4E7] text-black shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)]"
          : "bg-[#0D0D0E] border-[#262626] text-white"
      }`}
    >
      {dollars && (
        <div
          role="tablist"
          aria-label="Moneda"
          onClick={(e) => e.stopPropagation()}
          className={`self-start relative flex p-0.5 rounded-xl border ${isLight ? "bg-zinc-200/70 border-zinc-300" : "bg-black border-[#262626]"}`}
        >
          {(["ARS", "USD"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={dollars.tab === t}
              onClick={() => dollars.onTab(t)}
              className="relative px-3 py-0.5 text-[11px] font-extrabold cursor-pointer"
            >
              {dollars.tab === t && (
                <motion.span
                  layoutId="heroCurrencyTab"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className={`absolute inset-0 rounded-lg ${isLight ? "bg-white shadow-xs" : "bg-zinc-800"}`}
                />
              )}
              <span className={`relative ${dollars.tab === t ? "" : isLight ? "text-zinc-600" : "text-zinc-400"}`}>{t === "ARS" ? "Pesos" : "Dólares"}</span>
            </button>
          ))}
        </div>
      )}

      {usd && dollars ? (
        <motion.div
          key="usd"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] font-extrabold tracking-wider uppercase ${isLight ? "text-zinc-500" : "text-zinc-400"}`}>Ahorros en dólares</span>
            {onToggleHidden && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleHidden();
              }}
              aria-label={amountsHidden ? "Mostrar montos" : "Ocultar montos"}
              aria-pressed={!!amountsHidden}
              className={`p-1 -m-1 rounded-md cursor-pointer ${
                isLight ? "text-zinc-500 hover:text-black hover:bg-zinc-200" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {amountsHidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
          </div>
          <span className="text-3xl font-extrabold tracking-tight tabular-numbers">{formatUsd(dollars.balance)}</span>
          <span className={`text-[11px] font-bold tabular-numbers ${isLight ? "text-zinc-500" : "text-zinc-400"}`}>
            {dollars.quote
              ? `≈ ${formatCurrency(usdToArs(dollars.balance, dollars.quote.rate))} a ${formatCurrency(dollars.quote.rate)} del ${formatShortDate(dollars.quote.date)} (${DOLLAR_LABELS[dollars.quote.type]})`
              : "Sin cotización: tocá \"Cotización del día\" o escribila"}
          </span>
          <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={quoteBusy}
              onClick={async () => {
                setQuoteBusy(true);
                setQuoteMsg(null);
                try {
                  dollars.onQuote(await fetchQuote(dollars.dollarType));
                } catch (e) {
                  setQuoteMsg(e instanceof Error ? e.message : String(e));
                } finally {
                  setQuoteBusy(false);
                }
              }}
              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border cursor-pointer disabled:opacity-60 ${isLight ? "bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-100" : "bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800"}`}
            >
              {quoteBusy ? "Buscando…" : "Cotización del día"}
            </button>
            {manualRate === null ? (
              <button type="button" onClick={() => setManualRate("")} className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border cursor-pointer disabled:opacity-60 ${isLight ? "bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-100" : "bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800"}`}>
                Escribirla
              </button>
            ) : (
              <span className="flex items-center gap-1">
                <input
                  autoFocus
                  inputMode="numeric"
                  aria-label="Cotización en pesos por dólar"
                  placeholder="$ por dólar"
                  value={manualRate}
                  onChange={(e) => setManualRate(formatAmountInput(e.target.value))}
                  className={`w-24 px-2 py-0.5 rounded-lg border text-[11px] font-bold focus:outline-none ${isLight ? "bg-white border-zinc-300" : "bg-zinc-900 border-zinc-700"}`}
                />
                <button
                  type="button"
                  className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border cursor-pointer disabled:opacity-60 ${isLight ? "bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-100" : "bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800"}`}
                  onClick={() => {
                    const rate = parseInt(manualRate.replace(/\./g, ""), 10) || 0;
                    if (rate) dollars.onQuote({ rate, date: formatLocalDate(new Date()), type: dollars.dollarType });
                    setManualRate(null);
                  }}
                >
                  Listo
                </button>
              </span>
            )}
          </div>
          {quoteMsg && (
            <span role="alert" className="text-[11px] font-bold text-[#DC2626]">
              {quoteMsg}
            </span>
          )}
          <div className={`pt-1.5 flex flex-wrap gap-1.5 border-t ${isLight ? "border-zinc-200" : "border-[#202022]"}`} onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => dollars.onTrade("buy")} className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border cursor-pointer disabled:opacity-60 ${isLight ? "bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-100" : "bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800"}`}>Compré dólares</button>
            <button type="button" onClick={() => dollars.onTrade("sell")} className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border cursor-pointer disabled:opacity-60 ${isLight ? "bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-100" : "bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800"}`}>Vendí dólares</button>
            <button type="button" onClick={dollars.onOpenHistory} className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border cursor-pointer disabled:opacity-60 ${isLight ? "bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-100" : "bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800"}`}>Historial</button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="ars"
          initial={dollars ? { opacity: 0, x: -24 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="flex flex-col gap-2 [@media(max-width:479px)_and_(max-height:700px)]:gap-1"
        >
      {/* Top row: Label & Today delta */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[11px] font-extrabold tracking-wider uppercase ${
              isLight ? "text-zinc-500" : "text-zinc-400"
            }`}
          >
            Disponible
          </span>
          {onToggleHidden && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleHidden();
              }}
              aria-label={amountsHidden ? "Mostrar montos" : "Ocultar montos"}
              aria-pressed={!!amountsHidden}
              title={amountsHidden ? "Mostrar montos" : "Ocultar montos"}
              className={`p-1 -m-1 rounded-md cursor-pointer ${
                isLight ? "text-zinc-500 hover:text-black hover:bg-zinc-200" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {amountsHidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs font-bold tabular-numbers">
          {summary.todayMovementNet > 0 ? (
            <span
              className={`flex items-center gap-0.5 ${
                isLight ? "text-[#16A34A]" : "text-[#22C55E]"
              }`}
            >
              <TrendingUp size={13} /> hoy +{formatCurrency(summary.todayMovementNet)}
            </span>
          ) : summary.todayMovementNet < 0 ? (
            <span
              className={`flex items-center gap-0.5 ${
                isLight ? "text-[#DC2626]" : "text-[#EF4444]"
              }`}
            >
              <TrendingDown size={13} /> hoy -{formatCurrency(Math.abs(summary.todayMovementNet))}
            </span>
          ) : (
            <span className={isLight ? "text-zinc-400" : "text-zinc-500"}>
              hoy $ 0
            </span>
          )}
          <ChevronRight
            size={14}
            className={`transition-colors ${
              isLight ? "text-zinc-400" : "text-zinc-600"
            }`}
          />
        </div>
      </div>

      {previousBalance != null && previousBalance !== 0 && (
        <div
          className={`self-start px-2 py-0.5 rounded-md text-[10px] font-extrabold tabular-numbers ${
            previousBalance > 0
              ? isLight
                ? "bg-[#DCFCE7] text-[#15803D]"
                : "bg-[#052E16] text-[#4ADE80]"
              : isLight
              ? "bg-[#FEE2E2] text-[#B91C1C]"
              : "bg-[#450A0A] text-[#F87171]"
          }`}
        >
          {previousBalance > 0
            ? `Empezaste con ${formatCurrency(previousBalance)} a favor`
            : `Cerraste el período anterior ${formatCurrency(Math.abs(previousBalance))} abajo`}
        </div>
      )}

      {/* Main big balance (Blanco Puro en dark, Negro Puro en light, o Rojo sobrio si es negativo) */}
      <div className="flex items-baseline justify-between">
        <AnimatedNumber
          value={summary.available}
          className={`text-3xl [@media(max-width:479px)_and_(max-height:700px)]:text-2xl font-extrabold tracking-tight ${
            !isPositive
              ? isLight
                ? "text-[#DC2626]"
                : "text-[#EF4444]"
              : isLight
              ? "text-black"
              : "text-white"
          }`}
        />
      </div>

      {/* Progress Bar of month spent */}
      <div className="w-full flex flex-col gap-1">
        <div
          className={`w-full h-1.5 rounded-full overflow-hidden ${
            isLight ? "bg-zinc-200" : "bg-zinc-800"
          }`}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${summary.spentPercentage}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`h-full rounded-full ${
              summary.spentPercentage > 90
                ? isLight
                  ? "bg-[#DC2626]"
                  : "bg-[#EF4444]"
                : summary.spentPercentage > 70
                ? "bg-[#D97706]"
                : isLight
                ? "bg-[#16A34A]"
                : "bg-[#22C55E]"
            }`}
          />
        </div>
        <div
          className={`flex items-center justify-between text-[11px] font-extrabold ${
            isLight ? "text-zinc-500" : "text-zinc-400"
          }`}
        >
          <span className="tabular-numbers tracking-tight">
            Plata total: {formatCurrency(summary.totalIncome)} · Gastos: {formatCurrency(summary.totalExpenses)}
          </span>
          <span className="tabular-numbers">{summary.spentPercentage}% gastado</span>
        </div>
      </div>

      {plan.savings > 0 && (
        <span className={`-mt-1 text-[11px] font-extrabold tabular-numbers ${isLight ? "text-[#15803D]" : "text-[#4ADE80]"}`}>
          Guardando {formatCurrency(plan.savings)}
        </span>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {summary.incomeMode === "daily" && onOpenWorkDays && (
          <button
            data-tour="workdays"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenWorkDays();
            }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border cursor-pointer transition-colors ${
            isLight ? "bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-100" : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          }`}
          >
            <CalendarDays size={11} />
            <span>Días trabajados</span>
            <ChevronRight size={11} />
          </button>
        )}
        {onOpenSummary && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSummary();
            }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border cursor-pointer transition-colors ${
            isLight ? "bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-100" : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          }`}
          >
            <PieChart size={11} />
            <span>Resumen</span>
            <ChevronRight size={11} />
          </button>
        )}
      </div>

      {/* Suggested Daily Budget Highlight */}
      <div
        className={`pt-1.5 flex items-center justify-between text-xs font-semibold border-t ${
          isLight ? "border-zinc-200" : "border-[#202022]"
        }`}
      >
        <button
          type="button"
          aria-expanded={explain}
          onClick={(e) => {
            e.stopPropagation(); // no abrir Movimientos
            setExplain(!explain);
          }}
          className={`text-left cursor-pointer underline decoration-dotted underline-offset-4 ${isLight ? "text-zinc-600 decoration-zinc-400" : "text-zinc-300 decoration-zinc-600"}`}
        >
          Podés gastar{" "}
          <strong
            className={`font-extrabold tabular-numbers ${
              isLight ? "text-black" : "text-white"
            }`}
          >
            {formatCurrency(plan.perDay)}
          </strong>
          /día
        </button>
        <div
          className={`text-[11px] font-bold ${
            isLight ? "text-zinc-400" : "text-zinc-500"
          }`}
        >
          {daysRemaining} {daysRemaining === 1 ? "día restante" : "días restantes"}
        </div>
      </div>
      {explain && (
        <p
          role="note"
          onClick={(e) => e.stopPropagation()}
          className={`text-[11px] font-semibold leading-relaxed tabular-numbers cursor-default ${isLight ? "text-zinc-600" : "text-zinc-300"}`}
        >
          Disponible {formatCurrency(plan.available)}
          {plan.commitments > 0 && <> − fijos y cuotas por vencer {formatCurrency(plan.commitments)}</>}
          {plan.savings > 0 && <> − ahorro {formatCurrency(plan.savings)}</>} = {formatCurrency(Math.max(0, plan.spendable))}, dividido{" "}
          {Math.max(1, daysRemaining)} {Math.max(1, daysRemaining) === 1 ? "día" : "días"} = {formatCurrency(plan.perDay)} por día.
        </p>
      )}
        </motion.div>
      )}
    </div>
  );
}
