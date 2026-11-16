import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Pin,
  Minus,
  X,
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
  setCloseToTray,
  setWindowZoom,
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
  WINDOW_ZOOM_VALUES,
  WorkDay,
} from "./types";
import { getVaultPrefs, loadVaultMeta, lock as lockStore, lockMode, store, updateVaultPrefs } from "./db/store";
import { LockScreen } from "./components/LockScreen";
import { Tour, TourStep } from "./components/Tour";
import { flushSync } from "react-dom";
import {
  addDebt,
  deleteDebt,
  getSettings,
  markDayAsLogged,
  markDayAsNoExpenses,
  settleDebts,
  setWorkDay,
  resetWorkDay,
  updateSettings,
} from "./db/repo";
import { calculatePeriod, calculateVariablePeriod } from "./lib/period";
import { calculateBalance } from "./lib/balance";
import { calculateVariableIncome } from "./lib/workdays";
import { calculatePreviousPeriodBalance } from "./lib/carryover";
import {
  getInstallmentAmount,
  getUpcomingItems,
  processAutoAddRules,
} from "./lib/recurring";
import {
  getDueAlertsToNotify,
  getMissingDays,
  isDayLogged,
  shouldTriggerDailyReminder,
} from "./lib/reminders";
import { formatCurrency, formatLocalDate, formatNumberWithDots, formatShortDate, setAmountsHidden } from "./lib/format";
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
import { SummaryPanel } from "./panels/SummaryPanel";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { APP_VERSION } from "./lib/constants";
import { backupStatus } from "./lib/backupReminder";
import { whatsNewToShow } from "./lib/whatsNew";
import { pendingCommitments, savingsAmount, spendingPlan } from "./lib/spending";
import { limitWarning } from "./lib/limits";
import { NOVEDADES } from "./novedades";
import { applyPwaUpdate, removeServiceWorkers, requestPersistentStorage, startPwaUpdates } from "./platform/pwa";

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
    null | "movements" | "fixed" | "debts" | "income" | "calendar" | "settings" | "summary"
  >(null);

  // Aviso con "Deshacer" (guardar, saldar, borrar…): cada acción trae su propia forma de deshacerse
  const [undoToast, setUndoToast] = useState<{ message: string; undo: () => Promise<void>; warning?: string } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showUndo = (message: string, undo: () => Promise<void>, ms = 6000, warning?: string) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ message, undo, warning });
    undoTimerRef.current = setTimeout(() => setUndoToast(null), ms);
  };

  // Celular real (PWA): ancho menor a 480 px
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsNarrowScreen(window.innerWidth < 480);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobileLayout = isNarrowScreen;

  // Load all data from Dexie
  // Ojo de "Disponible": tapa todos los montos. Arranca oculto si quedó así o si se pidió "Abrir siempre…"
  const [amountsHidden, setAmountsHiddenState] = useState<boolean | null>(null);

  // Sube cada vez que se bloquea: una carga que empezó antes no puede volver a llenar la pantalla después
  const lockGen = useRef(0);

  const loadData = useCallback(async () => {
    const gen = lockGen.current;
    const s = await getSettings();
    if (gen !== lockGen.current) return;
    setSettings(s);
    setAmountsHiddenState((cur) => (cur === null ? s.startHidden || s.hideAmounts : cur));

    const [allM, allR, allI, allW, allD, allDebts] = await Promise.all([
      store.movements.toArray().then((ms) => ms.sort((a, b) => b.date.localeCompare(a.date))),
      store.recurrings.toArray(),
      store.installments.toArray(),
      store.workDays.toArray(),
      store.dayLogs.toArray(),
      store.debts.toArray(),
    ]);

    // Automatic migration: Any income movement with categoryId !== 'income' gets converted to 'income'
    for (const m of allM) {
      if (m.kind === "income" && m.categoryId !== "income") {
        m.categoryId = "income";
        await store.movements.put(m);
      }
    }

    if (gen !== lockGen.current) return;
    setMovements(allM);
    setRecurrings(allR);
    setInstallments(allI);
    setWorkDays(allW);
    setDayLogs(allD);
    setDebts(allDebts);
  }, []);

  // Contraseña y cifrado: "checking" al arrancar, "off" sin cifrado, "locked" / "unlocked" con cifrado
  const [vault, setVault] = useState<"checking" | "off" | "locked" | "unlocked">("checking");
  const [covered, setCovered] = useState(false); // tapa la app en el selector de apps
  useEffect(() => {
    loadVaultMeta().then(() => setVault(lockMode() !== "none" ? "locked" : "off"));
    isWindowAlwaysOnTop().then(setIsPinned);
    requestAppNotificationPermission();
  }, []);

  useEffect(() => {
    if (vault === "off" || vault === "unlocked") loadData();
  }, [vault, loadData]);

  /** Bloquea: borra las claves de memoria y desmonta toda la interfaz con datos. */
  const lockApp = useCallback(() => {
    lockGen.current++;
    lockStore();
    setSettings(null);
    setMovements([]);
    setRecurrings([]);
    setInstallments([]);
    setWorkDays([]);
    setDayLogs([]);
    setDebts([]);
    setActiveSheet(null);
    setPendingDelete(null);
    setUndoToast(null);
    setAmountsHiddenState(null);
    setVault("locked");
  }, []);

  // Tutorial: aparece solo después de la bienvenida (y desde Ajustes → "Ver tutorial")
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    if (settings?.onboardingDone && !settings.tutorialDone) setTourOpen(true);
  }, [settings?.onboardingDone, settings?.tutorialDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // La pantalla de bloqueo se dibuja con el tema elegido, sin descifrar nada: se copia afuera
  useEffect(() => {
    if (settings && lockMode() !== "none") updateVaultPrefs({ theme: settings.theme }).catch(() => {});
  }, [settings?.theme, vault]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al salir de la app: tapar la pantalla (selector de apps) y bloquear según "Bloquear al salir de la app".
  // Avisos: visibilitychange y pagehide (celular) y "app-hidden"/"app-shown" que manda Rust al esconder en la bandeja.
  useEffect(() => {
    if (vault !== "unlocked") return;
    let hiddenAt = 0;
    const onHidden = () => {
      if (hiddenAt) return;
      hiddenAt = Date.now();
      flushSync(() => setCovered(true));
      if ((getVaultPrefs()?.lockAfterMs ?? 5000) === 0) lockApp();
    };
    const onShown = () => {
      if (hiddenAt && Date.now() - hiddenAt >= (getVaultPrefs()?.lockAfterMs ?? 5000)) lockApp();
      hiddenAt = 0;
      setCovered(false);
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? onHidden() : onShown());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHidden);
    window.addEventListener("pageshow", onShown);
    const unlisten: (() => void)[] = [];
    let cancelled = false; // listen() responde tarde: si ya se limpió, se suelta enseguida
    const keep = (u: () => void) => (cancelled ? u() : unlisten.push(u));
    if (isTauri()) {
      import("@tauri-apps/api/event").then(({ listen }) => {
        listen("app-hidden", onHidden).then(keep);
        listen("app-shown", onShown).then(keep);
      });
    }
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHidden);
      window.removeEventListener("pageshow", onShown);
      unlisten.forEach((u) => u());
    };
  }, [vault, lockApp]);

  // Rust necesita saber si "cerrar" esconde al tray o cierra de verdad (bug #10)
  useEffect(() => {
    if (settings) setCloseToTray(settings.closeToTray);
  }, [settings?.closeToTray]); // eslint-disable-line react-hooks/exhaustive-deps

  // PWA: buscar versión nueva al abrir y al volver a primer plano; en escritorio no hay service worker
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => {
    if (isTauri()) removeServiceWorkers().catch(() => {});
    else {
      startPwaUpdates(() => setUpdateReady(true));
      requestPersistentStorage();
    }
  }, []);

  // PWA: la barra de estado del celular y el fondo detrás de la app siguen el tema (en escritorio no se toca)
  useEffect(() => {
    if (!settings || isTauri()) return;
    const color = settings.theme === "light" ? "#FFFFFF" : "#000000";
    document.documentElement.style.background = color;
    document.body.style.background = color;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
  }, [settings?.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tamaño de ventana guardado (Automático = Rust mira el monitor)
  useEffect(() => {
    if (!settings) return;
    const z = settings.windowZoom ?? "auto";
    setWindowZoom(z === "auto" ? null : WINDOW_ZOOM_VALUES[z]);
  }, [settings?.windowZoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic date & autoAdd & reminder check
  useEffect(() => {
    const checkRoutine = async () => {
      const now = new Date();
      const curToday = formatLocalDate(now);
      if (curToday !== todayStr) {
        setTodayStr(curToday);
        // Pasada la medianoche, si estaba seleccionado "hoy", que siga siendo hoy (bug #11)
        setSelectedDateStr((sel) => (sel === todayStr ? curToday : sel));
      }

      if (!settings || (lockMode() !== "none" && vault !== "unlocked")) return;

      // 1. Process Auto-Add for recurring and installments
      const [currentRecs, currentInsts, currentMovements] = await Promise.all([
        store.recurrings.toArray(),
        store.installments.toArray(),
        store.movements.toArray(),
      ]);

      const autoResult = processAutoAddRules({
        recurrings: currentRecs,
        installments: currentInsts,
        existingMovements: currentMovements,
        todayStr: curToday,
      });

      if (autoResult.movementsToAdd.length > 0) {
        for (const mov of autoResult.movementsToAdd) {
          await store.movements.put(mov);
        }
        for (const rec of autoResult.updatedRecurrings) {
          await store.recurrings.put(rec);
        }
        for (const inst of autoResult.updatedInstallments) {
          await store.installments.put(inst);
        }
        await loadData();
      }

      // 2. Check Daily Reminder
      const curMovements = await store.movements.toArray();
      const curLogs = await store.dayLogs.toArray();
      const hasLoggedToday = isDayLogged(curToday, curMovements, curLogs);

      const reminderSentRecord = await store.remindersSent.get(`daily_${curToday}`);
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
        await store.remindersSent.put({
          key: `daily_${curToday}`,
          sentAt: now.toISOString(),
        });
      }

      // 3. Check Due Alerts
      const allSentRecords = await store.remindersSent.toArray();
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
        // Con contraseña, el aviso del sistema no muestra nombres ni montos (queda en el historial y en la pantalla bloqueada)
        if (lockMode() !== "none") await sendAppNotification("Bolsillo", "Tenés un vencimiento cerca. Abrí Bolsillo para verlo.");
        else await sendAppNotification(alert.title, alert.body);
        await store.remindersSent.put({
          key: alert.key,
          sentAt: now.toISOString(),
        });
      }
    };

    // Si se bloqueó a mitad de camino, el próximo chequeo lo retoma
    const safeRoutine = () => checkRoutine().catch(() => {});
    safeRoutine();
    const interval = setInterval(safeRoutine, 60000);
    return () => clearInterval(interval);
  }, [settings, todayStr, loadData, vault]);

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

  // Podés gastar por día: descuenta fijos y cuotas que todavía van a vencer en el período (y el ahorro)
  const plan = useMemo(() => {
    const commitments = pendingCommitments({ recurrings, installments, todayStr, periodEnd: periodInfo.endDate }).total;
    const savings = settings ? savingsAmount(settings, balanceSummary.totalIncome) : 0;
    return spendingPlan({ available: balanceSummary.available, commitments, savings, daysRemaining: periodInfo.daysRemaining });
  }, [recurrings, installments, todayStr, periodInfo, balanceSummary.available, balanceSummary.totalIncome, settings]);

  // Cartel informativo "Empezaste con $X a favor / Cerraste abajo" (no toca el Disponible)
  const previousBalance = useMemo(
    () =>
      settings
        ? calculatePreviousPeriodBalance({ settings, movements, workDays, currentPeriodStart: periodInfo.startDate, todayStr })
        : null,
    [settings, movements, workDays, periodInfo.startDate, todayStr]
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

    // Tope de la categoría: avisar al cruzar el 80% o al pasarse (se guarda igual)
    const cat = settings?.categories.find((c) => c.id === newMovement.categoryId);
    let warning: string | undefined;
    if (cat?.limit && newMovement.kind === "expense" && newMovement.date >= periodInfo.startDate && newMovement.date <= periodInfo.endDate) {
      const before = movements
        .filter((m) => m.kind === "expense" && m.categoryId === cat.id && m.date >= periodInfo.startDate && m.date <= periodInfo.endDate)
        .reduce((s, m) => s + m.amount, 0);
      warning = limitWarning(before, before + newMovement.amount, cat.limit, cat.name) ?? undefined;
    }

    await store.movements.put(newMovement);
    await markDayAsLogged(params.date);
    await loadData();

    // 4-second Undo Toast
    const catName =
      params.kind === "income"
        ? "Ingreso de plata"
        : settings?.categories.find((c) => c.id === params.categoryId)?.name || "Gasto";
    const sign = params.kind === "expense" ? "-$" : "+$";
    const msg = `Guardado: ${sign} ${formatNumberWithDots(Math.round(params.amount))} en ${catName}`;

    showUndo(msg, async () => {
      await store.movements.delete(newMovement.id);
      // Si ese día queda sin movimientos y no estaba marcado "no gasté nada", vuelve a "sin anotar"
      const remaining = (await store.movements.toArray()).filter((x) => x.date === newMovement.date).length;
      const log = await store.dayLogs.get(newMovement.date);
      if (remaining === 0 && log && !log.noExpenses) await store.dayLogs.delete(newMovement.date);
    }, warning ? 7000 : 4000, warning);
  };

  const handleUndoRecent = async () => {
    if (!undoToast) return;
    const { undo } = undoToast;
    setUndoToast(null);
    await undo();
    await loadData();
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
    if (partial.closeToTray !== undefined) {
      setCloseToTray(partial.closeToTray);
    }
  };

  const handleAddRecurring = async (recData: Omit<Recurring, "id">) => {
    const newRec: Recurring = {
      ...recData,
      id: `rec_${Date.now()}`,
    };
    await store.recurrings.put(newRec);
    await loadData();
  };

  // Borrar siempre pide confirmación y después ofrece "Deshacer" (vuelve a guardar lo borrado)
  const [pendingDelete, setPendingDelete] = useState<{ title: string; detail: string; run: () => Promise<void> } | null>(null);
  const confirmDelete = <T,>(
    item: T | undefined,
    title: string,
    detail: string,
    remove: () => Promise<unknown>,
    restore: (item: T) => Promise<unknown>,
    doneMessage: string
  ) => {
    if (!item) return;
    setPendingDelete({
      title,
      detail,
      run: async () => {
        await remove();
        await loadData();
        showUndo(doneMessage, async () => {
          await restore(item);
        });
      },
    });
  };

  const handleDeleteRecurring = (id: string) => {
    const r = recurrings.find((x) => x.id === id);
    confirmDelete(
      r,
      "¿Borrar este fijo?",
      r ? `"${r.name}" · ${formatCurrency(r.amount)} por mes. Los gastos que ya se anotaron quedan.` : "",
      () => store.recurrings.delete(id),
      (x) => store.recurrings.put(x),
      "Fijo borrado"
    );
  };

  const handleAddInstallment = async (instData: Omit<Installment, "id">) => {
    const newInst: Installment = {
      ...instData,
      id: `inst_${Date.now()}`,
    };
    await store.installments.put(newInst);
    await loadData();
  };

  const handleDeleteInstallment = (id: string) => {
    const i = installments.find((x) => x.id === id);
    confirmDelete(
      i,
      "¿Borrar esta compra en cuotas?",
      i
        ? `"${i.name}" · ${formatCurrency(i.totalAmount)} en ${i.installmentsCount} cuotas (${i.paidCount} pagadas). Las cuotas ya anotadas quedan.`
        : "",
      () => store.installments.delete(id),
      (x) => store.installments.put(x),
      "Cuotas borradas"
    );
  };

  const handlePayInstallment = async (inst: Installment) => {
    if (inst.paidCount >= inst.installmentsCount) return;
    const nextPaid = inst.paidCount + 1;
    const isDone = nextPaid >= inst.installmentsCount;

    const movement: Movement = {
      id: `mov_inst_${inst.id}_${nextPaid}_${Date.now()}`,
      date: todayStr,
      amount: getInstallmentAmount(inst, nextPaid),
      kind: "expense",
      categoryId: inst.categoryId,
      note: `${inst.name} (Cuota ${nextPaid}/${inst.installmentsCount})`,
      source: "installment",
      installmentId: inst.id,
      createdAt: new Date().toISOString(),
    };

    await store.movements.put(movement);
    await store.installments.put({
      ...inst,
      paidCount: nextPaid,
      active: !isDone,
    });
    await loadData();
  };

  const handleDeleteMovement = (id: string) => {
    const m = movements.find((x) => x.id === id);
    const cat =
      m?.kind === "income" ? "Ingreso de plata" : settings?.categories.find((c) => c.id === m?.categoryId)?.name ?? "Otros";
    confirmDelete(
      m,
      "¿Borrar este movimiento?",
      m
        ? `${m.kind === "expense" ? "Gasto" : "Ingreso"} de ${formatCurrency(m.amount)} · ${cat}${m.note ? ` · ${m.note}` : ""} · ${formatShortDate(m.date)}`
        : "",
      () => store.movements.delete(id),
      (x) => store.movements.put(x),
      "Movimiento borrado"
    );
  };

  const handleUpdateMovement = async (m: Movement) => {
    await store.movements.put(m);
    await loadData();
  };

  const handleAddDebtItem = async (d: Omit<Debt, "id" | "settled" | "createdAt">) => {
    await addDebt(d);
    await loadData();
  };

  const handleSettleDebts = async (list: Debt[], addToMovement: boolean) => {
    const undo = await settleDebts(list.map((d) => d.id), addToMovement, todayStr);
    await loadData();
    const total = list.reduce((s, d) => s + d.amount, 0);
    showUndo(
      list.length === 1
        ? `Saldada: ${list[0].person} ${formatCurrency(total)}`
        : `Saldadas ${list.length} deudas de ${list[0].person}`,
      undo
    );
  };

  const handleDeleteDebtItem = (id: string) => {
    const d = debts.find((x) => x.id === id);
    confirmDelete(
      d,
      "¿Borrar esta deuda?",
      d
        ? `${d.person} · ${formatCurrency(d.amount)} (${d.kind === "i_owe" ? "le debés" : "te debe"})${d.note ? ` · ${d.note}` : ""}${d.settled ? " · ya saldada" : ""}`
        : "",
      () => deleteDebt(id),
      (x) => store.debts.put(x),
      "Deuda borrada"
    );
  };

  if (vault === "locked") {
    return (
      <LockScreen
        onUnlocked={() => setVault("unlocked")}
        onWiped={() => {
          setVault("off");
        }}
      />
    );
  }

  if (!settings) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-white/50 text-xs">
        Cargando Bolsillo...
      </div>
    );
  }

  const isLight = settings.theme === "light";
  // Antes de dibujar los hijos: todos los formatCurrency de esta pasada usan el estado del ojo
  setAmountsHidden(!!amountsHidden);
  const toggleAmountsHidden = () => {
    const next = !amountsHidden;
    setAmountsHiddenState(next);
    updateSettings({ hideAmounts: next }).then(setSettings);
  };

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
          isLight={isLight}
          onComplete={async (updates) => {
            await handleUpdateSettings({ ...updates, lastSeenVersion: APP_VERSION });
            await loadData();
          }}
        />
      )}

      {/* Main card container with solid color, 18px rounded borders and 1px border */}
      <div
        data-tauri-drag-region
        className={`w-full h-full relative overflow-hidden flex flex-col transition-colors duration-150 ${
          isMobileLayout ? "pt-safe" : "rounded-[18px] border"
        } ${
          isLight
            ? "bg-[#FFFFFF] border-[#E4E4E7] text-black"
            : "bg-[#000000] border-[#262626] text-white"
        }`}
      >
        {/* DESKTOP HEADER (Only in desktop view or when running in Tauri) */}
        {isTauri() && (
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
        {/* VIEW A: MOBILE LAYOUT (celular real, ancho < 480)              */}
        {/* ============================================================== */}
        {isMobileLayout ? (
          <div className="flex-1 flex flex-col justify-between overflow-hidden relative">
            {/* Scrollable Mobile Body */}
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none p-3 flex flex-col gap-2">
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
                plan={plan}
                previousBalance={previousBalance}
                daysRemaining={periodInfo.daysRemaining}
                isLight={isLight}
                onOpenMovements={() => setActiveSheet("movements")}
                onOpenWorkDays={() => setActiveSheet("income")}
                onOpenSummary={() => setActiveSheet("summary")}
                amountsHidden={!!amountsHidden}
                onToggleHidden={toggleAmountsHidden}
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
                onDeleteMovement={handleDeleteMovement}
                onUpdateMovement={handleUpdateMovement}
              />

              {/* Calculadora abajo, en la zona del pulgar: el teclado crece hasta llenar el alto */}
              <div className="flex-1 min-h-[328px] max-h-[540px] mt-auto flex">
                <Calculator
                  fill
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
                data-tour="movements"
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
                data-tour="debts"
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
                data-tour="settings"
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
                <span className="relative">
                  <SettingsNavIcon size={16} />
                  {/* Recordatorio suave: hace más de una semana que no se exporta un backup */}
                  {backupStatus(settings.lastBackupAt, settings.createdAt).overdue && (
                    <span aria-label="Hace falta un backup" className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#D97706]" />
                  )}
                </span>
                <span>Ajustes</span>
              </button>
            </nav>
          </div>
        ) : (
          /* ============================================================== */
          /* VIEW B: DESKTOP 3-COLUMN LAYOUT (540x600 lógicos, zoom 1,5 en Tauri) */
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
                plan={plan}
              previousBalance={previousBalance}
              daysRemaining={periodInfo.daysRemaining}
              isLight={isLight}
              onOpenMovements={() => setActiveSheet("movements")}
              onOpenWorkDays={() => setActiveSheet("income")}
                onOpenSummary={() => setActiveSheet("summary")}
              amountsHidden={!!amountsHidden}
              onToggleHidden={toggleAmountsHidden}
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
                settings={settings}
                workDays={workDays}
                isLight={isLight}
                onDeleteMovement={handleDeleteMovement}
                onUpdateMovement={handleUpdateMovement}
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
                onSettleDebt={(debt) => handleSettleDebts([debt], true)}
              />
            </div>
          </main>
        )}

        {/* ============================================================== */}
        {/* FLOATING UNDO (DESHACER) TOAST                                 */}
        {/* Novedades: una sola vez después de actualizar (no encima del tutorial) */}
        {!tourOpen &&
          (() => {
            const notes = whatsNewToShow(settings, APP_VERSION, NOVEDADES);
            if (!notes) return null;
            return (
              <div
                role="status"
                className={`absolute left-1/2 -translate-x-1/2 bottom-[calc(1rem+var(--safe-bottom))] z-[65] w-[min(92%,340px)] p-3.5 rounded-2xl border flex flex-col gap-2 text-xs select-none ${
                  isLight ? "bg-white border-zinc-300 text-black" : "bg-[#141416] border-[#2A2A2E] text-white"
                }`}
              >
                <span className="text-sm font-extrabold">Se actualizó a v{notes.version}</span>
                <ul className={`flex flex-col gap-1 font-semibold ${isLight ? "text-zinc-700" : "text-zinc-300"}`}>
                  {notes.items.map((t) => (
                    <li key={t}>· {t}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => handleUpdateSettings({ lastSeenVersion: APP_VERSION })}
                  className={`self-end px-3 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                    isLight ? "bg-black text-white hover:bg-zinc-800" : "bg-white text-black hover:bg-zinc-200"
                  }`}
                >
                  Entendido
                </button>
              </div>
            );
          })()}

        {tourOpen && !activeSheet && (
          <Tour
            isLight={isLight}
            steps={[
              { target: "hero", title: "Tu plata disponible", text: "Es lo que te queda hasta el próximo cobro y cuánto podés gastar por día. El ojo tapa los montos." },
              { target: "days", title: "Tus días", text: "Tocá un día para ver o corregir lo que anotaste. El signo ! marca los días que te faltan anotar." },
              { target: "calc", title: "Anotá en segundos", text: "Escribí el monto, elegí la categoría y tocá − Gasto o + Ingreso." },
              settings.incomeMode === "daily"
                ? { target: "workdays", title: "Días trabajados", text: "De lunes a sábado cada día suma tu tarifa. Tocá acá para marcar un día libre o cambiar un monto." }
                : { target: "settings", title: "Tu sueldo", text: "El sueldo y el día de cobro se cambian en Ajustes, igual que el tema y la contraseña." },
              isMobileLayout
                ? { target: "movements", title: "Movimientos y buscador", text: "Ahí está todo lo del período, por categoría, y podés buscar por nota, categoría o monto." }
                : { target: "hero", title: "Movimientos y buscador", text: "Tocá la tarjeta de Disponible para ver todo lo del período y buscar por nota, categoría o monto." },
              { target: "debts", title: "Deudas", text: "Anotá lo que debés y lo que te deben, y marcalo como saldado cuando se pague." },
            ] satisfies TourStep[]}
            onClose={() => {
              setTourOpen(false);
              if (!settings.tutorialDone) handleUpdateSettings({ tutorialDone: true });
            }}
          />
        )}

        {/* Tapa todo al salir de la app (así el selector de apps no muestra montos) */}
        {covered && lockMode() !== "none" && (
          <div aria-hidden="true" className={`fixed inset-0 z-[300] flex items-center justify-center ${isLight ? "bg-white" : "bg-black"}`}>
            <img src="/icons/bolsillo.svg" alt="" width={64} height={64} className="w-16 h-16 rounded-2xl" />
          </div>
        )}
        {updateReady && (
          <div
            role="status"
            // Sin sombra grande: en WebKit dejaba una "estela" oscura. Borde fino y fondo sólido según el tema.
            className={`absolute left-1/2 -translate-x-1/2 top-[calc(0.5rem+var(--safe-top))] z-[70] pl-3.5 pr-1.5 py-1.5 rounded-xl border flex items-center gap-3 text-xs select-none max-w-[92%] ${
              isLight ? "bg-white border-zinc-300 text-black" : "bg-[#141416] border-[#2A2A2E] text-white"
            }`}
          >
            <span className="font-extrabold whitespace-nowrap">Hay una versión nueva</span>
            <button
              type="button"
              onClick={() => applyPwaUpdate()}
              className={`px-3 py-1 rounded-lg text-[11px] font-black cursor-pointer shrink-0 ${
                isLight ? "bg-black text-white hover:bg-zinc-800" : "bg-white text-black hover:bg-zinc-200"
              }`}
            >
              Actualizar
            </button>
          </div>
        )}
        {pendingDelete && (
          <ConfirmDialog
            title={pendingDelete.title}
            detail={pendingDelete.detail}
            isLight={isLight}
            onCancel={() => setPendingDelete(null)}
            onConfirm={() => {
              const { run } = pendingDelete;
              setPendingDelete(null);
              run();
            }}
          />
        )}
        {/* ============================================================== */}
        <AnimatePresence>
          {undoToast && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className={`absolute ${isMobileLayout && !activeSheet ? "bottom-[calc(4rem+var(--safe-bottom))]" : "bottom-[calc(1rem+var(--safe-bottom))]"} left-1/2 -translate-x-1/2 z-[60] px-3.5 py-2 rounded-xl bg-[#18181B] border border-[#27272A] text-white shadow-2xl flex items-center gap-3 text-xs select-none max-w-[90%]`}
            >
              <span className="flex flex-col min-w-0">
                <span className="font-extrabold truncate max-w-[230px]">{undoToast.message}</span>
                {undoToast.warning && (
                  <span role="alert" className="text-[11px] font-bold text-[#FBBF24]">
                    ⚠ {undoToast.warning}
                  </span>
                )}
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
          subtitle={`${formatShortDate(periodInfo.startDate)} – ${formatShortDate(periodInfo.endDate)}`}
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
              await store.recurrings.put(r);
              await loadData();
            }}
            onDeleteRecurring={handleDeleteRecurring}
            onAddInstallment={handleAddInstallment}
            onUpdateInstallment={async (i) => {
              await store.installments.put(i);
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
            onSettleDebt={handleSettleDebts}
            onDeleteDebt={handleDeleteDebtItem}
            onUpdateDebt={async (d) => {
              await store.debts.put(d);
              await loadData();
            }}
            dollars={{ enabled: settings.useDollars, type: settings.dollarType }}
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
          isOpen={activeSheet === "summary"}
          onClose={() => setActiveSheet(null)}
          title="Resumen"
          subtitle="Gastos por categoría y comparación con el período anterior"
          isLight={isLight}
        >
          <SummaryPanel
            settings={settings}
            movements={movements}
            categories={settings.categories}
            workDays={workDays}
            todayStr={todayStr}
            isLight={isLight}
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
          subtitle={`Configuración general, temas y copia de seguridad · v${APP_VERSION}`}
          isLight={isLight}
        >
          <SettingsPanel
            onShowTutorial={() => {
              setActiveSheet(null);
              setTourOpen(true);
            }}
            onLockNow={lockApp}
            onVaultChanged={async () => {
              await loadVaultMeta();
              setVault(lockMode() !== "none" ? "unlocked" : "off");
            }}
            settings={settings}
            isLight={isLight}
            onUpdateSettings={handleUpdateSettings}
            onRefreshData={loadData}
            onOpenWorkDays={() => setActiveSheet("income")}
          />
        </Sheet>
      </div>
    </div>
  );
}
