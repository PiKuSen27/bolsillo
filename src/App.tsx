import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Pin,
  Minus,
  X,
  Smartphone,
  Wallet,
  Receipt,
  Repeat,
  Users,
  Settings as SettingsNavIcon,
  RotateCcw,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  closeWindow,
  isTauri,
  isWindowAlwaysOnTop,
  minimizeWindow,
  requestAppNotificationPermission,
  sendAppNotification,
  setAppAutostart,
  toggleAlwaysOnTop,
} from "./platform";
import {
  DayLog,
  Debt,
  Installment,
  Movement,
  PeriodInfo,
  Recurring,
  Settings,
  WorkDay,
} from "./types";
import { db } from "./db/db";
import {
  addDebt,
  deleteDebt,
  getSettings,
  markDayAsLogged,
  markDayAsNoExpenses,
  settleDebt,
  setWorkDay,
  resetWorkDay,
  updateSettings,
} from "./db/repo";
import { calculatePeriod, calculateVariablePeriod } from "./lib/period";
import { calculateBalance } from "./lib/balance";
import { calculateVariableIncome } from "./lib/workdays";
import { calculatePreviousPeriodBalance } from "./lib/carryover";
import {
  getUpcomingItems,
  processAutoAddRules,
} from "./lib/recurring";
import {
  getDueAlertsToNotify,
  getMissingDays,
  isDayLogged,
  shouldTriggerDailyReminder,
} from "./lib/reminders";
import { formatLocalDate, formatNumberWithDots } from "./lib/format";
import { Hero } from "./components/Hero";
import { DayStrip } from "./components/DayStrip";
import { MobileDayStrip } from "./components/MobileDayStrip";
import { Calculator } from "./components/Calculator";
import { RightColumnWidget } from "./components/RightColumnWidget";
import { BannerMissingDays } from "./components/BannerMissingDays";
import { Sheet } from "./components/Sheet";
import { MovementsPanel } from "./panels/MovementsPanel";
import { FixedAndInstallmentsPanel } from "./panels/FixedAndInstallmentsPanel";
import { DebtsPanel } from "./panels/DebtsPanel";
import { WorkDaysPanel } from "./panels/WorkDaysPanel";
import { CalendarPanel } from "./panels/CalendarPanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import { OnboardingPanel } from "./panels/OnboardingPanel";

