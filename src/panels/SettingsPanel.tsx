import React, { useState, useRef, useEffect } from "react";
import {
  Download,
  Upload,
  Moon,
  Sun,
  Bell,
  ShieldAlert,
  Plus,
  Heart,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Lock,
  Palette,
  Tags,
  Wallet,
  DollarSign,
} from "lucide-react";
import { addDays, differenceInCalendarDays } from "date-fns";
import { DollarType, IncomeMode, Settings, WindowZoom } from "../types";
import { DOLLAR_LABELS } from "../lib/dollars";
import { Select } from "../components/Select";
import { exportAllData, importValidatedBackup, resetAllData } from "../db/repo";
import { isTauri, isTrayAvailable, requestAppNotificationPermission, saveBackupFile } from "../platform";
import { requestPersistentStorage } from "../platform/pwa";
import { backupStatus } from "../lib/backupReminder";
import { DateField } from "../components/DateField";
import { PasswordPrompt } from "../components/PasswordPrompt";
import { SecuritySettings } from "./SecuritySettings";
import { isVaultEnabled, lockMode, verifyPassword } from "../db/store";
import { decryptBackup, encryptBackup, isEncryptedBackup, WrongSecretError } from "../lib/vault";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { summarizeBackup, validateBackup, ValidBackup } from "../lib/backup";
import { APP_VERSION, TEXT_LIMITS } from "../lib/constants";
import { NOVEDADES } from "../novedades";
import { newCategory } from "../lib/categories";
import { calculateVariableIncome } from "../lib/workdays";
import { shouldStorePreviousRange } from "../lib/carryover";
import {
  formatCurrency,
  formatLocalDate,
  formatNumberWithDots,
  formatShortDate,
  parseLocalDate, formatAmountInput } from "../lib/format";

type SettingsSection = "apariencia" | "sueldo" | "avisos" | "categorias" | "seguridad" | "dolar" | "backup" | "acerca";

interface SettingsPanelProps {
  settings: Settings;
  isLight?: boolean;
  onUpdateSettings: (s: Partial<Settings>) => void;
  onRefreshData: () => void;
  onOpenWorkDays?: () => void;
  onLockNow: () => void;
  onVaultChanged: () => void;
  onShowTutorial: () => void;
}

