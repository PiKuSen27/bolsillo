import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, CheckCircle2, Plus, Calendar, ChevronDown, Trash2 } from "lucide-react";
import { Category, DayLog, Movement } from "../types";
import { formatCurrency, formatLongDate } from "../lib/format";
import { isDayLogged } from "../lib/reminders";

interface DayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  movements: Movement[];
  categories: Category[];
  dayLogs: DayLog[];
  isLight?: boolean;
  onSelectForEntry: (dateStr: string) => void;
  onMarkNoExpenses: (dateStr: string) => void;
  onDeleteMovement?: (id: string) => void;
}

export function DayDetailModal({
  isOpen,
  onClose,
  dateStr,
  movements,
  categories,
  dayLogs,
  isLight,
  onSelectForEntry,
  onMarkNoExpenses,
  onDeleteMovement,
}: DayDetailModalProps) {
  // Store expanded category IDs
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const dayMovements = movements.filter((m) => m.date === dateStr);
  const hasMovements = dayMovements.length > 0;
  const logged = isDayLogged(dateStr, movements, dayLogs);
  const dayLog = dayLogs.find((d) => d.date === dateStr);

  // FIX: If day has movements, it is ALWAYS "Registrado", NOT "Sin gastos"
  const hasNoExpensesMark = !hasMovements && (dayLog?.noExpenses || false);

  const getCategory = (catId: string) => {
    if (catId === "income") {
      return {
        id: "income",
        name: "Ingreso de plata",
        color: isLight ? "#16A34A" : "#22C55E",
        icon: "TrendingUp",
      };
    }
    return (
      categories.find((c) => c.id === catId) || {
        id: catId,
        name: "Otros",
        color: "#6B7280",
        icon: "MoreHorizontal",
      }
    );
  };

  // Group day movements by category (incomes always group under 'income')
  const groupedByCategory = dayMovements.reduce((acc, mov) => {
    const targetCatId = mov.kind === "income" ? "income" : mov.categoryId;
    if (!acc[targetCatId]) {
      acc[targetCatId] = [];
    }
    acc[targetCatId].push(mov);
    return acc;
  }, {} as Record<string, Movement[]>);

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const totalExpense = dayMovements
    .filter((m) => m.kind === "expense")
    .reduce((acc, m) => acc + m.amount, 0);

  const totalIncome = dayMovements
    .filter((m) => m.kind === "income")
    .reduce((acc, m) => acc + m.amount, 0);

  return (
    <AnimatePresence>
      <div role="dialog" aria-modal="true" className="absolute inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-xs"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 15 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className={`relative w-full max-w-sm rounded-[18px] border p-4 flex flex-col gap-3 shadow-2xl select-none ${
            isLight
              ? "bg-[#FFFFFF] border-[#E4E4E7] text-black"
              : "bg-[#0A0A0C] border-[#262626] text-white"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Calendar size={18} className={isLight ? "text-zinc-600" : "text-zinc-400"} />
              <h3 className="text-sm font-extrabold capitalize">
                {formatLongDate(dateStr)}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                isLight ? "hover:bg-zinc-100 text-zinc-500" : "hover:bg-zinc-800 text-zinc-400"
              }`}
            >
              <X size={16} />
            </button>
          </div>

          {/* Status summary */}
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={isLight ? "text-zinc-500" : "text-zinc-400"}>
              Estado del día:
            </span>
            {hasMovements || logged ? (
              <span className="text-[#16A34A] flex items-center gap-1 font-extrabold">
                <CheckCircle2 size={14} /> Registrado
              </span>
            ) : hasNoExpensesMark ? (
              <span className="text-[#10B981] flex items-center gap-1 font-extrabold">
                <CheckCircle2 size={14} /> Marcado "Sin gastos"
              </span>
            ) : (
              <span className="text-[#EF4444] font-extrabold">Sin registrar (!)</span>
            )}
          </div>

          {/* Grouped by Category Accordion */}
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto scrollbar-thin py-1 pr-0.5">
            {Object.keys(groupedByCategory).length === 0 ? (
              <div
                className={`py-8 text-center text-xs font-bold ${
                  isLight ? "text-zinc-400" : "text-zinc-600"
                }`}
              >
                No hay movimientos cargados en esta fecha
              </div>
            ) : (
              Object.entries(groupedByCategory).map(([catId, items]) => {
                const cat = getCategory(catId);
                const isExpanded = !!expandedCategories[catId];
                const catTotal = items.reduce(
                  (acc, m) => acc + (m.kind === "expense" ? -m.amount : m.amount),
                  0
                );

                return (
                  <div
                    key={catId}
                    className={`rounded-2xl border overflow-hidden transition-all ${
                      isLight
                        ? "bg-zinc-50 border-zinc-200"
                        : "bg-[#111113] border-[#222224]"
                    }`}
                  >
                    {/* Category Summary Header (clickable accordion) */}
                    <button
                      type="button"
                      onClick={() => toggleCategory(catId)}
                      className={`w-full p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                        isLight ? "hover:bg-zinc-100" : "hover:bg-zinc-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-xs font-extrabold">
                          {cat.name} ({items.length})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-extrabold tabular-numbers"
                          style={{ color: cat.color }}
                        >
                          {catTotal < 0 ? "− " : "+ "}
                          {formatCurrency(Math.abs(catTotal))}
                        </span>
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown size={14} className="opacity-60" />
                        </motion.div>
                      </div>
                    </button>

                    {/* Breakdown of individual movements */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                          className={`flex flex-col gap-1.5 p-2.5 pt-1 border-t ${
                            isLight ? "border-zinc-200 bg-white" : "border-[#1F1F22] bg-[#0A0A0C]"
                          }`}
                        >
                          {items.map((m) => (
                            <div
                              key={m.id}
                              className={`p-2 rounded-xl border flex items-center justify-between text-xs ${
                                isLight
                                  ? "bg-zinc-50 border-zinc-200"
                                  : "bg-zinc-900/60 border-[#222224]"
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="font-extrabold">
                                  {m.note || cat.name}
                                </span>
                                {m.source !== "manual" && (
                                  <span className="text-[8px] uppercase font-bold opacity-50">
                                    {m.source}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <span
                                  className="font-extrabold tabular-numbers text-xs"
                                  style={{ color: cat.color }}
                                >
                                  {m.kind === "expense" ? "− " : "+ "}
                                  {formatCurrency(m.amount)}
                                </span>
                                {onDeleteMovement && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteMovement(m.id)}
                                    className="p-1 opacity-40 hover:opacity-100 hover:text-red-500 transition-colors"
                                    title="Borrar"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>

          {/* Totals if any */}
          {dayMovements.length > 0 && (
            <div
              className={`pt-2 border-t flex items-center justify-between text-xs font-extrabold ${
                isLight ? "border-zinc-200" : "border-zinc-800"
              }`}
            >
              <span>Total del día:</span>
              <div className="flex items-center gap-2 tabular-numbers">
                {totalExpense > 0 && (
                  <span className="text-[#EF4444]">
                    − {formatCurrency(totalExpense)}
                  </span>
                )}
                {totalIncome > 0 && (
                  <span className="text-[#22C55E]">
                    + {formatCurrency(totalIncome)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onSelectForEntry(dateStr);
                onClose();
              }}
              className="py-2.5 px-3 rounded-xl bg-white text-black font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all hover:bg-zinc-200 cursor-pointer shadow-sm"
            >
              <Plus size={15} />
              <span>Anotar aquí</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onMarkNoExpenses(dateStr);
                onClose();
              }}
              className={`py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                isLight
                  ? "bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-900"
                  : "bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-200"
              }`}
            >
              <CheckCircle2 size={15} className="text-[#10B981]" />
              <span>No gasté nada</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
