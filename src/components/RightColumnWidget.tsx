import { useState } from "react";
import { UpcomingItem, Debt } from "../types";
import { formatCurrency, formatRelativeDue, formatUsd } from "../lib/format";
import { debtBalance } from "../lib/dollars";

interface RightColumnWidgetProps {
  items: UpcomingItem[];
  debts: Debt[];
  isLight?: boolean;
  onOpenFixedAndInstallments: () => void;
  onOpenDebts: () => void;
  onSettleDebt: (debt: Debt) => void;
}

export function RightColumnWidget({
  items,
  debts,
  isLight,
  onOpenFixedAndInstallments,
  onOpenDebts,
  onSettleDebt,
}: RightColumnWidgetProps) {
  const [tab, setTab] = useState<"upcoming" | "debts">("upcoming");

  const displayItems = items.slice(0, 4);
  const activeDebts = debts.filter((d) => !d.settled).slice(0, 4);

  return (
    <div
      data-tour="debts"
      className={`w-36 h-full rounded-2xl p-2 flex flex-col justify-between overflow-hidden select-none border shrink-0 ${
        isLight
          ? "bg-[#F4F4F5] border-[#E4E4E7] text-black"
          : "bg-[#0D0D0E] border-[#262626] text-white"
      }`}
    >
      {/* Tabs Header */}
      <div
        className={`flex items-center p-0.5 rounded-lg border ${
          isLight ? "bg-zinc-200 border-zinc-300" : "bg-black border-[#222224]"
        }`}
      >
        <button
          type="button"
          onClick={() => setTab("upcoming")}
          className={`flex-1 py-0.5 text-center text-[10px] font-extrabold rounded-md transition-all cursor-pointer relative ${
            tab === "upcoming"
              ? isLight
                ? "bg-white text-black shadow-xs"
                : "bg-zinc-800 text-white"
              : isLight
              ? "text-zinc-600 hover:text-black"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Próximos
        </button>

        <button
          type="button"
          onClick={() => setTab("debts")}
          className={`flex-1 py-0.5 text-center text-[10px] font-extrabold rounded-md transition-all cursor-pointer relative ${
            tab === "debts"
              ? isLight
                ? "bg-white text-black shadow-xs"
                : "bg-zinc-800 text-white"
              : isLight
              ? "text-zinc-600 hover:text-black"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Deudas
          {activeDebts.length > 0 && (
            <span className="ml-1 px-1 rounded-full text-[8px] bg-red-500 text-white">
              {activeDebts.length}
            </span>
          )}
        </button>
      </div>

      {/* Content List */}
      <div className="flex-1 flex flex-col gap-1.5 py-1.5 overflow-y-auto scrollbar-none">
        {tab === "upcoming" ? (
          displayItems.length === 0 ? (
            <div
              className={`h-full flex flex-col items-center justify-center text-center text-[10px] font-semibold px-1 ${
                isLight ? "text-zinc-400" : "text-zinc-600"
              }`}
            >
              Sin pagos pendientes
            </div>
          ) : (
            displayItems.map((item) => {
              const isDueSoon = item.daysUntil <= 3 && item.daysUntil > 0;
              const isDueTodayOrOverdue = item.daysUntil <= 0;

              const badgeColor = isDueTodayOrOverdue
                ? isLight
                  ? "text-[#DC2626]"
                  : "text-[#EF4444]"
                : isDueSoon
                ? "text-amber-500"
                : isLight
                ? "text-zinc-500"
                : "text-zinc-400";

              return (
                <div
                  key={item.id}
                  className={`flex flex-col rounded-xl p-1.5 border transition-all ${
                    isLight
                      ? "bg-white border-zinc-200"
                      : "bg-[#050506] border-[#202022]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[10px] font-extrabold truncate max-w-[65px]"
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    <span className="text-[10px] font-extrabold tabular-numbers">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-0.5 text-[9px]">
                    <span className={`font-bold ${badgeColor}`}>
                      {formatRelativeDue(item.daysUntil)}
                    </span>

                    {item.progressText && (
                      <span
                        className={`text-[8px] font-semibold ${
                          isLight ? "text-zinc-400" : "text-zinc-500"
                        }`}
                      >
                        {item.progressText}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )
        ) : activeDebts.length === 0 ? (
          <div
            className={`h-full flex flex-col items-center justify-center text-center text-[10px] font-semibold px-1 ${
              isLight ? "text-zinc-400" : "text-zinc-600"
            }`}
          >
            No tenés deudas registradas
          </div>
        ) : (
          activeDebts.map((d) => (
            <div
              key={d.id}
              className={`flex flex-col rounded-xl p-1.5 border transition-all ${
                isLight
                  ? "bg-white border-zinc-200"
                  : "bg-[#050506] border-[#202022]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-extrabold truncate max-w-[65px]"
                  title={d.person}
                >
                  {d.person}
                </span>
                <span
                  className={`text-[10px] font-extrabold tabular-numbers ${
                    d.kind === "i_owe"
                      ? isLight
                        ? "text-[#DC2626]"
                        : "text-[#EF4444]"
                      : isLight
                      ? "text-[#16A34A]"
                      : "text-[#22C55E]"
                  }`}
                >
                  {d.currency === "USD" ? formatUsd(debtBalance(d)) : formatCurrency(debtBalance(d))}
                </span>
              </div>

              <div className="flex items-center justify-between mt-0.5 text-[9px]">
                <span
                  className={`font-bold ${
                    d.kind === "i_owe"
                      ? isLight
                        ? "text-red-700"
                        : "text-red-400"
                      : isLight
                      ? "text-emerald-700"
                      : "text-emerald-400"
                  }`}
                >
                  {d.kind === "i_owe" ? "Debo" : "Me deben"}
                </span>

                <button
                  type="button"
                  onClick={() => onSettleDebt(d)}
                  className={`text-[8px] font-bold px-1 rounded transition-colors cursor-pointer ${
                    isLight
                      ? "bg-zinc-200 hover:bg-zinc-300 text-black"
                      : "bg-zinc-800 hover:bg-zinc-700 text-white"
                  }`}
                >
                  Saldar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* "Ver todo" footer button */}
      <button
        type="button"
        onClick={tab === "upcoming" ? onOpenFixedAndInstallments : onOpenDebts}
        className={`w-full py-1 text-center text-[10px] font-extrabold rounded-lg transition-colors cursor-pointer ${
          isLight
            ? "hover:bg-zinc-200 text-zinc-600 hover:text-black"
            : "hover:bg-zinc-800 text-zinc-400 hover:text-white"
        }`}
      >
        Ver todo
      </button>
    </div>
  );
}
