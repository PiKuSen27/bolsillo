import { useState } from "react";
import { motion } from "motion/react";
import { Sparkles, ArrowRight, Check, Calendar } from "lucide-react";
import confetti from "canvas-confetti";
import { calculateVariableIncome } from "../lib/workdays";
import { DEFAULT_SETTINGS } from "../lib/constants";
import { addDays, differenceInCalendarDays } from "date-fns";
import { IncomeMode, Settings } from "../types";
import { DateField } from "../components/DateField";
import {
  formatCurrency,
  formatLocalDate,
  formatNumberWithDots,
  formatShortDate,
  parseLocalDate, formatAmountInput } from "../lib/format";

interface OnboardingPanelProps {
  onComplete: (settings: Partial<Settings>) => void;
}

export function OnboardingPanel({ onComplete }: OnboardingPanelProps) {
  const [step, setStep] = useState(1);
  const [incomeMode, setIncomeMode] = useState<IncomeMode>("salary");
  const [fixedSalary, setFixedSalary] = useState("");
  const [payday, setPayday] = useState("1");
  const [dailyRate, setDailyRate] = useState("");
  const [dailyRangeStart, setDailyRangeStart] = useState(() => formatLocalDate(new Date()));
  const [dailyRangeEnd, setDailyRangeEnd] = useState(() =>
    formatLocalDate(addDays(new Date(), 20))
  );
  const [reminderTime, setReminderTime] = useState("21:00");

  // Live projection calculations for daily mode
  const parsedRate = parseInt(dailyRate.replace(/\./g, ""), 10) || 0;
  const sDate = parseLocalDate(dailyRangeStart);
  const eDate = parseLocalDate(dailyRangeEnd);
  const totalDays = Math.max(1, differenceInCalendarDays(eDate, sDate) + 1);
  // Lunes a sábado a la tarifa, domingos libres
  const projectedTotal = calculateVariableIncome(
    { ...DEFAULT_SETTINGS, dailyRate: parsedRate, dailyRangeStart, dailyRangeEnd },
    []
  );

  // Sin monto no se puede seguir (antes había uno de ejemplo cargado)
  const amountMissing =
    step === 1 && (incomeMode === "salary" ? !parseInt(fixedSalary.replace(/\./g, ""), 10) : !parsedRate);

  const handleNext = () => {
    if (amountMissing) return;
    if (step < 3) {
      setStep(step + 1);
    } else {
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }

      onComplete({
        incomeMode,
        fixedSalary: parseInt(fixedSalary.replace(/\./g, ""), 10) || 0,
        payday: Math.min(31, Math.max(1, parseInt(payday, 10) || 1)),
        dailyRate: parsedRate,
        dailyRangeStart,
        dailyRangeEnd,
        reminderTime,
        reminderEnabled: true,
        onboardingDone: true,
      });
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="absolute inset-0 z-50 rounded-[18px] max-[479px]:rounded-none bg-[#000000] border border-[#262626] max-[479px]:border-0 p-6 pt-[calc(1.5rem+var(--safe-top))] pb-[calc(1.5rem+var(--safe-bottom))] flex flex-col justify-between text-white select-none overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between shrink-0 pb-2">
        <div className="flex items-center gap-2 text-xs font-black text-[#22C55E]">
          <Sparkles size={16} />
          <span>¡Bienvenido a Bolsillo!</span>
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step
                  ? "w-6 bg-white"
                  : s < step
                  ? "w-2 bg-zinc-500"
                  : "w-2 bg-zinc-800"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main Step Body with slide animations */}
      <div className="my-auto py-2">
        {/* Sin AnimatePresence mode="wait": en el escritorio dejaba el paso en negro, vacío, si la animación de salida no terminaba (bug F) */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="flex flex-col gap-2.5"
            >
              <h2 className="text-xl font-black tracking-tight">
                ¿Cómo son tus ingresos?
              </h2>
              <p className="text-xs text-zinc-400 font-bold">
                Elegí si cobrás un sueldo fijo mensual o si ganás de forma variable por día trabajado.
              </p>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setIncomeMode("salary")}
                  className={`p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                    incomeMode === "salary"
                      ? "bg-white text-black border-white"
                      : "bg-[#111113] border-zinc-800 text-zinc-400"
                  }`}
                >
                  Sueldo Fijo Mensual
                </button>
                <button
                  type="button"
                  onClick={() => setIncomeMode("daily")}
                  className={`p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                    incomeMode === "daily"
                      ? "bg-white text-black border-white"
                      : "bg-[#111113] border-zinc-800 text-zinc-400"
                  }`}
                >
                  Sueldo Variable por Día
                </button>
              </div>

              {incomeMode === "salary" ? (
                <div className="flex flex-col gap-2.5 mt-1">
                  <div>
                    <label className="text-[10px] font-extrabold text-zinc-400 block mb-1">
                      Sueldo mensual fijo ($ ARS)
                    </label>
                    <div className="relative">
                      {/* "$" de guía: no es parte del texto, no se selecciona */}
                      <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-zinc-600 pointer-events-none select-none">
                        $
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={fixedSalary}
                        onChange={(e) => {
                          setFixedSalary(formatAmountInput(e.target.value));
                        }}
                        className="w-full bg-[#111113] text-white font-black text-sm pl-7 pr-3 py-2 rounded-xl border border-zinc-800 focus:outline-none focus:border-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-zinc-400 block mb-1">
                      Día del mes en que cobrás (1 a 31)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={payday}
                      onChange={(e) => setPayday(e.target.value)}
                      className="w-full bg-[#111113] text-white font-black text-sm px-3 py-2 rounded-xl border border-zinc-800 focus:outline-none focus:border-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 mt-1">
                  <div>
                    <label className="text-[10px] font-extrabold text-zinc-400 block mb-1">
                      1. Tarifa por día ($ ARS)
                    </label>
                    <div className="relative">
                      {/* "$" de guía: no es parte del texto, no se selecciona */}
                      <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-zinc-600 pointer-events-none select-none">
                        $
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={dailyRate}
                        onChange={(e) => {
                          setDailyRate(formatAmountInput(e.target.value));
                        }}
                        className="w-full bg-[#111113] text-white font-black text-sm pl-7 pr-3 py-2 rounded-xl border border-zinc-800 focus:outline-none focus:border-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-extrabold text-zinc-400 block mb-1 flex items-center gap-1">
                        <Calendar size={11} />
                        <span>2. Fecha de inicio</span>
                      </label>
                      <DateField ariaLabel="Fecha de inicio" value={dailyRangeStart} onChange={setDailyRangeStart} />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold text-zinc-400 block mb-1 flex items-center gap-1">
                        <Calendar size={11} />
                        <span>3. Fecha fin / cobro</span>
                      </label>
                      <DateField ariaLabel="Fecha fin / cobro" value={dailyRangeEnd} onChange={setDailyRangeEnd} />
                    </div>
                  </div>

                  {/* Proyección en vivo (solo cuando ya hay tarifa) */}
                  {parsedRate > 0 && (
                  <div className="p-3 rounded-xl bg-[#141416] border border-zinc-800 flex flex-col gap-1 mt-1">
                    <span className="text-[10px] uppercase font-black text-zinc-400">
                      Proyección estimada
                    </span>
                    <p className="text-xs font-black text-white">
                      Del {formatShortDate(dailyRangeStart)} al {formatShortDate(dailyRangeEnd)} (
                      {totalDays} días, domingos libres) a ${formatNumberWithDots(parsedRate)} ={" "}
                      <span className="text-[#22C55E]">Vas a juntar {formatCurrency(projectedTotal)}</span>
                    </p>
                  </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="flex flex-col gap-3"
            >
              <h2 className="text-xl font-black tracking-tight">
                {incomeMode === "salary" ? "Día de Cobro" : "Cobro Variable"}
              </h2>
              <p className="text-xs text-zinc-400 font-bold">
                {incomeMode === "salary"
                  ? "El día de cobro define el inicio y fin de cada período mensual para calcular cuánto podés gastar por día."
                  : "Cada día que marques como trabajado se sumará automáticamente a tu dinero disponible."}
              </p>

              <div className="p-4 rounded-2xl bg-[#111113] border border-zinc-800 text-xs font-bold text-zinc-300">
                {incomeMode === "salary"
                  ? `Cobrás el día ${payday} de cada mes. Tu disponible se renovará en esa fecha.`
                  : `Tu proyección es de ${formatCurrency(projectedTotal)} (${totalDays} días a ${formatCurrency(parsedRate)}, domingos libres). Después podés editar cada día en "Días trabajados".`}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="flex flex-col gap-3"
            >
              <h2 className="text-xl font-black tracking-tight">
                ¿A qué hora te aviso para anotar?
              </h2>
              <p className="text-xs text-zinc-400 font-bold">
                Los recordatorios son clave para no olvidarte de anotar nada. Te mandaremos un aviso diario si aún no registraste el día.
              </p>

              <div className="flex flex-col gap-2 mt-2">
                <label className="text-[10px] font-extrabold text-zinc-400 block mb-1">
                  Hora de aviso (formato 24 hs)
                </label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full bg-[#111113] text-white font-black text-xl px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-white"
                />
              </div>
            </motion.div>
          )}

      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-3 border-t border-[#262626] shrink-0">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="text-xs font-black text-zinc-400 hover:text-white cursor-pointer"
          >
            Atrás
          </button>
        ) : amountMissing ? (
          <span className="text-[11px] font-bold text-zinc-400">Escribí el monto para seguir</span>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={handleNext}
          disabled={amountMissing}
          className="px-5 py-2.5 rounded-xl bg-white text-black font-black text-xs flex items-center gap-2 hover:bg-zinc-200 transition-all cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>{step === 3 ? "Empezar a usar Bolsillo" : "Siguiente"}</span>
          {step === 3 ? <Check size={14} /> : <ArrowRight size={14} />}
        </button>
      </div>
    </div>
  );
}