export function SettingsPanel({
  settings,
  isLight,
  onUpdateSettings,
  onRefreshData,
  onOpenWorkDays,
  onLockNow,
  onVaultChanged,
  onShowTutorial,
}: SettingsPanelProps) {
  const [incomeMode, setIncomeMode] = useState<IncomeMode>(settings.incomeMode || "salary");
  const [fixedSalary, setFixedSalary] = useState(
    formatNumberWithDots(settings.fixedSalary)
  );
  const [payday, setPayday] = useState(String(settings.payday));
  const [dailyRate, setDailyRate] = useState(
    formatNumberWithDots(settings.dailyRate)
  );
  const [dailyRangeStart, setDailyRangeStart] = useState(
    settings.dailyRangeStart || formatLocalDate(new Date())
  );
  const [dailyRangeEnd, setDailyRangeEnd] = useState(
    settings.dailyRangeEnd || formatLocalDate(addDays(new Date(), 15))
  );
  const [reminderTime, setReminderTime] = useState(settings.reminderTime);
  const [reminderEnabled, setReminderEnabled] = useState(settings.reminderEnabled);
  const [dueAlertDays, setDueAlertDays] = useState(String(settings.dueAlertDays));
  const [closeToTray, setCloseToTray] = useState(settings.closeToTray);
  // null = todavía no se consultó; false = la barra no tiene bandeja
  const [trayAvailable, setTrayAvailable] = useState<boolean | null>(null);
  // PWA: ¿el navegador aceptó no borrar los datos? (null = no se sabe)
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    if (!isTauri()) requestPersistentStorage().then(setPersisted);
  }, []);
  useEffect(() => {
    if (isTauri()) isTrayAvailable().then(setTrayAvailable);
  }, []);
  const [autostart, setAutostart] = useState(settings.autostart);

  // Categories management
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#8B5CF6");

  // Confirmación de borrado total (se dibuja arriba de todo, fuera del panel)
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lista de secciones (null) o una sección abierta, como en los ajustes del iPhone
  const [section, setSection] = useState<SettingsSection | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const openSection = (next: SettingsSection | null) => {
    setSection(next);
    rootRef.current?.closest(".overflow-y-auto")?.scrollTo(0, 0);
  };

  const parsedDailyRate = parseInt(dailyRate.replace(/\./g, ""), 10) || 0;
  const sDate = parseLocalDate(dailyRangeStart);
  const eDate = parseLocalDate(dailyRangeEnd);
  const variableDaysCount = Math.max(1, differenceInCalendarDays(eDate, sDate) + 1);
  // Proyección con lunes a sábado a la tarifa y domingos libres (sin contar días editados a mano)
  const variableTotalProjected = calculateVariableIncome(
    { ...settings, dailyRate: parsedDailyRate, dailyRangeStart, dailyRangeEnd },
    []
  );

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    // El rango viejo pasa a ser "período anterior" solo si terminó antes del nuevo (no al editar fechas del actual)
    const oldRange =
      settings.dailyRangeStart && settings.dailyRangeEnd
        ? { startDate: settings.dailyRangeStart, endDate: settings.dailyRangeEnd }
        : undefined;
    onUpdateSettings({
      ...(shouldStorePreviousRange(oldRange, dailyRangeStart) ? { dailyPreviousRange: oldRange } : {}),
      incomeMode,
      fixedSalary: parseInt(fixedSalary.replace(/\./g, ""), 10) || 0,
      payday: Math.min(31, Math.max(1, parseInt(payday, 10) || 1)),
      dailyRate: parsedDailyRate,
      dailyRangeStart,
      dailyRangeEnd,
      reminderTime,
      reminderEnabled,
      dueAlertDays: parseInt(dueAlertDays, 10) || 3,
      closeToTray,
      autostart,
    });
  };

  const [catError, setCatError] = useState<string | null>(null);
  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const cat = newCategory(settings.categories, newCatName, newCatColor);
    if (!cat) return setCatError("Ya tenés una categoría con ese nombre");
    onUpdateSettings({ categories: [...settings.categories, cat] });
    setNewCatName("");
    setCatError(null);
  };

  const handleDeleteCategory = (catId: string) => {
    if (settings.categories.length <= 1) return;
    onUpdateSettings({
      categories: settings.categories.filter((c) => c.id !== catId),
    });
  };

  const [exportMessage, setExportMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Con cifrado activo el backup también va cifrado: primero se pide la contraseña y se prepara el archivo;
  // después un toque en "Guardar" lo comparte (iPhone exige que compartir salga directo de un toque).
  const [askExportPw, setAskExportPw] = useState(false);
  const [preparedFile, setPreparedFile] = useState<{ name: string; contents: string } | null>(null);

  const handleExportJSON = async () => {
    if (isVaultEnabled()) {
      setAskExportPw(true);
      return;
    }
    await saveFile(`bolsillo-backup-${formatLocalDate(new Date())}.json`, await exportAllData());
  };

  const saveFile = async (name: string, contents: string) => {
    try {
      const res = await saveBackupFile(name, contents);
      setPreparedFile(null);
      setExportMessage({
        ok: true,
        text: res.kind === "path" ? `Guardado en ${res.path}` : res.kind === "shared" ? "Copia lista: guardala en Archivos o donde elegiste" : "Descarga iniciada",
      });
      onUpdateSettings({ lastBackupAt: new Date().toISOString() });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // cerró el menú de compartir sin elegir
      setExportMessage({ ok: false, text: `No se pudo exportar: ${e instanceof Error ? e.message : String(e)}` });
    }
  };

  // Importar: primero se valida y se muestra un resumen; recién al confirmar se reemplaza la base.
  const [pendingImport, setPendingImport] = useState<{ data: ValidBackup; summary: string } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [encryptedImport, setEncryptedImport] = useState<string | null>(null);
  const acceptBackupJson = (content: string) => {
    const result = validateBackup(content);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    setPendingImport({ data: result.data, summary: summarizeBackup(result.data) });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setImportError("El archivo es demasiado grande (máximo 10 MB)");
      return;
    }
    setImportError(null);
    setPendingImport(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = typeof evt.target?.result === "string" ? evt.target.result : "";
      if (isEncryptedBackup(content)) setEncryptedImport(content);
      else acceptBackupJson(content);
    };
    reader.onerror = () => setImportError("No se pudo leer el archivo");
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    const res = await importValidatedBackup(pendingImport.data);
    setPendingImport(null);
    if (res.success) {
      onRefreshData();
    } else {
      setImportError(res.error ?? "No se pudo importar");
    }
  };

  const handleResetData = async () => {
    await resetAllData();
    setShowResetConfirm(false);
    setResetDone(true);
    onVaultChanged(); // borrar todo también apaga el cifrado
    onRefreshData();
  };

  const muted = isLight ? "text-zinc-500" : "text-zinc-400";
  const sectionRows: { key: SettingsSection; label: string; summary: string; icon: React.ReactNode }[] = [
    { key: "apariencia", label: "Apariencia", summary: settings.theme === "light" ? "Blanco" : "Negro", icon: <Palette size={16} /> },
    {
      key: "sueldo",
      label: "Sueldo",
      summary:
        (settings.incomeMode === "daily" ? `Por día · ${formatCurrency(settings.dailyRate)}` : `Fijo · ${formatCurrency(settings.fixedSalary)}`) +
        (settings.savingsValue ? " · ahorro" : ""),
      icon: <Wallet size={16} />,
    },
    { key: "avisos", label: "Avisos", summary: settings.reminderEnabled ? `Recordatorio ${settings.reminderTime}` : "Apagados", icon: <Bell size={16} /> },
    { key: "categorias", label: "Categorías", summary: `${settings.categories.length} categorías${settings.categories.some((c) => c.limit) ? " · con topes" : ""}`, icon: <Tags size={16} /> },
    { key: "seguridad", label: "Seguridad", summary: { none: "Sin bloqueo", pin: "Simple (PIN)", encrypted: "Cifrada" }[lockMode()], icon: <Lock size={16} /> },
    { key: "dolar", label: "Dólar", summary: settings.useDollars ? DOLLAR_LABELS[settings.dollarType] : "Apagado", icon: <DollarSign size={16} /> },
    { key: "backup", label: "Backup", summary: settings.lastBackupAt ? backupStatus(settings.lastBackupAt, settings.createdAt).label.replace(/^Último backup: /, "") : "Nunca", icon: <Download size={16} /> },
    { key: "acerca", label: "Acerca de", summary: `v${APP_VERSION}`, icon: <Info size={16} /> },
  ];
  const current = sectionRows.find((r) => r.key === section);

  return (
    <div ref={rootRef} className="flex flex-col gap-4 select-none pb-6">
      {section === null ? (
        <div className={`rounded-2xl border overflow-hidden ${isLight ? "bg-white border-zinc-300" : "bg-[#0A0A0C] border-[#222224]"}`}>
          {sectionRows.map((r, i) => (
            <button
              key={r.key}
              type="button"
              onClick={() => openSection(r.key)}
              className={`w-full flex items-center gap-3 px-3.5 py-3 text-left cursor-pointer ${
                i > 0 ? (isLight ? "border-t border-zinc-200" : "border-t border-[#1F1F22]") : ""
              } ${isLight ? "hover:bg-zinc-50" : "hover:bg-[#111113]"}`}
            >
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isLight ? "bg-zinc-100" : "bg-zinc-900"}`}>{r.icon}</span>
              <span className="flex-1 text-sm font-extrabold">{r.label}</span>
              <span className={`text-xs font-bold truncate max-w-[45%] ${muted}`}>{r.summary}</span>
              <ChevronRight size={16} className={muted} />
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => openSection(null)}
          className="self-start flex items-center gap-1 text-sm font-extrabold cursor-pointer -mb-1"
        >
          <ChevronLeft size={18} />
          <span>Ajustes</span>
          <span className={`font-bold ${muted}`}>· {current?.label}</span>
        </button>
      )}

      {section === "apariencia" && (
        <>
      {/* Theme Toggle Button: strictly "Blanco" and "Negro" */}
      <div
        className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-black ${
          isLight ? "bg-white border-zinc-300" : "bg-[#0A0A0C] border-[#222224]"
        }`}
      >
        <div className="flex flex-col">
          <span className="text-sm">Tema Visual</span>
          <span className="text-[11px] font-bold opacity-75">
            {settings.theme === "dark"
              ? "Fondo negro y letras blancas"
              : "Fondo blanco y letras negras"}
          </span>
        </div>

        <button
          type="button"
          onClick={() =>
            onUpdateSettings({
              theme: settings.theme === "dark" ? "light" : "dark",
            })
          }
          className={`px-4 py-2 rounded-xl font-black flex items-center gap-1.5 transition-colors cursor-pointer border ${
            isLight
              ? "bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-black"
              : "bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-white"
          }`}
        >
          {settings.theme === "dark" ? (
            <>
              <Moon size={14} className="text-[#8B5CF6]" />
              <span>Negro</span>
            </>
          ) : (
            <>
              <Sun size={14} className="text-amber-500" />
              <span>Blanco</span>
            </>
          )}
        </button>
      </div>

      {/* Privacidad: montos ocultos al abrir */}
      <div
        className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-black ${
          isLight ? "bg-white border-zinc-300" : "bg-[#0A0A0C] border-[#222224]"
        }`}
      >
        <div className="flex flex-col">
          <span className="text-sm">Abrir siempre con los montos ocultos</span>
          <span className="text-[11px] font-bold opacity-75">
            Los montos se ven como "$ ••••••" hasta que tocás el ojo junto a Disponible.
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.startHidden}
          aria-label="Abrir siempre con los montos ocultos"
          onClick={() => onUpdateSettings({ startHidden: !settings.startHidden })}
          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border transition-all cursor-pointer ${
            settings.startHidden
              ? isLight
                ? "bg-[#16A34A] border-[#16A34A] text-white"
                : "bg-[#22C55E] border-[#22C55E] text-black"
              : isLight
              ? "bg-zinc-100 border-zinc-300"
              : "bg-zinc-900 border-zinc-700"
          }`}
        >
          {settings.startHidden && <Check size={14} strokeWidth={3.5} />}
        </button>
      </div>

      {/* Tamaño de ventana (solo escritorio) */}
      {isTauri() && (
        <div
          className={`p-3.5 rounded-2xl border flex flex-col gap-2 text-xs font-black ${
            isLight ? "bg-white border-zinc-300" : "bg-[#0A0A0C] border-[#222224]"
          }`}
        >
          <div className="flex flex-col">
            <span className="text-sm">Tamaño de ventana</span>
            <span className="text-[11px] font-bold opacity-75">
              Automático elige el tamaño según tu pantalla.
            </span>
          </div>
          <div
            className={`p-1 rounded-xl border flex items-center gap-1 ${
              isLight ? "bg-zinc-100 border-zinc-200" : "bg-black border-[#222224]"
            }`}
          >
            {(
              [
                ["auto", "Automático"],
                ["small", "Chico"],
                ["medium", "Mediano"],
                ["large", "Grande"],
              ] as [WindowZoom, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onUpdateSettings({ windowZoom: value })}
                className={`flex-1 py-1.5 text-center text-xs font-black rounded-lg transition-all cursor-pointer ${
                  (settings.windowZoom ?? "auto") === value
                    ? isLight
                      ? "bg-white text-black shadow-xs"
                      : "bg-zinc-800 text-white"
                    : isLight
                    ? "text-zinc-600 hover:text-black"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onShowTutorial}
        className={`p-3.5 rounded-2xl border text-left text-sm font-black cursor-pointer ${
          isLight ? "bg-white border-zinc-300 hover:bg-zinc-50" : "bg-[#0A0A0C] border-[#222224] hover:bg-[#111113]"
        }`}
      >
        Ver tutorial
        <span className="block text-[11px] font-bold opacity-75">Un recorrido corto por cada parte de la app.</span>
      </button>

        </>
      )}

      {section === "sueldo" && (
        <>
      {/* Sueldo */}
      <form
        onSubmit={handleSaveGeneral}
        className={`p-3.5 rounded-2xl border flex flex-col gap-3 ${
          isLight ? "bg-white border-zinc-300" : "bg-[#0A0A0C] border-[#222224]"
        }`}
      >
        <span className="text-xs font-black uppercase opacity-80">Tu ingreso</span>

        {/* Income Mode Selection */}
        <div
          className={`p-1 rounded-xl border flex items-center gap-1 ${
            isLight ? "bg-zinc-100 border-zinc-200" : "bg-black border-[#222224]"
          }`}
        >
          <button
            type="button"
            onClick={() => setIncomeMode("salary")}
            className={`flex-1 py-1.5 text-center text-xs font-black rounded-lg transition-all cursor-pointer ${
              incomeMode === "salary"
                ? isLight
                  ? "bg-white text-black shadow-xs"
                  : "bg-zinc-800 text-white"
                : isLight
                ? "text-zinc-600 hover:text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Sueldo Fijo
          </button>
          <button
            type="button"
            onClick={() => setIncomeMode("daily")}
            className={`flex-1 py-1.5 text-center text-xs font-black rounded-lg transition-all cursor-pointer ${
              incomeMode === "daily"
                ? isLight
                  ? "bg-white text-black shadow-xs"
                  : "bg-zinc-800 text-white"
                : isLight
                ? "text-zinc-600 hover:text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Sueldo Variable
          </button>
        </div>

        {incomeMode === "salary" ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-black block mb-1 opacity-70">
                Sueldo fijo ($ ARS)
              </label>
              <input
                type="text"
                value={fixedSalary}
                onChange={(e) => {
                  setFixedSalary(formatAmountInput(e.target.value));
                }}
                className={`w-full text-xs font-black px-2.5 py-1.5 rounded-xl border focus:outline-none ${
                  isLight
                    ? "bg-zinc-100 border-zinc-300 text-black"
                    : "bg-zinc-900 border-zinc-700 text-white"
                }`}
              />
            </div>

            <div>
              <label className="text-[10px] font-black block mb-1 opacity-70">
                Día de cobro
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={payday}
                onChange={(e) => setPayday(e.target.value)}
                className={`w-full text-xs font-black px-2.5 py-1.5 rounded-xl border focus:outline-none ${
                  isLight
                    ? "bg-zinc-100 border-zinc-300 text-black"
                    : "bg-zinc-900 border-zinc-700 text-white"
                }`}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div>
              <label className="text-[10px] font-black block mb-1 opacity-70">
                Tarifa por día ($ ARS)
              </label>
              <input
                type="text"
                value={dailyRate}
                onChange={(e) => {
                  setDailyRate(formatAmountInput(e.target.value));
                }}
                className={`w-full text-xs font-black px-2.5 py-1.5 rounded-xl border focus:outline-none ${
                  isLight
                    ? "bg-zinc-100 border-zinc-300 text-black"
                    : "bg-zinc-900 border-zinc-700 text-white"
                }`}
                placeholder="40.000"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-black block mb-1 opacity-70">
                  Fecha de inicio
                </label>
                <DateField ariaLabel="Fecha de inicio" value={dailyRangeStart} onChange={setDailyRangeStart} isLight={isLight} />
              </div>

              <div>
                <label className="text-[10px] font-black block mb-1 opacity-70">
                  Fecha de fin / límite
                </label>
                <DateField ariaLabel="Fecha de fin" value={dailyRangeEnd} onChange={setDailyRangeEnd} isLight={isLight} />
              </div>
            </div>

            {/* Live calculation banner */}
            <div
              className={`p-2.5 rounded-xl border text-xs font-black ${
                isLight ? "bg-zinc-100 border-zinc-200" : "bg-[#141416] border-[#222224]"
              }`}
            >
              <span>
                Del {formatShortDate(dailyRangeStart)} al {formatShortDate(dailyRangeEnd)} (
                {variableDaysCount} días) ={" "}
              </span>
              <span className={isLight ? "text-[#16A34A]" : "text-[#22C55E]"}>
                {formatCurrency(variableTotalProjected)} aprox.
              </span>
              <span className="block text-[10px] font-bold opacity-75 mt-0.5">
                Lunes a sábado a la tarifa, domingos libres. Guardá y después editá cada día.
              </span>
            </div>
            {onOpenWorkDays && settings.incomeMode === "daily" && (
              <button
                type="button"
                onClick={onOpenWorkDays}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold border cursor-pointer transition-colors ${
                  isLight
                    ? "bg-zinc-100 border-zinc-300 text-black hover:bg-zinc-200"
                    : "bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800"
                }`}
              >
                Ver y editar los días del rango →
              </button>
            )}
          </div>
        )}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className={`px-4 py-2 rounded-xl font-black text-xs transition-colors cursor-pointer ${
              isLight
                ? "bg-black text-white hover:bg-zinc-800"
                : "bg-white text-black hover:bg-zinc-200"
            }`}
          >
            Guardar
          </button>
        </div>
      </form>

          {/* Quiero ahorrar */}
          <div className={`p-3.5 rounded-2xl border flex flex-col gap-2.5 ${isLight ? "bg-white border-zinc-300" : "bg-[#0A0A0C] border-[#222224]"}`}>
            <span className="text-xs font-black uppercase opacity-80">Quiero ahorrar</span>
            <p className="text-[11px] font-bold opacity-75">
              Se aparta de cada período y el "Podés gastar por día" se calcula con lo que queda.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[0, 10, 20].map((pct) => {
                const on = settings.savingsMode === "percent" && settings.savingsValue === pct;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => onUpdateSettings({ savingsMode: "percent", savingsValue: pct })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                      on ? (isLight ? "bg-black text-white border-black" : "bg-white text-black border-white") : isLight ? "bg-zinc-100 border-zinc-300" : "bg-zinc-900 border-zinc-700"
                    }`}
                  >
                    {pct === 0 ? "No" : `${pct}%`}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[10px] font-black opacity-90">
                Otro porcentaje
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej. 15"
                  value={settings.savingsMode === "percent" && ![0, 10, 20].includes(settings.savingsValue) ? String(settings.savingsValue) : ""}
                  onChange={(e) => onUpdateSettings({ savingsMode: "percent", savingsValue: Math.min(100, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0) })}
                  className={`w-full text-xs font-black px-2.5 py-1.5 rounded-xl border focus:outline-none ${isLight ? "bg-zinc-100 border-zinc-300 text-black" : "bg-zinc-900 border-zinc-700 text-white"}`}
                />
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-black opacity-90">
                O un monto fijo ($)
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej. 50.000"
                  value={settings.savingsMode === "amount" && settings.savingsValue ? formatNumberWithDots(settings.savingsValue) : ""}
                  onChange={(e) => onUpdateSettings({ savingsMode: "amount", savingsValue: parseInt(formatAmountInput(e.target.value).replace(/\./g, ""), 10) || 0 })}
                  className={`w-full text-xs font-black px-2.5 py-1.5 rounded-xl border focus:outline-none ${isLight ? "bg-zinc-100 border-zinc-300 text-black" : "bg-zinc-900 border-zinc-700 text-white"}`}
                />
              </label>
            </div>
          </div>
        </>
      )}

      {section === "avisos" && (
        <>
      {/* Avisos */}
      <form
        onSubmit={handleSaveGeneral}
        className={`p-3.5 rounded-2xl border flex flex-col gap-3 ${
          isLight ? "bg-white border-zinc-300" : "bg-[#0A0A0C] border-[#222224]"
        }`}
      >

        {/* Reminders & System Tray with aligned custom checkboxes */}
        <div className="flex flex-col gap-2.5 ">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={14} />
              <span className="text-xs font-black">Recordatorio diario</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!reminderEnabled) requestAppNotificationPermission(); // B-01: se pide al prenderlo, con el toque
                setReminderEnabled(!reminderEnabled);
              }}
              className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border transition-all cursor-pointer ${
                reminderEnabled
                  ? isLight
                    ? "bg-[#16A34A] border-[#16A34A] text-white shadow-xs"
                    : "bg-[#22C55E] border-[#22C55E] text-black shadow-xs"
                  : isLight
                  ? "bg-zinc-100 border-zinc-300 hover:border-zinc-400"
                  : "bg-zinc-900 border-zinc-700 hover:border-zinc-500"
              }`}
            >
              {reminderEnabled && <Check size={14} strokeWidth={3.5} />}
            </button>
          </div>

          {reminderEnabled && (
            <div className="flex items-center justify-between pl-6">
              <span className="text-[11px] font-bold opacity-70">Hora de aviso</span>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className={`text-xs font-black px-2 py-1 rounded-lg border focus:outline-none ${
                  isLight
                    ? "bg-zinc-100 border-zinc-300 text-black"
                    : "bg-zinc-900 border-zinc-700 text-white"
                }`}
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-black">Avisar vencimientos (días antes)</span>
            <input
              type="number"
              min={1}
              max={15}
              value={dueAlertDays}
              onChange={(e) => setDueAlertDays(e.target.value)}
              className={`w-14 text-xs font-black px-2 py-1 rounded-lg border text-center focus:outline-none ${
                isLight
                  ? "bg-zinc-100 border-zinc-300 text-black"
                  : "bg-zinc-900 border-zinc-700 text-white"
              }`}
            />
          </div>

          {/* Bandeja e inicio automático: solo existen en la app de escritorio */}
          {isTauri() && (
          <>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-black">Minimizar a la bandeja al cerrar (Tray)</span>
            <button
              type="button"
              onClick={() => setCloseToTray(!closeToTray)}
              className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border transition-all cursor-pointer ${
                closeToTray
                  ? isLight
                    ? "bg-[#16A34A] border-[#16A34A] text-white shadow-xs"
                    : "bg-[#22C55E] border-[#22C55E] text-black shadow-xs"
                  : isLight
                  ? "bg-zinc-100 border-zinc-300 hover:border-zinc-400"
                  : "bg-zinc-900 border-zinc-700 hover:border-zinc-500"
              }`}
            >
              {closeToTray && <Check size={14} strokeWidth={3.5} />}
            </button>
          </div>
          {closeToTray && trayAvailable === false && (
            <p
              role="alert"
              className={`text-[11px] font-bold px-2.5 py-2 rounded-xl border ${
                isLight ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-[#2A1A00] border-amber-900 text-amber-300"
              }`}
            >
              Tu barra no tiene bandeja del sistema, así que no hay dónde mostrar el ícono. Mientras tanto, la × cierra la app de verdad.
            </p>
          )}
          {closeToTray && trayAvailable && (
            <p className="text-[10px] font-bold opacity-75 pl-0.5">
              Si no ves el ícono en la barra, abrí Bolsillo de nuevo desde el menú y la ventana reaparece.
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-black">Iniciar automáticamente con la PC</span>
            <button
              type="button"
              onClick={() => setAutostart(!autostart)}
              className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border transition-all cursor-pointer ${
                autostart
                  ? isLight
                    ? "bg-[#16A34A] border-[#16A34A] text-white shadow-xs"
                    : "bg-[#22C55E] border-[#22C55E] text-black shadow-xs"
                  : isLight
                  ? "bg-zinc-100 border-zinc-300 hover:border-zinc-400"
                  : "bg-zinc-900 border-zinc-700 hover:border-zinc-500"
              }`}
            >
              {autostart && <Check size={14} strokeWidth={3.5} />}
            </button>
          </div>
          </>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className={`px-4 py-2 rounded-xl font-black text-xs transition-colors cursor-pointer ${
              isLight
                ? "bg-black text-white hover:bg-zinc-800"
                : "bg-white text-black hover:bg-zinc-200"
            }`}
          >
            Guardar
          </button>
        </div>
      </form>

        </>
      )}

      {section === "categorias" && (
        <>
      {/* Categories Management */}
      <div
        className={`p-3.5 rounded-2xl border flex flex-col gap-2.5 ${
          isLight ? "bg-white border-zinc-300" : "bg-[#0A0A0C] border-[#222224]"
        }`}
      >
        <span className="text-xs font-black uppercase opacity-80">Categorías y topes</span>

        <p className="text-[11px] font-bold opacity-75">
          Tope por período (opcional): avisa al llegar al 80% y al pasarte, y se ve en el Resumen.
        </p>
        <div className="flex flex-col gap-1.5">
          {settings.categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
              <span className="flex-1 min-w-0 truncate text-xs font-black">{c.name}</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label={`Tope de ${c.name}`}
                placeholder="Sin tope"
                value={c.limit ? formatNumberWithDots(c.limit) : ""}
                onChange={(e) => {
                  const v = parseInt(formatAmountInput(e.target.value).replace(/\./g, ""), 10) || 0;
                  onUpdateSettings({
                    categories: settings.categories.map((x) => (x.id === c.id ? { ...x, limit: v || undefined } : x)),
                  });
                }}
                className={`w-28 text-xs font-black px-2.5 py-1 rounded-lg border text-right focus:outline-none ${
                  isLight ? "bg-zinc-100 border-zinc-300 text-black" : "bg-zinc-900 border-zinc-700 text-white"
                }`}
              />
              {settings.categories.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(c.id)}
                  aria-label={`Eliminar ${c.name}`}
                  className="w-6 text-zinc-400 hover:text-red-500 text-sm font-black cursor-pointer"
                  title="Eliminar categoría"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {catError && <p role="alert" className="text-[11px] font-bold text-[#DC2626]">{catError}</p>}
        {/* Add new category */}
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-500/10">
          <input
            type="text"
            placeholder="Nueva categoría..."
            value={newCatName}
            maxLength={TEXT_LIMITS.category} onChange={(e) => setNewCatName(e.target.value)}
            className={`flex-1 text-xs font-black px-2.5 py-1.5 rounded-xl border focus:outline-none ${
              isLight
                ? "bg-zinc-100 border-zinc-300 text-black"
                : "bg-zinc-900 border-zinc-700 text-white"
            }`}
          />
          <input
            type="color"
            value={newCatColor}
            onChange={(e) => setNewCatColor(e.target.value)}
            className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
          />
          <button
            type="button"
            onClick={handleAddCategory}
            className={`p-2 rounded-xl font-black text-xs flex items-center gap-1 transition-colors cursor-pointer ${
              isLight
                ? "bg-black text-white hover:bg-zinc-800"
                : "bg-white text-black hover:bg-zinc-200"
            }`}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

        </>
      )}

      {section === "seguridad" && (
        <>
      <SecuritySettings
        isLight={isLight}
        theme={settings.theme}
        onLockNow={onLockNow}
        onChanged={onVaultChanged}
        onBackupSaved={() => onUpdateSettings({ lastBackupAt: new Date().toISOString() })}
      />

        </>
      )}

      {section === "dolar" && (
        <div className={`p-3.5 rounded-2xl border flex flex-col gap-3 ${isLight ? "bg-white border-zinc-300" : "bg-[#0A0A0C] border-[#222224]"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-black">Usar dólares</span>
              <span className="text-[11px] font-bold opacity-75">
                Deudas en dólares y una pestaña para tus ahorros en dólares. El resto de la app sigue en pesos.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.useDollars}
              aria-label="Usar dólares"
              onClick={() => onUpdateSettings({ useDollars: !settings.useDollars })}
              className={`w-9 h-5 rounded-full p-0.5 flex shrink-0 cursor-pointer transition-colors ${
                settings.useDollars ? (isLight ? "bg-[#16A34A] justify-end" : "bg-[#22C55E] justify-end") : isLight ? "bg-zinc-300" : "bg-zinc-700"
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black">Tipo de dólar</span>
            <Select
              ariaLabel="Tipo de dólar"
              value={settings.dollarType}
              isLight={isLight}
              className="w-36"
              options={(["oficial", "blue", "bolsa"] as const).map((t) => ({ value: t, label: DOLLAR_LABELS[t] }))}
              onChange={(v) => onUpdateSettings({ dollarType: v as DollarType })}
            />
          </div>
          <p className={`text-[11px] font-semibold leading-relaxed ${isLight ? "text-zinc-600" : "text-zinc-300"}`}>
            Bolsillo no se conecta a internet solo. Solo cuando tocás "Cotización del día" pide la cotización de venta a
            dolarapi.com (un servicio gratuito) y la deja fija; también la podés escribir a mano.
          </p>
        </div>
      )}

      {section === "backup" && (
        <>
      {/* Backup Section */}
      <div
        className={`p-3.5 rounded-2xl border flex flex-col gap-2 ${
          isLight ? "bg-white border-zinc-300" : "bg-[#0A0A0C] border-[#222224]"
        }`}
      >
        <span className="text-xs font-black uppercase opacity-80">
          Copia de Seguridad (JSON)
        </span>
        <p className="text-[11px] font-bold opacity-75">
          Guardá tus datos o pasalos a tu celular o computadora.
        </p>
        {(() => {
          const status = backupStatus(settings.lastBackupAt, settings.createdAt);
          return (
            <div className="flex flex-col gap-1.5">
              <span className={`text-[11px] font-extrabold ${isLight ? "text-zinc-700" : "text-zinc-200"}`}>{status.label}</span>
              {status.overdue && (
                <p
                  role="status"
                  className={`text-[11px] font-bold px-2.5 py-2 rounded-xl border ${
                    isLight ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-[#2A1A00] border-amber-900 text-amber-300"
                  }`}
                >
                  Pasó más de una semana sin una copia. Si el celular borra la app, se pierde todo: tocá "Exportar JSON" y guardala en Archivos o iCloud.
                </p>
              )}
            </div>
          );
        })()}
        {persisted !== null && (
          <p className={`text-[11px] font-bold ${persisted ? (isLight ? "text-emerald-700" : "text-emerald-400") : isLight ? "text-amber-700" : "text-amber-400"}`}>
            {persisted
              ? "Datos protegidos: el sistema no los borra aunque falte espacio."
              : "El sistema no garantiza guardar tus datos para siempre: exportá una copia seguido."}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={handleExportJSON}
            className={`px-3 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
              isLight
                ? "bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-black"
                : "bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-white"
            }`}
          >
            <Download size={14} />
            <span>Exportar JSON</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`px-3 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
              isLight
                ? "bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-black"
                : "bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-white"
            }`}
          >
            <Upload size={14} />
            <span>Importar JSON</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>

        {preparedFile && (
          <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-[11px] font-bold ${isLight ? "bg-zinc-50 border-zinc-300" : "bg-black border-zinc-700"}`}>
            <span>Backup cifrado listo.</span>
            <button
              type="button"
              onClick={() => saveFile(preparedFile.name, preparedFile.contents)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${isLight ? "bg-black text-white" : "bg-white text-black"}`}
            >
              Guardar archivo
            </button>
          </div>
        )}

        {exportMessage && (
          <div
            role="status"
            className={`p-2.5 rounded-xl border text-[11px] font-bold break-all ${
              exportMessage.ok
                ? isLight
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-[#052E16] border-emerald-900 text-emerald-300"
                : isLight
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-[#2A0A0A] border-red-900 text-red-300"
            }`}
          >
            {exportMessage.text}
          </div>
        )}

        {importError && (
          <div
            role="alert"
            className={`p-2.5 rounded-xl border text-[11px] font-bold ${
              isLight ? "bg-red-50 border-red-200 text-red-700" : "bg-[#2A0A0A] border-red-900 text-red-300"
            }`}
          >
            No se importó nada. {importError}
          </div>
        )}

        {pendingImport && (
          <div
            role="dialog"
            aria-label="Confirmar importación"
            className={`p-3 rounded-xl border flex flex-col gap-2 text-xs font-bold ${
              isLight ? "bg-zinc-50 border-zinc-300" : "bg-black border-zinc-700"
            }`}
          >
            <span className="font-extrabold">El archivo es válido y contiene:</span>
            <span className="opacity-80">{pendingImport.summary}.</span>
            <span className={isLight ? "text-red-700" : "text-red-300"}>
              Al confirmar se reemplazan TODOS los datos actuales por los del archivo.
            </span>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                  isLight ? "bg-black text-white hover:bg-zinc-800" : "bg-white text-black hover:bg-zinc-200"
                }`}
              >
                Sí, reemplazar mis datos
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone: Reset All Data with Double Confirmation */}
      <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-xs font-black text-[#EF4444]">
          <ShieldAlert size={15} />
          <span>Zona de Peligro</span>
        </div>
        <p className="text-[11px] font-bold opacity-70">
          Borra todos los gastos, ingresos, configuraciones, deudas y cuotas.
        </p>

        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          className="mt-1 px-4 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-black text-xs transition-all cursor-pointer text-center"
        >
          Borrar todos los datos
        </button>
        {resetDone && (
          <span role="status" className="text-[11px] font-bold opacity-70 text-center">
            Listo: todos los datos fueron borrados.
          </span>
        )}
      </div>

        </>
      )}

      {section === "acerca" && (
        <>
      {/* Créditos */}
      <div
        className={`p-4 rounded-2xl border flex flex-col gap-3 ${
          isLight ? "bg-white border-zinc-200" : "bg-[#0A0A0C] border-[#222224]"
        }`}
      >
        <div className="flex items-center gap-3">
          <img
            src="/icons/bolsillo.svg"
            alt=""
            width={40}
            height={40}
            className={`w-10 h-10 rounded-xl ${isLight ? "ring-1 ring-zinc-200" : ""}`}
          />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-extrabold tracking-tight">Bolsillo</span>
            <span className={`text-[11px] font-bold ${isLight ? "text-zinc-500" : "text-zinc-400"}`}>
              v{APP_VERSION}
            </span>
          </div>
        </div>

        <details className="text-[11px] font-semibold">
          <summary className="cursor-pointer font-extrabold">Novedades de cada versión</summary>
          <div className="flex flex-col gap-2 pt-2">
            {NOVEDADES.map((r) => (
              <div key={r.version}>
                <span className="font-extrabold">v{r.version}</span>
                <ul className={isLight ? "text-zinc-600" : "text-zinc-300"}>
                  {r.items.map((t) => (
                    <li key={t}>· {t}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>

        <p className={`text-[11px] font-semibold leading-relaxed ${isLight ? "text-zinc-600" : "text-zinc-300"}`}>
          Una app chiquita para saber, cada día, cuánta plata te queda. Sin cuentas en la nube,
          sin planillas y sin vueltas: todo se guarda en tu dispositivo.
        </p>

        <div
          className={`pt-3 border-t flex items-center justify-between gap-2 text-[11px] font-bold ${
            isLight ? "border-zinc-200 text-zinc-500" : "border-[#222224] text-zinc-400"
          }`}
        >
          <span>
            Creado por <span className={isLight ? "text-black" : "text-white"}>PiKuSen27</span>
          </span>
          <span className="flex items-center gap-1">
            <Heart size={11} className={isLight ? "text-zinc-400" : "text-zinc-500"} />
            <span>Con mucho esfuerzo y cariño</span>
          </span>
        </div>
        <p className={`text-[10px] font-semibold leading-relaxed ${isLight ? "text-zinc-500" : "text-zinc-400"}`}>
          Software libre bajo la licencia GPL-3.0: podés usarlo, estudiarlo, compartirlo y modificarlo,
          siempre que lo que compartas siga siendo libre. © 2026 PiKuSen27.
        </p>
        <p className={`text-[10px] font-bold ${isLight ? "text-zinc-600" : "text-zinc-300"}`}>
          Código:{" "}
          {/* En escritorio un link navegaría dentro de la ventana de la app: ahí va como texto para copiar */}
          {isTauri() ? (
            <span className="select-text">github.com/PiKuSen27/bolsillo</span>
          ) : (
            <a href="https://github.com/PiKuSen27/bolsillo" target="_blank" rel="noopener noreferrer" className="underline">
              github.com/PiKuSen27/bolsillo
            </a>
          )}
        </p>
      </div>
        </>
      )}

      {askExportPw && (
        <PasswordPrompt
          title="Backup cifrado"
          detail="Escribí tu contraseña de Bolsillo. El archivo queda cifrado con ella y solo se abre con esa contraseña (el código de recuperación no sirve para backups)."
          confirmLabel="Preparar backup"
          isLight={isLight}
          onCancel={() => setAskExportPw(false)}
          onSubmit={async (pw) => {
            if (!(await verifyPassword(pw))) return "Contraseña incorrecta";
            const contents = await encryptBackup(await exportAllData(), pw);
            setAskExportPw(false);
            setPreparedFile({ name: `bolsillo-backup-cifrado-${formatLocalDate(new Date())}.json`, contents });
            return null;
          }}
        />
      )}
      {encryptedImport && (
        <PasswordPrompt
          title="Este backup está cifrado"
          detail="Escribí la contraseña que tenía Bolsillo cuando se exportó."
          confirmLabel="Abrir backup"
          isLight={isLight}
          onCancel={() => setEncryptedImport(null)}
          onSubmit={async (pw) => {
            try {
              const json = await decryptBackup(encryptedImport, pw);
              setEncryptedImport(null);
              acceptBackupJson(json);
              return null;
            } catch (e) {
              return e instanceof WrongSecretError ? "Contraseña incorrecta" : e instanceof Error ? e.message : String(e);
            }
          }}
        />
      )}

      {showResetConfirm && (
        <ConfirmDialog
          title="¿Borrar todos los datos?"
          detail="Esta acción no se puede deshacer."
          confirmLabel="Borrar todos los datos"
          isLight={isLight}
          onConfirm={handleResetData}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

    </div>
  );
}
