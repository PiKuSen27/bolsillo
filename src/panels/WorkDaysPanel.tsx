import { useState } from "react";
import { CalendarDays, Coffee, RotateCcw, TrendingUp } from "lucide-react";
import { Settings, WorkDay } from "../types";
import { listRangeDays, calculateVariableIncome, getRateForDate } from "../lib/workdays";
import {
  formatCurrency,
  formatDayShortWithNum,
  formatNumberWithDots,
  formatShortDate,
  parseLocalDate,
} from "../lib/format";

interface WorkDaysPanelProps {
  settings: Settings;
  workDays: WorkDay[];
  todayStr: string;
  isLight?: boolean;
  onSetWorkDay: (dateStr: string, worked: boolean, amount: number) => void;
  onResetWorkDay: (dateStr: string) => void;
  onUpdateSettings: (s: Partial<Settings>) => void;
}

export function WorkDaysPanel({
  settings,
  workDays,
  todayStr,
  isLight,
  onSetWorkDay,
  onResetWorkDay,
  onUpdateSettings,
}: WorkDaysPanelProps) {
  const days = listRangeDays(settings, workDays);
  const total = calculateVariableIncome(settings, workDays);
  const workedCount = days.filter((d) => !d.free).length;

  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");

  const [showRateForm, setShowRateForm] = useState(false);
  const [rateFrom, setRateFrom] = useState(todayStr);
  const [rateValue, setRateValue] = useState("");

  const inputCls = `text-xs font-bold px-3 py-2 rounded-xl border focus:outline-none ${
    isLight ? "bg-zinc-100 border-zinc-300 text-black" : "bg-zinc-900 border-zinc-700 text-white"
  }`;
  const cardCls = `p-3 rounded-2xl border ${
    isLight ? "bg-white border-zinc-200" : "bg-[#0A0A0C] border-[#222224]"
  }`;
  const primaryBtn = `px-3 py-1.5 rounded-xl font-extrabold text-xs cursor-pointer transition-colors ${
    isLight ? "bg-black text-white hover:bg-zinc-800" : "bg-white text-black hover:bg-zinc-200"
  }`;
  const ghostBtn = `px-3 py-1.5 rounded-xl font-extrabold text-xs cursor-pointer border transition-colors ${
    isLight
      ? "bg-zinc-100 border-zinc-300 text-black hover:bg-zinc-200"
      : "bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800"
  }`;

  const startEdit = (date: string, value: number, rate: number) => {
    setEditingDate(date);
    setEditAmount(formatNumberWithDots(value > 0 ? value : rate));
  };

  const saveAmount = (date: string, rate: number) => {
    const amount = parseInt(editAmount.replace(/\./g, ""), 10);
    if (isNaN(amount) || amount < 0) return;
    const isSunday = parseLocalDate(date).getDay() === 0;
    // Igual a la tarifa (y no es domingo) → vuelve al valor por defecto, así no queda "modificado"
    if (amount === rate && !isSunday) onResetWorkDay(date);
    else onSetWorkDay(date, true, amount);
    setEditingDate(null);
  };

  const saveRateChange = () => {
    const rate = parseInt(rateValue.replace(/\./g, ""), 10);
    if (isNaN(rate) || rate <= 0 || !rateFrom) return;
    const others = (settings.dailyRateChanges ?? []).filter((c) => c.fromDate !== rateFrom);
    onUpdateSettings({ dailyRateChanges: [...others, { fromDate: rateFrom, rate }] });
    setRateValue("");
    setShowRateForm(false);
  };

  if (days.length === 0) {
    return (
      <div className={`${cardCls} text-xs font-bold opacity-70`}>
        Todavía no hay un rango de fechas. Configuralo en Ajustes → Sueldo Variable.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 select-none pb-4">
      {/* Resumen */}
      <div className={`${cardCls} flex flex-col gap-2`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-extrabold">
            <CalendarDays size={14} />
            <span>
              Del {formatShortDate(days[0].date)} al {formatShortDate(days[days.length - 1].date)}
            </span>
          </div>
          <span className="text-[11px] font-bold opacity-60">
            {workedCount} {workedCount === 1 ? "día trabajado" : "días trabajados"}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-bold opacity-60">Ingreso del rango</span>
          <span
            className={`text-lg font-extrabold tabular-numbers ${
              isLight ? "text-[#16A34A]" : "text-[#22C55E]"
            }`}
          >
            {formatCurrency(total)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] font-bold">
          <span className="opacity-60">
            Tarifa hoy: {formatCurrency(getRateForDate(todayStr, settings))}
          </span>
          <button
            type="button"
            onClick={() => setShowRateForm(!showRateForm)}
            className={`flex items-center gap-1 ${ghostBtn}`}
          >
            <TrendingUp size={12} />
            <span>{showRateForm ? "Cancelar" : "Cambiar tarifa desde una fecha"}</span>
          </button>
        </div>

        {showRateForm && (
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-[11px] font-bold opacity-70">
              Los días anteriores quedan como estaban. Los días modificados a mano conservan su monto.
            </span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={rateFrom}
                onChange={(e) => setRateFrom(e.target.value)}
                className={inputCls}
                aria-label="Desde la fecha"
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="Tarifa nueva ($)"
                value={rateValue}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setRateValue(raw ? formatNumberWithDots(raw) : "");
                }}
                className={inputCls}
              />
            </div>
            <button type="button" onClick={saveRateChange} className={`${primaryBtn} self-end`}>
              Aplicar desde el {formatShortDate(rateFrom || todayStr)}
            </button>
          </div>
        )}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 text-[10px] font-bold opacity-60 px-1">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#D97706]" /> Monto distinto a la tarifa
        </span>
        <span className="flex items-center gap-1">
          <Coffee size={11} /> Día libre
        </span>
      </div>

      {/* Lista de días */}
      <div className="flex flex-col gap-1.5">
        {days.map((d) => {
          const isToday = d.date === todayStr;
          const isEditing = editingDate === d.date;
          const hasOverride = workDays.some((w) => w.date === d.date);
          const isSunday = parseLocalDate(d.date).getDay() === 0;

          return (
            <div
              key={d.date}
              className={`rounded-xl border px-3 py-2 transition-colors ${
                d.modified
                  ? isLight
                    ? "border-[#D97706] bg-[#FFFBEB]"
                    : "border-[#D97706]/70 bg-[#1C1407]"
                  : d.free
                  ? isLight
                    ? "border-dashed border-zinc-300 bg-zinc-50 opacity-70"
                    : "border-dashed border-zinc-700 bg-[#050506] opacity-60"
                  : isLight
                  ? "border-zinc-200 bg-white"
                  : "border-[#222224] bg-[#0A0A0C]"
              }`}
            >
              <button
                type="button"
                onClick={() => (isEditing ? setEditingDate(null) : startEdit(d.date, d.value, d.rate))}
                className="w-full flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2 text-xs font-extrabold">
                  <span className={isToday ? (isLight ? "text-[#16A34A]" : "text-[#22C55E]") : ""}>
                    {formatDayShortWithNum(d.date)}
                  </span>
                  {isToday && <span className="text-[9px] uppercase opacity-60">Hoy</span>}
                  {d.free && <Coffee size={12} className="opacity-60" />}
                  {d.modified && <span className="w-2 h-2 rounded-full bg-[#D97706]" />}
                </div>
                <span
                  className={`text-xs font-extrabold tabular-numbers ${
                    d.free ? "line-through opacity-50" : d.modified ? "text-[#D97706]" : ""
                  }`}
                >
                  {d.free ? "Día libre" : formatCurrency(d.value)}
                </span>
              </button>

              {isEditing && (
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editAmount}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        setEditAmount(raw ? formatNumberWithDots(raw) : "");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && saveAmount(d.date, d.rate)}
                      className={`${inputCls} flex-1 min-w-0`}
                      aria-label="Monto del día"
                      autoFocus
                    />
                    <button type="button" onClick={() => saveAmount(d.date, d.rate)} className={primaryBtn}>
                      Guardar
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {d.free ? (
                      <button
                        type="button"
                        onClick={() => {
                          onSetWorkDay(d.date, true, d.rate);
                          setEditingDate(null);
                        }}
                        className={ghostBtn}
                      >
                        Trabajé este día ({formatCurrency(d.rate)})
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onSetWorkDay(d.date, false, 0);
                          setEditingDate(null);
                        }}
                        className={`flex items-center gap-1 ${ghostBtn}`}
                      >
                        <Coffee size={12} /> Día libre
                      </button>
                    )}
                    {hasOverride && (
                      <button
                        type="button"
                        onClick={() => {
                          onResetWorkDay(d.date);
                          setEditingDate(null);
                        }}
                        className={`flex items-center gap-1 ${ghostBtn}`}
                      >
                        <RotateCcw size={12} />
                        {isSunday ? "Volver a domingo libre" : `Volver a tarifa (${formatCurrency(d.rate)})`}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
