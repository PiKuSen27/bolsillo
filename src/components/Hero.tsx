import { motion } from "motion/react";
import { TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { BalanceSummary } from "../lib/balance";
import { AnimatedNumber } from "./AnimatedNumber";
import { formatCurrency } from "../lib/format";

interface HeroProps {
  summary: BalanceSummary;
  daysRemaining: number;
  isLight?: boolean;
  onOpenMovements: () => void;
}

export function Hero({ summary, daysRemaining, isLight, onOpenMovements }: HeroProps) {
  const isPositive = summary.available >= 0;

  return (
    <motion.div
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={onOpenMovements}
      className={`w-full rounded-[14px] p-3.5 flex flex-col gap-2 cursor-pointer transition-colors relative select-none border ${
        isLight
          ? "bg-[#F4F4F5] hover:bg-[#ECECEE] border-[#E4E4E7] text-black"
          : "bg-[#0D0D0E] hover:bg-[#141416] border-[#262626] text-white"
      }`}
    >
      {/* Top row: Label & Today delta */}
      <div className="flex items-center justify-between">
        <span
          className={`text-[11px] font-extrabold tracking-wider uppercase ${
            isLight ? "text-zinc-500" : "text-zinc-400"
          }`}
        >
          Disponible
        </span>

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

      {/* Main big balance (Blanco Puro en dark, Negro Puro en light, o Rojo sobrio si es negativo) */}
      <div className="flex items-baseline justify-between">
        <AnimatedNumber
          value={summary.available}
          className={`text-3xl font-extrabold tracking-tight ${
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

      {/* Suggested Daily Budget Highlight */}
      <div
        className={`pt-1.5 flex items-center justify-between text-xs font-semibold border-t ${
          isLight ? "border-zinc-200" : "border-[#202022]"
        }`}
      >
        <div className={isLight ? "text-zinc-600" : "text-zinc-300"}>
          Podés gastar{" "}
          <strong
            className={`font-extrabold tabular-numbers ${
              isLight ? "text-black" : "text-white"
            }`}
          >
            {formatCurrency(summary.dailySuggested)}
          </strong>
          /día
        </div>
        <div
          className={`text-[11px] font-bold ${
            isLight ? "text-zinc-400" : "text-zinc-500"
          }`}
        >
          {daysRemaining} {daysRemaining === 1 ? "día restante" : "días restantes"}
        </div>
      </div>
    </motion.div>
  );
}
