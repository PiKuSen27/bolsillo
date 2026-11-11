import { useState } from "react";
import { addDays } from "date-fns";
import {
  Settings as SettingsIcon,
  Calendar as CalendarIcon,
  CheckCircle2,
  CalendarDays,
  X,
  ChevronRight,
} from "lucide-react";
import { Category, DayLog, Movement } from "../types";
import { formatDayShortWithNum, formatLocalDate, parseLocalDate } from "../lib/format";
import { isDayLogged } from "../lib/reminders";
import { DayDetailModal } from "./DayDetailModal";

interface DayStripProps {
  todayStr: string;
  selectedDateStr: string;
  onSelectDate: (dateStr: string) => void;
  onOpenSettings: () => void;
  onOpenCalendar: () => void;
  onMarkNoExpenses: (dateStr: string) => void;
  movements: Movement[];
  categories: Category[];
  dayLogs: DayLog[];
  isLight?: boolean;
}

export function DayStrip({
  todayStr,
  selectedDateStr,
  onSelectDate,
  onOpenSettings,
  onOpenCalendar,
  onMarkNoExpenses,
  movements,
  categories,
  dayLogs,
  isLight,
}: DayStripProps) {
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [showAllDaysModal, setShowAllDaysModal] = useState(false);
  const today = parseLocalDate(todayStr);

  // Generate 14 days (13 days ago to today)
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

  // Only top 4 days: Hoy + 3 previous days (i = 0, 1, 2, 3)
  // reverse allDays slice for order: Today, Ayer, 2 days ago, 3 days ago
  const mainDays = allDays.slice(-4).reverse();

  const isTodayLogged = isDayLogged(todayStr, movements, dayLogs);

  return (
    <>
      <div
        className={`w-28 h-full rounded-2xl p-2 flex flex-col items-center justify-between select-none border shrink-0 ${
          isLight
            ? "bg-[#F4F4F5] border-[#E4E4E7] text-black"
            : "bg-[#0D0D0E] border-[#262626] text-white"
        }`}
      >
        {/* Top: Enlarged 42x42 Settings Button */}
        <div className="w-full flex items-center justify-center pb-2 border-b border-white/5">
          <button
            type="button"
            onClick={onOpenSettings}
            title="Ajustes de la app"
            className={`w-[42px] h-[42px] rounded-[11px] border flex items-center justify-center transition-all duration-200 cursor-pointer group active:scale-95 ${
              isLight
                ? "bg-[#FFFFFF] border-[#D4D4D8] text-zinc-700 hover:text-black hover:border-zinc-400 hover:shadow-sm"
                : "bg-[#161618] border-[#2A2A2E] text-zinc-300 hover:text-white hover:border-zinc-500 hover:shadow-md"
            }`}
          >
            <SettingsIcon
              size={22}
              strokeWidth={2.5}
              className="transition-transform duration-300 group-hover:rotate-45"
            />
          </button>
        </div>

        {/* 4 Large Days: Hoy + 3 previous days */}
        <div className="w-full flex-1 flex flex-col justify-center gap-1.5 my-1">
          {mainDays.map((item) => {
            const isSelected = item.dateStr === selectedDateStr;

            return (
              <button
                key={item.dateStr}
                type="button"
                onClick={() => setModalDate(item.dateStr)}
                title={`Ver detalle de ${item.label}`}
                className={`w-full py-2 px-2.5 rounded-[10px] flex items-center justify-between text-left transition-all cursor-pointer border ${
                  isSelected
                    ? isLight
                      ? "bg-zinc-300/80 border-zinc-400 text-black shadow-xs font-black ring-1 ring-zinc-400"
                      : "bg-[#222226] border-[#38383E] text-white shadow-xs font-black ring-1 ring-zinc-500"
                    : isLight
                    ? "bg-white/80 border-[#E4E4E7] hover:bg-zinc-200/80 text-zinc-800 font-extrabold"
                    : "bg-[#141416] border-[#202024] hover:bg-[#1A1A1E] text-zinc-200 font-extrabold"
                }`}
              >
                <div className="flex flex-col leading-tight">
                  <span className="text-[12px] font-black tracking-tight">
                    {item.isToday ? "Hoy" : item.label}
                  </span>
                  <span
                    className={`text-[9px] font-extrabold ${
                      item.isToday
                        ? isLight
                          ? "text-[#16A34A]"
                          : "text-[#22C55E]"
                        : isLight
                        ? "text-zinc-500"
                        : "text-zinc-400"
                    }`}
                  >
                    {item.isToday
                      ? item.label
                      : item.daysAgo === 1
                      ? "Ayer"
                      : `Hace ${item.daysAgo}d`}
                  </span>
                </div>

                {item.status === "logged" ? (
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      isLight ? "bg-[#16A34A]" : "bg-[#22C55E]"
                    }`}
                    title="Registrado"
                  />
                ) : item.status === "unlogged" ? (
                  <span
                    className={`w-3 h-3 rounded-full shrink-0 flex items-center justify-center text-[8px] font-black border ${
                      isLight
                        ? "border-[#DC2626] text-[#DC2626] bg-red-50"
                        : "border-[#EF4444] text-[#EF4444] bg-red-950/30"
                    }`}
                    title="Sin registrar"
                  >
                    !
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
                )}
              </button>
            );
          })}

          {/* "+ Días" / "Ver más" button */}
          <button
            type="button"
            onClick={() => setShowAllDaysModal(true)}
            title="Ver los 14 días anteriores completos"
            className={`w-full py-1.5 px-2 rounded-[9px] text-[11px] font-extrabold border flex items-center justify-center gap-1 transition-all cursor-pointer ${
              isLight
                ? "bg-zinc-200/70 border-zinc-300 text-zinc-700 hover:bg-zinc-300 hover:text-black"
                : "bg-[#18181B] border-[#2A2A2E] text-zinc-300 hover:bg-[#222226] hover:text-white"
            }`}
          >
            <CalendarDays size={13} strokeWidth={2.2} />
            <span>+ Días</span>
          </button>
        </div>

        {/* Bottom Actions: "Hoy no gasté nada" (if unlogged) & Calendar */}
        <div className="w-full flex items-center justify-around pt-2 border-t border-white/5">
          {!isTodayLogged && (
            <button
              type="button"
              onClick={() => onMarkNoExpenses(todayStr)}
              title="Hoy no gasté nada"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                isLight
                  ? "text-[#16A34A] bg-[#16A34A]/10 hover:bg-[#16A34A]/20"
                  : "text-[#22C55E] bg-[#22C55E]/15 hover:bg-[#22C55E]/25"
              }`}
            >
              <CheckCircle2 size={16} strokeWidth={2.2} />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCalendar}
            title="Ver calendario mensual completo"
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLight
                ? "hover:bg-zinc-200 text-zinc-600 hover:text-black"
                : "hover:bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <CalendarIcon size={16} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* Modal with Full 14 Days History */}
      {showAllDaysModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-[380px] max-h-[85vh] rounded-[18px] border p-4 flex flex-col shadow-2xl ${
              isLight
                ? "bg-[#FFFFFF] border-[#E4E4E7] text-black"
                : "bg-[#0D0D0E] border-[#262626] text-white"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-zinc-400" />
                <h3 className="text-sm font-extrabold">Historial de los últimos 14 días</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAllDaysModal(false)}
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  isLight ? "hover:bg-zinc-200 text-zinc-600" : "hover:bg-zinc-800 text-zinc-400"
                }`}
              >
                <X size={16} />
              </button>
            </div>

            {/* List of 14 Days */}
            <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-1.5 pr-1 mt-1">
              {[...allDays].reverse().map((item) => {
                const dayMvs = movements.filter((m) => m.date === item.dateStr);
                const dayExpenses = dayMvs
                  .filter((m) => m.kind === "expense")
                  .reduce((sum, m) => sum + m.amount, 0);

                return (
                  <button
                    key={item.dateStr}
                    type="button"
                    onClick={() => {
                      setShowAllDaysModal(false);
                      setModalDate(item.dateStr);
                    }}
                    className={`w-full p-2.5 rounded-[12px] border flex items-center justify-between transition-all cursor-pointer ${
                      isLight
                        ? "bg-zinc-50 border-zinc-200 hover:bg-zinc-100 text-black"
                        : "bg-[#141416] border-[#222226] hover:bg-[#1A1A1E] text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full shrink-0 flex items-center justify-center text-[8px] font-black ${
                          item.status === "logged"
                            ? isLight
                              ? "bg-[#16A34A]"
                              : "bg-[#22C55E]"
                            : item.status === "unlogged"
                            ? "border border-[#DC2626] text-[#DC2626]"
                            : "bg-zinc-600"
                        }`}
                      />
                      <div className="flex flex-col text-left leading-tight">
                        <span className="text-xs font-black">
                          {item.label} {item.isToday && "(Hoy)"}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-bold">
                          {item.daysAgo === 0
                            ? "Hoy"
                            : item.daysAgo === 1
                            ? "Ayer"
                            : `Hace ${item.daysAgo} días`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {dayExpenses > 0 && (
                        <span className="text-xs font-extrabold text-[#DC2626] dark:text-[#EF4444]">
                          -$ {dayExpenses.toLocaleString("es-AR")}
                        </span>
                      )}
                      <ChevronRight size={14} className="text-zinc-500" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Pop-up / Modal for Day Detail */}
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
        />
      )}
    </>
  );
}
