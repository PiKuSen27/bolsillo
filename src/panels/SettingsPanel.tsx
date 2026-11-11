import React, { useState, useRef } from "react";
import {
  Download,
  Upload,
  Moon,
  Sun,
  Bell,
  ShieldAlert,
  Plus,
  Smartphone,
  Laptop,
  Heart,
  Sparkles,
  Check,
} from "lucide-react";
import { addDays, differenceInCalendarDays } from "date-fns";
import { Category, IncomeMode, Settings } from "../types";
import { exportAllData, importAllData, resetAllData } from "../db/repo";
import { calculateVariableIncome } from "../lib/workdays";
import {
  formatCurrency,
  formatLocalDate,
  formatNumberWithDots,
  formatShortDate,
  parseLocalDate,
} from "../lib/format";

interface SettingsPanelProps {
  settings: Settings;
  isLight?: boolean;
  isMobilePreview?: boolean;
  onUpdateSettings: (s: Partial<Settings>) => void;
  onRefreshData: () => void;
  onToggleMobilePreview?: () => void;
  onOpenWorkDays?: () => void;
}

export function SettingsPanel({
  settings,
  isLight,
  isMobilePreview,
  onUpdateSettings,
  onRefreshData,
  onToggleMobilePreview,
  onOpenWorkDays,
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
  const [autostart, setAutostart] = useState(settings.autostart);

  // Categories management
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#8B5CF6");

  // Double confirmation state for full reset
  const [resetConfirmStep, setResetConfirmStep] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // Si cambió el rango variable, el viejo pasa a ser "período anterior" (cartel del Hero)
    const rangeChanged =
      settings.dailyRangeStart &&
      settings.dailyRangeEnd &&
      (settings.dailyRangeStart !== dailyRangeStart || settings.dailyRangeEnd !== dailyRangeEnd);
    onUpdateSettings({
      ...(rangeChanged
        ? { dailyPreviousRange: { startDate: settings.dailyRangeStart!, endDate: settings.dailyRangeEnd! } }
        : {}),
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

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const newCat: Category = {
      id: newCatName.trim().toLowerCase().replace(/\s+/g, "_"),
      name: newCatName.trim(),
      icon: "Tag",
      color: newCatColor,
    };
    onUpdateSettings({
      categories: [...settings.categories, newCat],
    });
    setNewCatName("");
  };

  const handleDeleteCategory = (catId: string) => {
    if (settings.categories.length <= 1) return;
    onUpdateSettings({
      categories: settings.categories.filter((c) => c.id !== catId),
    });
  };

  const handleExportJSON = async () => {
    try {
      const json = await exportAllData();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bolsillo-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Error al exportar datos");
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      const res = await importAllData(content);
      if (res.success) {
        alert("¡Datos restaurados con éxito!");
        onRefreshData();
      } else {
        alert(`Error al importar: ${res.error}`);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleResetData = async () => {
    if (resetConfirmStep === 0) {
      setResetConfirmStep(1);
    } else if (resetConfirmStep === 1) {
      setResetConfirmStep(2);
    } else if (resetConfirmStep === 2) {
      await resetAllData();
      setResetConfirmStep(0);
      alert("Todos los datos fueron borrados");
      onRefreshData();
    }
  };

  return (
    <div className="flex flex-col gap-4 select-none pb-6">
      {/* Theme Toggle Button: strictly "Blanco" and "Negro" */}
      <div
        className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-black ${
          isLight ? "bg-white border-zinc-300" : "bg-[#0A0A0C] border-[#222224]"
        }`}
      >
        <div className="flex flex-col">
          <span className="text-sm">Tema Visual</span>
          <span className="text-[11px] font-bold opacity-60">
            {settings.theme === "dark"
              ? "Negro (#000000) con bordes finos"
              : "Blanco (#FFFFFF) con bordes finos"}
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

      {/* General Settings Form */}
      <form
        onSubmit={handleSaveGeneral}
        className={`p-3.5 rounded-2xl border flex flex-col gap-3 ${
          isLight ? "bg-white border-zinc-300" : "bg-[#0A0A0C] border-[#222224]"
        }`}
      >
        <span className="text-xs font-black uppercase opacity-80">
          Ajustes de Ingresos y Fechas
        </span>

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
                  const raw = e.target.value.replace(/\D/g, "");
                  setFixedSalary(raw ? formatNumberWithDots(raw) : "");
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
                  const raw = e.target.value.replace(/\D/g, "");
                  setDailyRate(raw ? formatNumberWithDots(raw) : "");
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
                <input
                  type="date"
                  value={dailyRangeStart}
                  onChange={(e) => setDailyRangeStart(e.target.value)}
                  className={`w-full text-xs font-bold px-2.5 py-1.5 rounded-xl border focus:outline-none ${
                    isLight
                      ? "bg-zinc-100 border-zinc-300 text-black"
                      : "bg-zinc-900 border-zinc-700 text-white"
                  }`}
                />
              </div>

              <div>
                <label className="text-[10px] font-black block mb-1 opacity-70">
                  Fecha de fin / límite
                </label>
                <input
                  type="date"
                  value={dailyRangeEnd}
                  onChange={(e) => setDailyRangeEnd(e.target.value)}
                  className={`w-full text-xs font-bold px-2.5 py-1.5 rounded-xl border focus:outline-none ${
                    isLight
                      ? "bg-zinc-100 border-zinc-300 text-black"
                      : "bg-zinc-900 border-zinc-700 text-white"
                  }`}
                />
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
              <span className="block text-[10px] font-bold opacity-60 mt-0.5">
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

        {/* Reminders & System Tray with aligned custom checkboxes */}
        <div className="flex flex-col gap-2.5 pt-2 border-t border-zinc-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={14} />
              <span className="text-xs font-black">Recordatorio diario</span>
            </div>
            <button
              type="button"
              onClick={() => setReminderEnabled(!reminderEnabled)}
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
            Guardar ajustes generales
          </button>
        </div>
      </form>

      {/* Categories Management */}
      <div
        className={`p-3.5 rounded-2xl border flex flex-col gap-2.5 ${
          isLight ? "bg-white border-zinc-300" : "bg-[#0A0A0C] border-[#222224]"
        }`}
      >
        <span className="text-xs font-black uppercase opacity-80">Categorías de Gastos</span>

        <div className="flex flex-wrap gap-1.5">
          {settings.categories.map((c) => (
            <div
              key={c.id}
              className={`px-2.5 py-1 rounded-full text-[11px] font-black border flex items-center gap-1.5 ${
                isLight
                  ? "bg-zinc-100 border-zinc-200 text-black"
                  : "bg-zinc-900 border-zinc-800 text-white"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: c.color }}
              />
              <span>{c.name}</span>
              {settings.categories.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(c.id)}
                  className="ml-1 text-zinc-400 hover:text-red-500 text-xs font-black cursor-pointer"
                  title="Eliminar categoría"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add new category */}
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-500/10">
          <input
            type="text"
            placeholder="Nueva categoría..."
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
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

      {/* Guide: Usar en Celular (iOS / Android) y Windows */}
      <div
        className={`p-3.5 rounded-2xl border flex flex-col gap-2.5 ${
          isLight ? "bg-white border-zinc-300" : "bg-[#0A0A0C] border-[#222224]"
        }`}
      >
        <span className="text-xs font-black uppercase opacity-80 flex items-center gap-1.5">
          <Smartphone size={14} />
          <span>Usar en Celular (iOS / Android) y Windows</span>
        </span>

        <div className="flex flex-col gap-2 text-xs font-bold leading-relaxed">
          <div
            className={`p-2.5 rounded-xl border flex flex-col gap-1 ${
              isLight ? "bg-zinc-50 border-zinc-200" : "bg-black border-[#222224]"
            }`}
          >
            <div className="flex items-center gap-1.5 font-black text-[11px] text-[#22C55E]">
              <Smartphone size={13} />
              <span>iPhone o Android en tu Red Local (PWA)</span>
            </div>
            <p className="text-[11px] opacity-75">
              1. En la carpeta de la app corré: <code className="font-mono bg-zinc-800/30 px-1 py-0.5 rounded text-[10px]">pnpm mobile</code><br />
              2. Abrí Safari o Chrome en tu celular con la IP que te muestre (ej. <code className="font-mono text-[10px]">http://192.168.1.X:5173</code>).<br />
              3. Tocá <strong>Compartir → Agregar al Inicio</strong> para instalarla como una app nativa en tu pantalla.
            </p>

            {onToggleMobilePreview && (
              <button
                type="button"
                onClick={onToggleMobilePreview}
                className={`mt-2 py-2 px-3 rounded-xl border font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isMobilePreview
                    ? "bg-[#22C55E] text-black border-[#22C55E]"
                    : isLight
                    ? "bg-zinc-200 hover:bg-zinc-300 border-zinc-300 text-black"
                    : "bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-white"
                }`}
              >
                <Smartphone size={14} />
                <span>
                  {isMobilePreview ? "Volver a Vista Escritorio (PC)" : "Previsualizar como Celular (iPhone)"}
                </span>
              </button>
            )}
          </div>

          <div
            className={`p-2.5 rounded-xl border flex flex-col gap-1 ${
              isLight ? "bg-zinc-50 border-zinc-200" : "bg-black border-[#222224]"
            }`}
          >
            <div className="flex items-center gap-1.5 font-black text-[11px] text-blue-400">
              <Laptop size={13} />
              <span>Versión Windows (.exe)</span>
            </div>
            <p className="text-[11px] opacity-75">
              El repositorio incluye el flujo de <strong>GitHub Actions</strong> para compilar el instalador <strong>.exe</strong> de Windows automáticamente en cada push a la nube.
            </p>
          </div>
        </div>
      </div>

      {/* Backup Section */}
      <div
        className={`p-3.5 rounded-2xl border flex flex-col gap-2 ${
          isLight ? "bg-white border-zinc-300" : "bg-[#0A0A0C] border-[#222224]"
        }`}
      >
        <span className="text-xs font-black uppercase opacity-80">
          Copia de Seguridad (JSON)
        </span>
        <p className="text-[11px] font-bold opacity-60">
          Guardá tus datos o pasalos a tu celular o computadora.
        </p>

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
          onClick={handleResetData}
          className="mt-1 px-4 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-black text-xs transition-all cursor-pointer text-center"
        >
          {resetConfirmStep === 0 && "Borrar todos los datos"}
          {resetConfirmStep === 1 && "¿Estás completamente seguro? Tocar otra vez"}
          {resetConfirmStep === 2 && "Confirmación final: BORRAR TODO DEFINITIVAMENTE"}
        </button>
        {resetConfirmStep > 0 && (
          <button
            type="button"
            onClick={() => setResetConfirmStep(0)}
            className="text-[11px] font-bold opacity-60 hover:opacity-100 text-center cursor-pointer"
          >
            Cancelar borrado
          </button>
        )}
      </div>

      {/* Author Card: PiKuSen27 */}
      <div
        className={`p-4 rounded-2xl border flex flex-col gap-2 relative overflow-hidden ${
          isLight
            ? "bg-gradient-to-br from-zinc-100 via-white to-zinc-50 border-zinc-300"
            : "bg-gradient-to-br from-[#121216] via-[#0A0A0C] to-black border-zinc-800"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles size={15} />
            </div>
            <div>
              <span className="text-xs font-black tracking-tight block">
                Creado y diseñado por PiKuSen27
              </span>
              <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider">
                Bolsillo • Edición Especial
              </span>
            </div>
          </div>

          <span
            className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
              isLight
                ? "bg-zinc-200 border-zinc-300 text-zinc-800"
                : "bg-zinc-800 border-zinc-700 text-zinc-200"
            }`}
          >
            v1.2.0 PRO
          </span>
        </div>

        <p className="text-[11px] font-bold opacity-80 leading-relaxed mt-1">
          Desarrollado a medida con dedicación para llevar tus cuentas claras, rápido y sin vueltas. Hecho por PiKuSen27 — Edición Especial.
        </p>

        <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-zinc-500 pt-1">
          <span>Hecho con</span>
          <Heart size={11} className="text-red-500 fill-red-500 inline" />
          <span>para simplificar tu día a día</span>
        </div>
      </div>
    </div>
  );
}
