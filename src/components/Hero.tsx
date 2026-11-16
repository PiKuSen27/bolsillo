import { motion } from "motion/react";
import { TrendingUp, TrendingDown, ChevronRight, CalendarDays, Eye, EyeOff } from "lucide-react";
import { BalanceSummary } from "../lib/balance";
import type { spendingPlan } from "../lib/spending";
import { useState } from "react";
import { AnimatedNumber } from "./AnimatedNumber";
import { formatCurrency } from "../lib/format";

interface HeroProps {
  summary: BalanceSummary;
  plan: ReturnType<typeof spendingPlan>; // Podés gastar = (Disponible − fijos por vencer − ahorro) ÷ días
  previousBalance?: number | null; // saldo con el que cerró el período anterior (informativo)
  daysRemaining: number;
  isLight?: boolean;
  onOpenMovements: () => void;
  onOpenWorkDays?: () => void; // solo en modo variable
  amountsHidden?: boolean;
  onToggleHidden?: () => void; // el ojo: tapa todos los montos de la app
}

export function Hero({ summary, plan, previousBalance, daysRemaining, isLight, onOpenMovements, onOpenWorkDays, amountsHidden, onToggleHidden }: HeroProps) {
  const isPositive = summary.available >= 0;
  const [explain, setExplain] = useState(false);

  return (
    <div
      data-tour="hero"
      role="button"
      tabIndex={0}
      onClick={onOpenMovements}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpenMovements();
      }}
      // Sin escala ni cambio de fondo al tocar: en WebKitGTK el transform dejaba el texto borroso
      className={`w-full rounded-2xl p-3.5 flex flex-col gap-2 [@media(max-width:479px)_and_(max-height:700px)]:p-3 [@media(max-width:479px)_and_(max-height:700px)]:gap-1 cursor-pointer relative select-none border ${
        isLight
          ? "bg-[#F4F4F5] border-[#E4E4E7] text-black shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)]"
          : "bg-[#0D0D0E] border-[#262626] text-white"
      }`}
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

      {summary.incomeMode === "daily" && onOpenWorkDays && (
        <button
          data-tour="workdays"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenWorkDays();
          }}
          className={`self-start flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border cursor-pointer transition-colors ${
            isLight
              ? "bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-100"
              : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          <CalendarDays size={11} />
          <span>Días trabajados</span>
          <ChevronRight size={11} />
        </button>
      )}

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
    </div>
  );
}
