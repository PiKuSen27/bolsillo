import { useState } from "react";
import { Briefcase, CalendarCheck, Calendar, Target } from "lucide-react";
import { addDays, differenceInCalendarDays } from "date-fns";
import { IncomeMode, Settings, WorkDay } from "../types";
import {
  formatCurrency,
  formatLongDate,
  formatLocalDate,
  formatNumberWithDots,
  formatShortDate,
  parseLocalDate,
} from "../lib/format";

interface IncomePanelProps {
  settings: Settings;
  workDays: WorkDay[];
  isLight?: boolean;
  onUpdateSettings: (s: Partial<Settings>) => void;
  onToggleWorkDay: (dateStr: string, worked: boolean, amount?: number) => void;
}

export function IncomePanel({
  settings,
  workDays,
  isLight,
  onUpdateSettings,
  onToggleWorkDay,
}: IncomePanelProps) {
  const [mode, setMode] = useState<IncomeMode>(settings.incomeMode || "salary");
  const [fixedSalary, setFixedSalary] = useState(
    formatNumberWithDots(settings.fixedSalary)
  );
  const [payday, setPayday] = useState(String(settings.payday));
  const [dailyRate, setDailyRate] = useState(
    formatNumberWithDots(settings.dailyRate)
  );
  const [rangeStart, setRangeStart] = useState(
    settings.dailyRangeStart || formatLocalDate(new Date())
  );
  const [rangeEnd, setRangeEnd] = useState(
    settings.dailyRangeEnd || formatLocalDate(addDays(new Date(), 20))
  );
  const [goalName, setGoalName] = useState(settings.dailyGoalName || "");
  const [goalAmount, setGoalAmount] = useState(
    settings.dailyGoalAmount ? formatNumberWithDots(settings.dailyGoalAmount) : ""
  );

  // Live calculations
  const parsedRate = parseInt(dailyRate.replace(/\./g, ""), 10) || 0;
  const sDate = parseLocalDate(rangeStart);
  const eDate = parseLocalDate(rangeEnd);
  const totalDays = Math.max(1, differenceInCalendarDays(eDate, sDate) + 1);
  const projectedTotal = totalDays * parsedRate;
  const parsedGoal = parseInt(goalAmount.replace(/\./g, ""), 10) || 0;
  const goalDiff = projectedTotal - parsedGoal;

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const sal = parseInt(fixedSalary.replace(/\./g, ""), 10) || 0;
    const pd = parseInt(payday, 10) || 1;

    onUpdateSettings({
      incomeMode: mode,
      fixedSalary: sal,
      payday: Math.min(31, Math.max(1, pd)),
      dailyRate: parsedRate,
      dailyRangeStart: rangeStart,
      dailyRangeEnd: rangeEnd,
      dailyGoalName: goalName.trim() || undefined,
      dailyGoalAmount: parsedGoal > 0 ? parsedGoal : undefined,
    });
  };

  // Generate last 14 days to quickly toggle
  const today = new Date();
  const recentDays: { dateStr: string; worked: boolean; amount: number }[] = [];

  for (let i = 0; i < 14; i++) {
    const d = addDays(today, -i);
    const dateStr = formatLocalDate(d);
    const record = workDays.find((w) => w.date === dateStr);
    recentDays.push({
      dateStr,
      worked: record?.worked || false,
      amount: record?.amount || settings.dailyRate,
    });
  }

  const workedCount = workDays.filter((w) => w.worked).length;
  const totalEarnedByDays = workDays
    .filter((w) => w.worked)
    .reduce((acc, w) => acc + (w.amount || settings.dailyRate), 0);

  return (
    <div className="flex flex-col gap-3.5 select-none pb-4">
      {/* Mode Selector */}
      <div
        className={`p-1 rounded-2xl border flex items-center gap-1 ${
          isLight ? "bg-zinc-200 border-zinc-300" : "bg-black border-[#262626]"
        }`}
      >
        <button
          type="button"
          onClick={() => setMode("salary")}
          className={`flex-1 py-2 text-center text-xs font-black rounded-xl transition-all cursor-pointer ${
            mode === "salary"
              ? isLight
                ? "bg-white text-black shadow-xs"
                : "bg-zinc-800 text-white"
              : isLight
              ? "text-zinc-600 hover:text-black"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Sueldo Fijo Mensual
        </button>

        <button
          type="button"
          onClick={() => setMode("daily")}
          className={`flex-1 py-2 text-center text-xs font-black rounded-xl transition-all cursor-pointer ${
            mode === "daily"
              ? isLight
                ? "bg-white text-black shadow-xs"
                : "bg-zinc-800 text-white"
              : isLight
              ? "text-zinc-600 hover:text-black"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Sueldo Variable por Día
        </button>
      </div>

      {/* Form based on Mode */}
      <form
        onSubmit={handleSaveSettings}
        className={`p-3.5 rounded-2xl border flex flex-col gap-3 ${
          isLight ? "bg-white border-zinc-300" : "bg-[#0A0A0C] border-[#222224]"
        }`}
      >
        <div className="flex items-center gap-2">
          <Briefcase size={16} className={isLight ? "text-zinc-700" : "text-white"} />
          <span className="text-xs font-black">
            {mode === "salary"
              ? "Configuración de Sueldo Fijo"
              : "Rango de Cobro, Tarifa y Objetivo"}
          </span>
        </div>

        {mode === "salary" ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-extrabold block mb-1 opacity-70">
                Sueldo fijo mensual ($ ARS)
              </label>
              <input
                type="text"
                value={fixedSalary}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setFixedSalary(raw ? formatNumberWithDots(raw) : "");
                }}
                className={`w-full text-xs font-black px-3 py-2 rounded-xl border focus:outline-none ${
                  isLight
                    ? "bg-zinc-100 border-zinc-300 text-black"
                    : "bg-zinc-900 border-zinc-700 text-white"
                }`}
                placeholder="700.000"
              />
            </div>

            <div>
              <label className="text-[10px] font-extrabold block mb-1 opacity-70">
                Día de cobro (1 a 31)
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={payday}
                onChange={(e) => setPayday(e.target.value)}
                className={`w-full text-xs font-black px-3 py-2 rounded-xl border focus:outline-none ${
                  isLight
                    ? "bg-zinc-100 border-zinc-300 text-black"
                    : "bg-zinc-900 border-zinc-700 text-white"
                }`}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div>
              <label className="text-[10px] font-extrabold block mb-1 opacity-70">
                1. Tarifa por día ($ ARS)
              </label>
              <input
                type="text"
                value={dailyRate}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setDailyRate(raw ? formatNumberWithDots(raw) : "");
                }}
                className={`w-full text-xs font-black px-3 py-2 rounded-xl border focus:outline-none ${
                  isLight
                    ? "bg-zinc-100 border-zinc-300 text-black"
                    : "bg-zinc-900 border-zinc-700 text-white"
                }`}
                placeholder="25.000"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-extrabold block mb-1 opacity-70 flex items-center gap-1">
                  <Calendar size={12} />
                  <span>2. Fecha de inicio</span>
                </label>
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className={`w-full text-xs font-bold px-2.5 py-1.5 rounded-xl border focus:outline-none ${
                    isLight
                      ? "bg-zinc-100 border-zinc-300 text-black"
                      : "bg-zinc-900 border-zinc-700 text-white"
                  }`}
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold block mb-1 opacity-70 flex items-center gap-1">
                  <Calendar size={12} />
                  <span>3. Fecha fin / cobro</span>
                </label>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className={`w-full text-xs font-bold px-2.5 py-1.5 rounded-xl border focus:outline-none ${
                    isLight
                      ? "bg-zinc-100 border-zinc-300 text-black"
                      : "bg-zinc-900 border-zinc-700 text-white"
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-extrabold block mb-1 opacity-70 flex items-center gap-1">
                  <Target size={12} />
                  <span>4. Objetivo opcional</span>
                </label>
                <input
                  type="text"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder="Ej. Pagar la tele"
                  className={`w-full text-xs font-bold px-2.5 py-1.5 rounded-xl border focus:outline-none ${
                    isLight
                      ? "bg-zinc-100 border-zinc-300 text-black"
                      : "bg-zinc-900 border-zinc-700 text-white"
                  }`}
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold block mb-1 opacity-70">
                  Monto objetivo ($ ARS)
                </label>
                <input
                  type="text"
                  value={goalAmount}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    setGoalAmount(raw ? formatNumberWithDots(raw) : "");
                  }}
                  placeholder="180.000"
                  className={`w-full text-xs font-bold px-2.5 py-1.5 rounded-xl border focus:outline-none ${
                    isLight
                      ? "bg-zinc-100 border-zinc-300 text-black"
                      : "bg-zinc-900 border-zinc-700 text-white"
                  }`}
                />
              </div>
            </div>

            {/* Proyección interactiva */}
            <div
              className={`p-3 rounded-xl border flex flex-col gap-1 ${
                isLight ? "bg-zinc-100 border-zinc-200" : "bg-[#141416] border-[#222224]"
              }`}
            >
              <span className="text-[10px] uppercase font-black opacity-60">
                Proyección en vivo
              </span>
              <p className="text-xs font-black">
                Del {formatShortDate(rangeStart)} al {formatShortDate(rangeEnd)} ({totalDays}{" "}
                días) × ${formatNumberWithDots(parsedRate)} ={" "}
                <span className={isLight ? "text-[#16A34A]" : "text-[#22C55E]"}>
                  Vas a juntar {formatCurrency(projectedTotal)}
                </span>
              </p>
              {parsedGoal > 0 && (
                <div className="text-xs font-black mt-0.5">
                  {goalDiff >= 0 ? (
                    <span className={isLight ? "text-[#16A34A]" : "text-[#22C55E]"}>
                      ✓ Te sobran {formatCurrency(goalDiff)} para {goalName || "tu objetivo"}
                    </span>
                  ) : (
                    <span className={isLight ? "text-[#DC2626]" : "text-[#EF4444]"}>
                      ⚠ Te faltan {formatCurrency(Math.abs(goalDiff))} para{" "}
                      {goalName || "tu objetivo"}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className={`px-4 py-2 rounded-xl font-black text-xs transition-colors cursor-pointer ${
              isLight
                ? "bg-black text-white hover:bg-zinc-800"
                : "bg-white text-black hover:bg-zinc-200"
            }`}
          >
            Guardar cambios de ingresos
          </button>
        </div>
      </form>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className={`p-3 rounded-2xl border flex flex-col ${
            isLight ? "bg-white border-zinc-200" : "bg-[#0A0A0C] border-[#222224]"
          }`}
        >
          <span className="text-[10px] font-black uppercase opacity-60">
            Días trabajados
          </span>
          <span className="text-xl font-black tabular-numbers mt-0.5">
            {workedCount} días
          </span>
        </div>

        <div
          className={`p-3 rounded-2xl border flex flex-col ${
            isLight ? "bg-white border-zinc-200" : "bg-[#0A0A0C] border-[#222224]"
          }`}
        >
          <span className="text-[10px] font-black uppercase opacity-60">
            Ganancia por días
          </span>
          <span
            className={`text-xl font-black tabular-numbers mt-0.5 ${
              isLight ? "text-[#16A34A]" : "text-[#22C55E]"
            }`}
          >
            {formatCurrency(totalEarnedByDays)}
          </span>
        </div>
      </div>

      {/* Work days toggle list */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-black flex items-center gap-1.5 opacity-80">
          <CalendarCheck size={14} />
          <span>Marcar días trabajados (últimas 2 semanas)</span>
        </span>

        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto scrollbar-thin pr-1">
          {recentDays.map((day) => (
            <div
              key={day.dateStr}
              onClick={() => onToggleWorkDay(day.dateStr, !day.worked, settings.dailyRate)}
              className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                day.worked
                  ? isLight
                    ? "bg-emerald-50 border-emerald-300 text-black font-black"
                    : "bg-emerald-950/30 border-emerald-800 text-white font-black"
                  : isLight
                  ? "bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100 font-bold"
                  : "bg-zinc-900/50 border-[#202022] text-zinc-400 hover:bg-zinc-900 font-bold"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded-md flex items-center justify-center border text-[10px] font-black ${
                    day.worked
                      ? "bg-[#22C55E] border-[#22C55E] text-black"
                      : "border-zinc-500"
                  }`}
                >
                  {day.worked ? "✓" : ""}
                </div>
                <span className="text-xs">{formatLongDate(day.dateStr)}</span>
              </div>

              <span className="text-xs font-black tabular-numbers">
                {day.worked ? `+ ${formatCurrency(day.amount)}` : "No trabajado"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
