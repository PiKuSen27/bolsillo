import { useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import {
  addMonths,
  endOfMonth,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
} from "date-fns";
import { es } from "date-fns/locale";
import { Category, DayLog, Movement } from "../types";
import { formatCurrency, formatLocalDate, parseLocalDate } from "../lib/format";
import { isDayLogged } from "../lib/reminders";

interface CalendarPanelProps {
  movements: Movement[];
  categories: Category[];
  dayLogs: DayLog[];
  todayStr: string;
  selectedDateStr: string;
  isLight?: boolean;
  onSelectDate: (dateStr: string) => void;
  onMarkNoExpenses: (dateStr: string) => void;
}

export function CalendarPanel({
  movements,
  categories,
  dayLogs,
  todayStr,
  selectedDateStr,
  isLight,
  onSelectDate,
  onMarkNoExpenses,
}: CalendarPanelProps) {
  const [currentMonthDate, setCurrentMonthDate] = useState(
    parseLocalDate(todayStr)
  );
  const today = parseLocalDate(todayStr);

  const monthStart = startOfMonth(currentMonthDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Selected date info
  const selectedMovements = movements.filter((m) => m.date === selectedDateStr);
  const isSelectedLogged = isDayLogged(selectedDateStr, movements, dayLogs);

  const getCategory = (catId: string) => {
    return (
      categories.find((c) => c.id === catId) || {
        name: "Otros",
        color: "#6B7280",
      }
    );
  };

  return (
    <div className="flex flex-col gap-3 select-none">
      {/* Month Navigator */}
      <div
        className={`flex items-center justify-between p-2 rounded-2xl border ${
          isLight ? "bg-white border-zinc-200" : "bg-[#0A0A0C] border-[#222224]"
        }`}
      >
        <button
          type="button"
          onClick={() => setCurrentMonthDate(addMonths(currentMonthDate, -1))}
          className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
            isLight ? "hover:bg-zinc-100 text-zinc-600" : "hover:bg-zinc-800 text-zinc-400"
          }`}
        >
          <ChevronLeft size={16} />
        </button>

        <span className="text-xs font-extrabold capitalize">
          {format(currentMonthDate, "MMMM yyyy", { locale: es })}
        </span>

        <button
          type="button"
          onClick={() => setCurrentMonthDate(addMonths(currentMonthDate, 1))}
          className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
            isLight ? "hover:bg-zinc-100 text-zinc-600" : "hover:bg-zinc-800 text-zinc-400"
          }`}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekDays.map((wd, i) => (
          <span key={i} className="text-[10px] font-extrabold opacity-50">
            {wd}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayStr = formatLocalDate(day);
          const isCurrentMonth = isSameMonth(day, currentMonthDate);
          const isSelected = dayStr === selectedDateStr;
          const isDayToday = isSameDay(day, today);
          const isFuture = day.getTime() > today.getTime();
          const logged = isDayLogged(dayStr, movements, dayLogs);

          return (
            <button
              key={dayStr}
              type="button"
              onClick={() => onSelectDate(dayStr)}
              className={`h-11 rounded-xl flex flex-col items-center justify-center p-1 transition-all cursor-pointer border ${
                isSelected
                  ? isLight
                    ? "bg-zinc-200 border-zinc-400 text-black font-extrabold"
                    : "bg-zinc-800 border-zinc-500 text-white font-extrabold"
                  : isCurrentMonth
                  ? isLight
                    ? "bg-white hover:bg-zinc-100 border-zinc-200 text-black"
                    : "bg-[#0A0A0C] hover:bg-[#141416] border-[#222224] text-white"
                  : "bg-transparent border-transparent opacity-30 text-zinc-500"
              }`}
            >
              <span
                className={`text-[11px] font-extrabold ${
                  isDayToday ? "text-[#16A34A] underline" : ""
                }`}
              >
                {day.getDate()}
              </span>

              {/* Status dot */}
              <div className="h-1.5 flex items-center justify-center mt-1">
                {isFuture ? (
                  <span className="w-1 h-1 rounded-full bg-zinc-600" />
                ) : logged ? (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isLight ? "bg-[#16A34A]" : "bg-[#22C55E]"
                    }`}
                  />
                ) : (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isLight ? "bg-[#DC2626]" : "bg-[#EF4444]"
                    }`}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Day Summary */}
      <div
        className={`p-3.5 rounded-2xl border flex flex-col gap-2 mt-1 ${
          isLight ? "bg-white border-zinc-200" : "bg-[#0A0A0C] border-[#222224]"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold capitalize">
            {format(parseLocalDate(selectedDateStr), "EEEE d 'de' MMMM", {
              locale: es,
            })}
          </span>

          {!isSelectedLogged && (
            <button
              type="button"
              onClick={() => onMarkNoExpenses(selectedDateStr)}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors border ${
                isLight
                  ? "bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800"
                  : "bg-emerald-950/30 hover:bg-emerald-950/50 border-emerald-800 text-emerald-300"
              }`}
            >
              <CheckCircle2 size={12} />
              <span>Marcar sin gastos</span>
            </button>
          )}
        </div>

        {selectedMovements.length === 0 ? (
          <div className="text-[11px] font-semibold opacity-60 py-1">
            {isSelectedLogged
              ? "Día marcado como registrado sin gastos"
              : "Sin movimientos registrados para esta fecha"}
          </div>
        ) : (
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto scrollbar-thin">
            {selectedMovements.map((m) => {
              const cat = getCategory(m.categoryId);
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-xs font-bold py-1 border-b border-white/5"
                >
                  <div className="flex items-center gap-2 truncate max-w-[200px]">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="truncate">{m.note || cat.name}</span>
                  </div>
                  <span
                    className="font-extrabold tabular-numbers"
                    style={{ color: cat.color }}
                  >
                    {m.kind === "expense" ? "- " : "+ "}
                    {formatCurrency(m.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
