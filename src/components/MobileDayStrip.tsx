import { useState } from "react";
import { addDays } from "date-fns";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { Category, DayLog, Movement } from "../types";
import { formatDayShortWithNum, formatLocalDate, parseLocalDate } from "../lib/format";
import { isDayLogged } from "../lib/reminders";
import { DayDetailModal } from "./DayDetailModal";

interface MobileDayStripProps {
  todayStr: string;
  selectedDateStr: string;
  onSelectDate: (dateStr: string) => void;
  onMarkNoExpenses: (dateStr: string) => void;
  movements: Movement[];
  categories: Category[];
  dayLogs: DayLog[];
  isLight?: boolean;
  onDeleteMovement: (id: string) => void;
  onUpdateMovement: (m: Movement) => void;
}

export function MobileDayStrip({
  todayStr,
  selectedDateStr,
  onSelectDate,
  onMarkNoExpenses,
  movements,
  categories,
  dayLogs,
  isLight,
  onDeleteMovement,
  onUpdateMovement,
}: MobileDayStripProps) {
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [showAllDaysModal, setShowAllDaysModal] = useState(false);
  const today = parseLocalDate(todayStr);

  const allDays: {
    dateStr: string;
    label: string;
    status: "logged" | "unlogged" | "future";
    isToday: boolean;
    daysAgo: number;
  }[] = [];

  for (let i = 13; i >= 0; i--) {
    const d = addDays(today, -i);
    const dateStr = formatLocalDate(d);
    const label = formatDayShortWithNum(dateStr);
    const isToday = i === 0;

    let status: "logged" | "unlogged" | "future" = "future";
    if (d.getTime() <= today.getTime()) {
      status = isDayLogged(dateStr, movements, dayLogs) ? "logged" : "unlogged";
    }

    allDays.push({ dateStr, label, status, isToday, daysAgo: i });
  }

  const mainDays = allDays.slice(-4).reverse();
  const isTodayLogged = isDayLogged(todayStr, movements, dayLogs);

  return (
    <>
      <div data-tour="days" className="w-full flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 px-0.5 select-none shrink-0">
        {mainDays.map((item) => {
          const isSelected = item.dateStr === selectedDateStr;

          return (
            <button
              key={item.dateStr}
              type="button"
              onClick={() => setModalDate(item.dateStr)}
              className={`flex-1 min-w-[70px] py-1.5 px-2 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer border shrink-0 ${
                isSelected
                  ? isLight
                    ? "bg-zinc-300 border-zinc-400 text-black font-black ring-1 ring-zinc-400"
                    : "bg-[#222226] border-[#38383E] text-white font-black ring-1 ring-zinc-500"
                  : isLight
                  ? "bg-white border-[#E4E4E7] text-zinc-800 font-extrabold hover:bg-zinc-100"
                  : "bg-[#141416] border-[#202024] text-zinc-200 font-extrabold hover:bg-[#1A1A1E]"
              }`}
            >
              <div className="flex flex-col leading-tight">
                <span className="text-[11px] font-black tracking-tight">
                  {item.isToday ? "Hoy" : item.label}
                </span>
                <span
                  className={`text-[8px] font-extrabold ${
                    item.isToday
                      ? isLight
                        ? "text-[#16A34A]"
                        : "text-[#22C55E]"
                      : isLight
                      ? "text-zinc-500"
                      : "text-zinc-400"
                  }`}
                >
                  {item.isToday ? item.label : item.daysAgo === 1 ? "Ayer" : `hace ${item.daysAgo}d`}
                </span>
              </div>

              {item.status === "logged" ? (
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isLight ? "bg-[#16A34A]" : "bg-[#22C55E]"
                  }`}
                />
              ) : item.status === "unlogged" ? (
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 flex items-center justify-center text-[7px] font-black border ${
                    isLight
                      ? "border-[#DC2626] text-[#DC2626]"
                      : "border-[#EF4444] text-[#EF4444]"
                  }`}
                >
                  !
                </span>
              ) : null}
            </button>
          );
        })}

        {/* "+ Días" Button */}
        <button
          type="button"
          onClick={() => setShowAllDaysModal(true)}
          className={`py-1.5 px-2.5 rounded-xl text-[10px] font-black border flex items-center gap-1 shrink-0 cursor-pointer transition-all ${
            isLight
              ? "bg-zinc-200/80 border-zinc-300 text-zinc-700 hover:bg-zinc-300"
              : "bg-[#18181B] border-[#2A2A2E] text-zinc-300 hover:bg-[#222226]"
          }`}
        >
          <CalendarDays size={12} />
          <span>+ Días</span>
        </button>

        {!isTodayLogged && (
          <button
            type="button"
            onClick={() => onMarkNoExpenses(todayStr)}
            title="Hoy no gasté nada"
            className={`p-1.5 rounded-xl border flex items-center gap-1 shrink-0 cursor-pointer transition-all ${
              isLight
                ? "bg-emerald-50 border-emerald-300 text-[#16A34A]"
                : "bg-emerald-950/30 border-emerald-800 text-[#22C55E]"
            }`}
          >
            <CheckCircle2 size={13} />
            <span className="text-[10px] font-black">No gasté</span>
          </button>
        )}
      </div>

      {/* 14 Days History Modal */}
      {showAllDaysModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-[340px] max-h-[80vh] rounded-[22px] border p-4 flex flex-col shadow-2xl ${
              isLight
                ? "bg-[#FFFFFF] border-[#E4E4E7] text-black"
                : "bg-[#0D0D0E] border-[#262626] text-white"
            }`}
          >
            <div className={`flex items-center justify-between pb-3 border-b ${isLight ? "border-zinc-200" : "border-zinc-800"}`}>
              <span className="text-xs font-black">Historial de 14 días</span>
              <button
                type="button"
                onClick={() => setShowAllDaysModal(false)}
                className="text-xs font-black text-zinc-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-1.5 pr-1">
              {[...allDays].reverse().map((item) => (
                <button
                  key={item.dateStr}
                  type="button"
                  onClick={() => {
                    setShowAllDaysModal(false);
                    setModalDate(item.dateStr);
                  }}
                  className={`w-full p-2 rounded-xl border flex items-center justify-between text-left cursor-pointer ${
                    isLight
                      ? "bg-zinc-50 border-zinc-200 text-black hover:bg-zinc-100"
                      : "bg-[#141416] border-[#222226] text-white hover:bg-[#1A1A1E]"
                  }`}
                >
                  <span className="text-xs font-bold">
                    {item.label} {item.isToday && "(Hoy)"}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      item.status === "logged"
                        ? "bg-[#22C55E]"
                        : item.status === "unlogged"
                        ? "bg-[#EF4444]"
                        : "bg-zinc-600"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Day detail pop-up */}
      {modalDate && (
        <DayDetailModal
          isOpen={!!modalDate}
          onClose={() => setModalDate(null)}
          dateStr={modalDate}
          movements={movements}
          categories={categories}
          dayLogs={dayLogs}
          isLight={isLight}
          onSelectForEntry={(d) => {
            onSelectDate(d);
            setModalDate(null);
          }}
          onMarkNoExpenses={onMarkNoExpenses}
          onDeleteMovement={onDeleteMovement}
          onUpdateMovement={onUpdateMovement}
        />
      )}
    </>
  );
}