export default function App() {
  const [isPinned, setIsPinned] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [recurrings, setRecurrings] = useState<Recurring[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [dayLogs, setDayLogs] = useState<DayLog[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);

  const [todayStr, setTodayStr] = useState(() => formatLocalDate(new Date()));
  const [selectedDateStr, setSelectedDateStr] = useState(() => formatLocalDate(new Date()));

  // Active sliding sheet
  const [activeSheet, setActiveSheet] = useState<
    null | "movements" | "fixed" | "debts" | "income" | "calendar" | "settings"
  >(null);

  // Undo Toast state
  const [undoToast, setUndoToast] = useState<{ id: string; message: string } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobile layout detection & simulator
  const [isMobilePreview, setIsMobilePreview] = useState(false);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsNarrowScreen(window.innerWidth < 480);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobileLayout = isNarrowScreen || isMobilePreview;

  // Load all data from Dexie
  const loadData = useCallback(async () => {
    const s = await getSettings();
    setSettings(s);

    const [allM, allR, allI, allW, allD, allDebts] = await Promise.all([
      db.movements.orderBy("date").reverse().toArray(),
      db.recurrings.toArray(),
      db.installments.toArray(),
      db.workDays.toArray(),
      db.dayLogs.toArray(),
      db.debts.toArray(),
    ]);

    // Automatic migration: Any income movement with categoryId !== 'income' gets converted to 'income'
    for (const m of allM) {
      if (m.kind === "income" && m.categoryId !== "income") {
        m.categoryId = "income";
        await db.movements.update(m.id, { categoryId: "income" });
      }
    }

    setMovements(allM);
    setRecurrings(allR);
    setInstallments(allI);
    setWorkDays(allW);
    setDayLogs(allD);
    setDebts(allDebts);
  }, []);

  useEffect(() => {
    loadData();
    isWindowAlwaysOnTop().then(setIsPinned);
    requestAppNotificationPermission();
  }, [loadData]);

  // Periodic date & autoAdd & reminder check
  useEffect(() => {
    const checkRoutine = async () => {
      const now = new Date();
      const curToday = formatLocalDate(now);
      if (curToday !== todayStr) {
        setTodayStr(curToday);
      }

      if (!settings) return;

      // 1. Process Auto-Add for recurring and installments
      const [currentRecs, currentInsts, currentMovements] = await Promise.all([
        db.recurrings.toArray(),
        db.installments.toArray(),
        db.movements.toArray(),
      ]);

      const autoResult = processAutoAddRules({
        recurrings: currentRecs,
        installments: currentInsts,
        existingMovements: currentMovements,
        todayStr: curToday,
      });

      if (autoResult.movementsToAdd.length > 0) {
        for (const mov of autoResult.movementsToAdd) {
          await db.movements.put(mov);
        }
        for (const rec of autoResult.updatedRecurrings) {
          await db.recurrings.put(rec);
        }
        for (const inst of autoResult.updatedInstallments) {
          await db.installments.put(inst);
        }
        await loadData();
      }

      // 2. Check Daily Reminder
      const curMovements = await db.movements.toArray();
      const curLogs = await db.dayLogs.toArray();
      const hasLoggedToday = isDayLogged(curToday, curMovements, curLogs);

      const reminderSentRecord = await db.remindersSent.get(`daily_${curToday}`);
      const alreadySentToday = !!reminderSentRecord;

      const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      if (
        shouldTriggerDailyReminder({
          currentHHMM,
          reminderTime: settings.reminderTime,
          reminderEnabled: settings.reminderEnabled,
          isTodayLogged: hasLoggedToday,
          alreadySentToday,
        })
      ) {
        await sendAppNotification(
          "Bolsillo: Recordatorio diario",
          "¿Tuviste algún gasto hoy? Anotalo para mantener tus números claros."
        );
        await db.remindersSent.put({
          key: `daily_${curToday}`,
          sentAt: now.toISOString(),
        });
      }

      // 3. Check Due Alerts
      const allSentRecords = await db.remindersSent.toArray();
      const sentKeysSet = new Set(allSentRecords.map((r) => r.key));

      const currentUpcoming = getUpcomingItems({
        recurrings: currentRecs,
        installments: currentInsts,
        refDateInput: now,
      });

      const alerts = getDueAlertsToNotify({
        upcomingItems: currentUpcoming,
        dueAlertDays: settings.dueAlertDays,
        alreadySentKeys: sentKeysSet,
      });

      for (const alert of alerts) {
        await sendAppNotification(alert.title, alert.body);
        await db.remindersSent.put({
          key: alert.key,
          sentAt: now.toISOString(),
        });
      }
    };

    checkRoutine();
    const interval = setInterval(checkRoutine, 60000);
    return () => clearInterval(interval);
  }, [settings, todayStr, loadData]);

  // Derived Calculations
  const periodInfo: PeriodInfo = useMemo(() => {
    if (
      settings?.incomeMode === "daily" &&
      settings?.dailyRangeStart &&
      settings?.dailyRangeEnd
    ) {
      return calculateVariablePeriod(
        settings.dailyRangeStart,
        settings.dailyRangeEnd,
        todayStr
      );
    }

    return calculatePeriod(todayStr, settings?.payday || 1);
  }, [todayStr, settings?.incomeMode, settings?.dailyRangeStart, settings?.dailyRangeEnd, settings?.payday]);

  // Modo variable: suma de los días del rango (tarifa L-S, domingo libre, días editados a mano)
  const variableIncome = useMemo(
    () => (settings?.incomeMode === "daily" ? calculateVariableIncome(settings, workDays) : 0),
    [settings, workDays]
  );

  const balanceSummary = useMemo(() => {
    return calculateBalance({
      incomeMode: settings?.incomeMode || "salary",
      fixedSalary: settings?.fixedSalary || 0,
      variableIncome,
      periodStart: periodInfo.startDate,
      periodEnd: periodInfo.endDate,
      movements,
      daysRemaining: periodInfo.daysRemaining,
      todayDateStr: todayStr,
    });
  }, [settings?.incomeMode, settings?.fixedSalary, variableIncome, periodInfo, movements, todayStr]);

  // Cartel informativo "Empezaste con $X a favor / Cerraste abajo" (no toca el Disponible)
  const previousBalance = useMemo(
    () =>
      settings
        ? calculatePreviousPeriodBalance({ settings, movements, workDays, currentPeriodStart: periodInfo.startDate })
        : null,
    [settings, movements, workDays, periodInfo.startDate]
  );

  const upcomingItems = useMemo(() => {
    return getUpcomingItems({
      recurrings,
      installments,
      refDateInput: todayStr,
    });
  }, [recurrings, installments, todayStr]);

  const missingDays = useMemo(() => {
    if (!settings) return [];
    return getMissingDays({
      appStartDateStr: settings.createdAt?.split("T")[0] || periodInfo.startDate,
      todayStr,
      movements,
      dayLogs,
    });
  }, [settings, periodInfo.startDate, todayStr, movements, dayLogs]);

  // Handlers
  const handleTogglePin = async () => {
    const next = await toggleAlwaysOnTop(isPinned);
    setIsPinned(next);
  };

  const handleSaveMovement = async (params: {
    amount: number;
    kind: "expense" | "income";
    categoryId: string;
    note?: string;
    date: string;
  }) => {
    const newMovement: Movement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: params.date,
      amount: Math.round(params.amount),
      kind: params.kind,
      categoryId: params.kind === "income" ? "income" : params.categoryId,
      note: params.note,
      source: "manual",
      createdAt: new Date().toISOString(),
    };

    await db.movements.put(newMovement);
    await markDayAsLogged(params.date);
    await loadData();

    // 4-second Undo Toast
    const catName =
      params.kind === "income"
        ? "Ingreso de plata"
        : settings?.categories.find((c) => c.id === params.categoryId)?.name || "Gasto";
    const sign = params.kind === "expense" ? "-$" : "+$";
    const msg = `Guardado: ${sign} ${formatNumberWithDots(Math.round(params.amount))} en ${catName}`;

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ id: newMovement.id, message: msg });
    undoTimerRef.current = setTimeout(() => {
      setUndoToast(null);
    }, 4000);
  };

  const handleUndoRecent = async () => {
    if (undoToast) {
      await handleDeleteMovement(undoToast.id);
      setUndoToast(null);
    }
  };

  const handleMarkNoExpenses = async (dateStr: string) => {
    await markDayAsNoExpenses(dateStr);
    await loadData();
  };

  const handleSetWorkDay = async (dateStr: string, worked: boolean, amount: number) => {
    await setWorkDay(dateStr, worked, amount);
    await loadData();
  };

  const handleResetWorkDay = async (dateStr: string) => {
    await resetWorkDay(dateStr);
    await loadData();
  };

  const handleUpdateSettings = async (partial: Partial<Settings>) => {
    const updated = await updateSettings(partial);
    setSettings(updated);
    if (partial.autostart !== undefined) {
      setAppAutostart(partial.autostart);
    }
  };

  const handleAddRecurring = async (recData: Omit<Recurring, "id">) => {
    const newRec: Recurring = {
      ...recData,
      id: `rec_${Date.now()}`,
    };
    await db.recurrings.put(newRec);
    await loadData();
  };

  const handleDeleteRecurring = async (id: string) => {
    await db.recurrings.delete(id);
    await loadData();
  };

  const handleAddInstallment = async (instData: Omit<Installment, "id">) => {
    const newInst: Installment = {
      ...instData,
      id: `inst_${Date.now()}`,
    };
    await db.installments.put(newInst);
    await loadData();
  };

  const handleDeleteInstallment = async (id: string) => {
    await db.installments.delete(id);
    await loadData();
  };

  const handlePayInstallment = async (inst: Installment) => {
    if (inst.paidCount >= inst.installmentsCount) return;
    const nextPaid = inst.paidCount + 1;
    const isDone = nextPaid >= inst.installmentsCount;

    const movement: Movement = {
      id: `mov_inst_${inst.id}_${nextPaid}_${Date.now()}`,
      date: todayStr,
      amount: inst.installmentAmount,
      kind: "expense",
      categoryId: inst.categoryId,
      note: `${inst.name} (Cuota ${nextPaid}/${inst.installmentsCount})`,
      source: "installment",
      installmentId: inst.id,
      createdAt: new Date().toISOString(),
    };

    await db.movements.put(movement);
    await db.installments.put({
      ...inst,
      paidCount: nextPaid,
      active: !isDone,
    });
    await loadData();
  };

  const handleDeleteMovement = async (id: string) => {
    await db.movements.delete(id);
    await loadData();
  };

  const handleUpdateMovement = async (m: Movement) => {
    await db.movements.put(m);
    await loadData();
  };

  const handleAddDebtItem = async (d: Omit<Debt, "id" | "settled" | "createdAt">) => {
    await addDebt(d);
    await loadData();
  };

  const handleSettleDebtItem = async (debt: Debt, addToMovement: boolean) => {
    await settleDebt(debt.id, addToMovement, todayStr);
    await loadData();
  };

  const handleDeleteDebtItem = async (id: string) => {
    await deleteDebt(id);
    await loadData();
  };

  if (!settings) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-white/50 text-xs">
        Cargando Bolsillo...
      </div>
    );
  }

  const isLight = settings.theme === "light";

  return (
    <div
      data-tauri-drag-region
      className={`w-full h-full select-none box-border flex items-center justify-center ${
        isLight ? "theme-light bg-[#FFFFFF] text-black" : "bg-[#000000] text-white"
      }`}
    >
      {/* Onboarding Overlay */}
      {!settings.onboardingDone && (
        <OnboardingPanel
          onComplete={async (updates) => {
            await handleUpdateSettings(updates);
            await loadData();
          }}
        />
      )}

      {/* Main card container with solid color, 18px rounded borders and 1px border */}
      <div
        data-tauri-drag-region
        className={`w-full h-full rounded-[18px] border relative overflow-hidden flex flex-col transition-colors duration-150 ${
          isLight
            ? "bg-[#FFFFFF] border-[#E4E4E7] text-black"
            : "bg-[#000000] border-[#262626] text-white"
        }`}
      >
        {/* DESKTOP HEADER (Only in desktop view or when running in Tauri) */}
        {!isMobilePreview && isTauri() && (
          <header
            data-tauri-drag-region
            className={`h-9 px-4 pt-1 flex items-center justify-between shrink-0 select-none cursor-grab active:cursor-grabbing border-b ${
              isLight ? "border-zinc-200" : "border-[#1F1F22]"
            }`}
          >
            <div data-tauri-drag-region className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  isLight ? "bg-[#16A34A]" : "bg-[#22C55E]"
                }`}
              />
              <span
                data-tauri-drag-region
                className="text-xs font-black tracking-wider uppercase opacity-80"
              >
                Bolsillo
              </span>
            </div>

            {/* Window action buttons */}
            <div className="flex items-center gap-1.5 z-10" data-no-drag>
              {/* Mobile Preview Toggle Button */}
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setIsMobilePreview(!isMobilePreview)}
                title="Previsualizar modo Celular (iPhone)"
                className={`p-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                  isLight
                    ? "hover:bg-zinc-100 text-zinc-500 hover:text-black"
                    : "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                <Smartphone size={13} />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={handleTogglePin}
                title={isPinned ? "Desfijar de encima" : "Fijar encima de todo"}
                className={`p-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                  isPinned
                    ? "bg-amber-400/20 text-amber-500 font-extrabold"
                    : isLight
                    ? "hover:bg-zinc-100 text-zinc-500 hover:text-black"
                    : "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                <Pin size={13} className={isPinned ? "rotate-45" : ""} />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={minimizeWindow}
                title="Minimizar"
                className={`p-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                  isLight
                    ? "hover:bg-zinc-100 text-zinc-500 hover:text-black"
                    : "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                <Minus size={13} />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={closeWindow}
                title="Cerrar"
                className={`p-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                  isLight
                    ? "hover:bg-red-100 text-zinc-500 hover:text-red-600"
                    : "hover:bg-red-950/40 text-zinc-400 hover:text-red-400"
                }`}
              >
                <X size={13} />
              </button>
            </div>
          </header>
        )}

        {/* ============================================================== */}
        {/* VIEW A: MOBILE LAYOUT (Active when width < 480 or preview)     */}
        {/* ============================================================== */}
        {isMobileLayout ? (
          <div className="flex-1 flex flex-col justify-between overflow-hidden relative">
            {/* If Preview inside Desktop: iPhone Outer Frame Header */}
            {isMobilePreview && (
              <div className="w-full px-3 py-1 flex items-center justify-between border-b border-zinc-500/10 bg-zinc-900/40 text-xs font-black z-30 shrink-0">
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <Smartphone size={13} />
                  <span>Simulador iPhone (Vista Móvil)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobilePreview(false)}
                  className="px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black cursor-pointer"
                >
                  Volver a PC ✕
                </button>
              </div>
            )}

            {/* Scrollable Mobile Body */}
            <div className="flex-1 overflow-y-auto scrollbar-none p-3 flex flex-col gap-2">
              {/* Missing Days Banner if any */}
              <BannerMissingDays
                missingDays={missingDays}
                isLight={isLight}
                onSelectMissingDay={(dateStr) => {
                  setSelectedDateStr(dateStr);
                }}
              />

              {/* HERO Card */}
              <Hero
                summary={balanceSummary}
                previousBalance={previousBalance}
                daysRemaining={periodInfo.daysRemaining}
                isLight={isLight}
                onOpenMovements={() => setActiveSheet("movements")}
                onOpenWorkDays={() => setActiveSheet("income")}
              />

              {/* Horizontal Days Strip (Hoy + 3 días + '+ Días') */}
              <MobileDayStrip
                todayStr={todayStr}
                selectedDateStr={selectedDateStr}
                onSelectDate={(date) => setSelectedDateStr(date)}
                onMarkNoExpenses={handleMarkNoExpenses}
                movements={movements}
                categories={settings.categories}
                dayLogs={dayLogs}
                isLight={isLight}
              />

              {/* Full Width Calculator for Thumb typing */}
              <div className="flex-1 min-h-[300px]">
                <Calculator
                  categories={settings.categories}
                  selectedDateStr={selectedDateStr}
                  onChangeDate={(date) => setSelectedDateStr(date)}
                  isLight={isLight}
                  onSaveMovement={handleSaveMovement}
                />
              </div>
            </div>

            {/* Bottom iOS Navigation Bar */}
            <nav
              className={`w-full py-1.5 px-3 border-t flex items-center justify-around select-none shrink-0 z-20 pb-safe ${
                isLight
                  ? "bg-white/95 border-zinc-200 text-zinc-600"
                  : "bg-[#0A0A0C]/95 border-[#202022] text-zinc-400"
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className={`flex flex-col items-center gap-0.5 text-[9px] font-black cursor-pointer transition-colors ${
                  activeSheet === null
                    ? isLight
                      ? "text-black"
                      : "text-white"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                <Wallet size={16} />
                <span>Inicio</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSheet("movements")}
                className={`flex flex-col items-center gap-0.5 text-[9px] font-black cursor-pointer transition-colors ${
                  activeSheet === "movements"
                    ? isLight
                      ? "text-black"
                      : "text-white"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                <Receipt size={16} />
                <span>Movimientos</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSheet("fixed")}
                className={`flex flex-col items-center gap-0.5 text-[9px] font-black cursor-pointer transition-colors ${
                  activeSheet === "fixed"
                    ? isLight
                      ? "text-black"
                      : "text-white"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                <Repeat size={16} />
                <span>Fijos/Cuotas</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSheet("debts")}
                className={`flex flex-col items-center gap-0.5 text-[9px] font-black cursor-pointer transition-colors ${
                  activeSheet === "debts"
                    ? isLight
                      ? "text-black"
                      : "text-white"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                <Users size={16} />
                <span>Deudas</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSheet("settings")}
                className={`flex flex-col items-center gap-0.5 text-[9px] font-black cursor-pointer transition-colors ${
                  activeSheet === "settings"
                    ? isLight
                      ? "text-black"
                      : "text-white"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                <SettingsNavIcon size={16} />
                <span>Ajustes</span>
              </button>
            </nav>
          </div>
        ) : (
          /* ============================================================== */
          /* VIEW B: DESKTOP 3-COLUMN LAYOUT (540x600)                      */
          /* ============================================================== */
          <main
            data-tauri-drag-region
            className="flex-1 p-3 flex flex-col justify-between overflow-hidden gap-2"
          >
            {/* Missing Days Banner if any */}
            <BannerMissingDays
              missingDays={missingDays}
              isLight={isLight}
              onSelectMissingDay={(dateStr) => {
                setSelectedDateStr(dateStr);
              }}
            />

            {/* Top HERO: Saldo disponible, barra de progreso y gasto diario */}
            <Hero
              summary={balanceSummary}
              previousBalance={previousBalance}
              daysRemaining={periodInfo.daysRemaining}
              isLight={isLight}
              onOpenMovements={() => setActiveSheet("movements")}
              onOpenWorkDays={() => setActiveSheet("income")}
            />

            {/* Bottom Layout: 3 Columns (Days Strip, Calculator, Right Widget) */}
            <div className="flex-1 flex items-stretch gap-2 min-h-0 overflow-hidden">
              {/* Columna Izquierda: Ajustes, 4 Días con detalle, Calendario */}
              <DayStrip
                todayStr={todayStr}
                selectedDateStr={selectedDateStr}
                onSelectDate={(date) => setSelectedDateStr(date)}
                onOpenSettings={() => setActiveSheet("settings")}
                onOpenCalendar={() => setActiveSheet("calendar")}
                onMarkNoExpenses={handleMarkNoExpenses}
                movements={movements}
                categories={settings.categories}
                dayLogs={dayLogs}
                isLight={isLight}
              />

              {/* Centro: Calculadora y Carga Rápida */}
              <Calculator
                categories={settings.categories}
                selectedDateStr={selectedDateStr}
                onChangeDate={(date) => setSelectedDateStr(date)}
                isLight={isLight}
                onSaveMovement={handleSaveMovement}
              />

              {/* Columna Derecha: Próximos Vencimientos y Deudas */}
              <RightColumnWidget
                items={upcomingItems}
                debts={debts}
                isLight={isLight}
                onOpenFixedAndInstallments={() => setActiveSheet("fixed")}
                onOpenDebts={() => setActiveSheet("debts")}
                onSettleDebt={(debt) => handleSettleDebtItem(debt, true)}
              />
            </div>
          </main>
        )}

        {/* ============================================================== */}
        {/* FLOATING UNDO (DESHACER) TOAST                                 */}
        {/* ============================================================== */}
        <AnimatePresence>
          {undoToast && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 rounded-xl bg-[#18181B] border border-[#27272A] text-white shadow-2xl flex items-center gap-3 text-xs select-none max-w-[90%]"
            >
              <span className="font-extrabold truncate max-w-[210px]">
                {undoToast.message}
              </span>
              <button
                type="button"
                onClick={handleUndoRecent}
                className="px-2.5 py-0.5 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-black text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                <RotateCcw size={11} strokeWidth={3} />
                <span>Deshacer</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============================================================== */}
        {/* SLIDING INTERNAL SHEETS                                        */}
        {/* ============================================================== */}
        <Sheet
          isOpen={activeSheet === "movements"}
          onClose={() => setActiveSheet(null)}
          title="Movimientos del Período"
          subtitle={`Desde el ${periodInfo.startDate} hasta el ${periodInfo.endDate}`}
          isLight={isLight}
        >
          <MovementsPanel
            movements={movements}
            categories={settings.categories}
            periodStart={periodInfo.startDate}
            periodEnd={periodInfo.endDate}
            isLight={isLight}
            onDeleteMovement={handleDeleteMovement}
            onUpdateMovement={handleUpdateMovement}
          />
        </Sheet>

        <Sheet
          isOpen={activeSheet === "fixed"}
          onClose={() => setActiveSheet(null)}
          title="Fijos y Cuotas"
          subtitle="Suscripciones, servicios mensuales y compras en cuotas"
          isLight={isLight}
        >
          <FixedAndInstallmentsPanel
            recurrings={recurrings}
            installments={installments}
            categories={settings.categories}
            isLight={isLight}
            onAddRecurring={handleAddRecurring}
            onUpdateRecurring={async (r) => {
              await db.recurrings.put(r);
              await loadData();
            }}
            onDeleteRecurring={handleDeleteRecurring}
            onAddInstallment={handleAddInstallment}
            onUpdateInstallment={async (i) => {
              await db.installments.put(i);
              await loadData();
            }}
            onDeleteInstallment={handleDeleteInstallment}
            onPayInstallment={handlePayInstallment}
          />
        </Sheet>

        <Sheet
          isOpen={activeSheet === "debts"}
          onClose={() => setActiveSheet(null)}
          title="Deudas y Cobros"
          subtitle="Lo que debés y lo que te deben"
          isLight={isLight}
        >
          <DebtsPanel
            debts={debts}
            isLight={isLight}
            onAddDebt={handleAddDebtItem}
            onSettleDebt={handleSettleDebtItem}
            onDeleteDebt={handleDeleteDebtItem}
          />
        </Sheet>

        <Sheet
          isOpen={activeSheet === "income"}
          onClose={() => setActiveSheet(null)}
          title="Días trabajados"
          subtitle="Tocá un día para cambiarle el monto o marcarlo como libre"
          isLight={isLight}
        >
          <WorkDaysPanel
            settings={settings}
            workDays={workDays}
            todayStr={todayStr}
            isLight={isLight}
            onSetWorkDay={handleSetWorkDay}
            onResetWorkDay={handleResetWorkDay}
            onUpdateSettings={handleUpdateSettings}
          />
        </Sheet>

        <Sheet
          isOpen={activeSheet === "calendar"}
          onClose={() => setActiveSheet(null)}
          title="Calendario Mensual"
          subtitle="Vista completa de días y gastos"
          isLight={isLight}
        >
          <CalendarPanel
            movements={movements}
            categories={settings.categories}
            dayLogs={dayLogs}
            todayStr={todayStr}
            selectedDateStr={selectedDateStr}
            isLight={isLight}
            onSelectDate={(date) => setSelectedDateStr(date)}
            onMarkNoExpenses={handleMarkNoExpenses}
          />
        </Sheet>

        <Sheet
          isOpen={activeSheet === "settings"}
          onClose={() => setActiveSheet(null)}
          title="Ajustes de Bolsillo"
          subtitle="Configuración general, temas y copia de seguridad"
          isLight={isLight}
        >
          <SettingsPanel
            settings={settings}
            isLight={isLight}
            isMobilePreview={isMobilePreview}
            onToggleMobilePreview={() => {
              setIsMobilePreview(!isMobilePreview);
              setActiveSheet(null);
            }}
            onUpdateSettings={handleUpdateSettings}
            onRefreshData={loadData}
            onOpenWorkDays={() => setActiveSheet("income")}
          />
        </Sheet>
      </div>
    </div>
  );
}
