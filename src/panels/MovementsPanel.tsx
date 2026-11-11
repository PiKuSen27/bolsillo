import { useState } from "react";
import { Trash2, Edit2, Filter, ChevronDown, PieChart, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Category, Movement, MovementKind } from "../types";
import { formatCurrency, formatNumberWithDots, formatShortDate, formatAmountInput } from "../lib/format";
import { filterMovements } from "../lib/search";

interface MovementsPanelProps {
  movements: Movement[];
  categories: Category[];
  periodStart: string;
  periodEnd: string;
  isLight?: boolean;
  onDeleteMovement: (id: string) => void;
  onUpdateMovement: (m: Movement) => void;
}

export function MovementsPanel({
  movements,
  categories,
  periodStart,
  periodEnd,
  isLight,
  onDeleteMovement,
  onUpdateMovement,
}: MovementsPanelProps) {
  const [query, setQuery] = useState("");
  const isSearching = query.trim() !== "";
  const [filterKind, setFilterKind] = useState<"all" | MovementKind>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  // Sin búsqueda: solo el período. Con búsqueda: todo el historial.
  const scoped = filterMovements({ movements, categories, query, periodStart, periodEnd });

  const filtered = scoped.filter((m) => {
    if (filterKind !== "all" && m.kind !== filterKind) return false;
    if (filterCategory !== "all" && m.categoryId !== filterCategory) return false;
    return true;
  });

  const handleStartEdit = (m: Movement, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(m.id);
    setEditAmount(formatNumberWithDots(m.amount));
    setEditNote(m.note || "");
  };

  const handleSaveEdit = (m: Movement, e: React.MouseEvent) => {
    e.stopPropagation();
    const parsed = parseInt(editAmount.replace(/\./g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) {
      onUpdateMovement({
        ...m,
        amount: parsed,
        note: editNote.trim() || undefined,
      });
    }
    setEditingId(null);
  };

  const getCategory = (catId: string): Category => {
    if (catId === "income") {
      return {
        id: "income",
        name: "Ingreso de plata",
        icon: "💰",
        color: isLight ? "#16A34A" : "#22C55E",
      };
    }
    return (
      categories.find((c) => c.id === catId) || {
        id: catId,
        name: "Otros",
        icon: "📦",
        color: "#6B7280",
      }
    );
  };

  // Group filtered movements by category (incomes always group under 'income')
  const groupedByCategory = filtered.reduce<Record<string, { category: Category; items: Movement[]; total: number }>>(
    (acc, m) => {
      const targetCatId = m.kind === "income" ? "income" : m.categoryId;
      const cat = getCategory(targetCatId);
      if (!acc[cat.id]) {
        acc[cat.id] = { category: cat, items: [], total: 0 };
      }
      acc[cat.id].items.push(m);
      if (m.kind === "expense") {
        acc[cat.id].total += m.amount;
      } else {
        acc[cat.id].total -= m.amount;
      }
      return acc;
    },
    {}
  );

  const groups = Object.values(groupedByCategory);

  // Segmented multi-color expense distribution bar
  const expenseGroups = groups.filter((g) => g.total > 0 && g.category.id !== "income");
  const totalPeriodExpenses = expenseGroups.reduce((acc, g) => acc + g.total, 0);

  return (
    <div className="flex flex-col gap-3 select-none pb-4">
      {/* Filters */}
      <div
        className={`flex flex-col gap-2 p-2.5 rounded-2xl border ${
          isLight ? "bg-white border-zinc-200" : "bg-[#0A0A0C] border-[#222224]"
        }`}
      >
        <div className="flex items-center gap-1.5 text-xs font-extrabold opacity-60">
          <Filter size={13} />
          <span>Filtros</span>
        </div>

        {/* Buscador: nota, categoría o monto, en todo el historial */}
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border ${
            isLight ? "bg-zinc-100 border-zinc-200" : "bg-zinc-900 border-zinc-800"
          }`}
        >
          <Search size={13} className="opacity-50 shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nota, categoría o monto…"
            aria-label="Buscar movimientos"
            className={`flex-1 min-w-0 bg-transparent text-xs font-bold focus:outline-none ${
              isLight ? "text-black placeholder:text-zinc-400" : "text-white placeholder:text-zinc-500"
            }`}
          />
          {isSearching && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="p-0.5 rounded-md opacity-60 hover:opacity-100 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <span className="text-[10px] font-bold opacity-50">
          {isSearching
            ? `${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"} en todo el historial`
            : `Mostrando el período actual (${formatShortDate(periodStart)} al ${formatShortDate(periodEnd)})`}
        </span>

        <div className="flex items-center gap-1.5">
          {(["all", "expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilterKind(k)}
              className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                filterKind === k
                  ? isLight
                    ? "bg-black text-white"
                    : "bg-white text-black"
                  : isLight
                  ? "bg-zinc-100 text-zinc-600 hover:text-black"
                  : "bg-zinc-900 text-zinc-400 hover:text-white"
              }`}
            >
              {k === "all" ? "Todos" : k === "expense" ? "Gastos" : "Ingresos"}
            </button>
          ))}
        </div>

        {/* Categories filter */}
        <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setFilterCategory("all")}
            className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
              filterCategory === "all"
                ? isLight
                  ? "bg-black text-white"
                  : "bg-white text-black"
                : isLight
                ? "bg-zinc-100 text-zinc-600 hover:text-black"
                : "bg-zinc-900 text-zinc-400 hover:text-white"
            }`}
          >
            Todas
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilterCategory(c.id)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                filterCategory === c.id
                  ? isLight
                    ? "bg-black text-white"
                    : "bg-white text-black"
                  : isLight
                  ? "bg-zinc-100 text-zinc-600 hover:text-black"
                  : "bg-zinc-900 text-zinc-400 hover:text-white"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: c.color }}
              />
              <span className="truncate max-w-[90px]">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Segmented Multi-Color Expense Bar */}
      {totalPeriodExpenses > 0 && (
        <div
          className={`p-3 rounded-2xl border flex flex-col gap-2 ${
            isLight ? "bg-white border-zinc-200" : "bg-[#0A0A0C] border-[#222224]"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-black">
            <div className="flex items-center gap-1.5 opacity-80">
              <PieChart size={13} />
              <span className="uppercase tracking-wider text-[10px]">Distribución de Gastos</span>
            </div>
            <span className="tabular-numbers">
              {formatCurrency(totalPeriodExpenses)}
            </span>
          </div>

          {/* Segmented Bar */}
          <div className="w-full h-3 rounded-full overflow-hidden flex bg-zinc-500/10 p-0.5 gap-0.5">
            {expenseGroups.map((g) => {
              const pct = (g.total / totalPeriodExpenses) * 100;
              return (
                <div
                  key={g.category.id}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: g.category.color,
                  }}
                  title={`${g.category.name}: ${formatCurrency(g.total)} (${Math.round(pct)}%)`}
                  className="h-full rounded-sm transition-all duration-300 first:rounded-l-full last:rounded-r-full"
                />
              );
            })}
          </div>

          {/* Mini Legend */}
          <div className="flex flex-wrap gap-2 text-[10px] font-extrabold pt-0.5">
            {expenseGroups.slice(0, 5).map((g) => (
              <div key={g.category.id} className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: g.category.color }}
                />
                <span className="truncate max-w-[90px]">{g.category.name}</span>
                <span className="opacity-60 tabular-numbers">
                  {Math.round((g.total / totalPeriodExpenses) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accordion Categories List */}
      <div className="flex flex-col gap-2">
        {groups.length === 0 ? (
          <div
            className={`text-center py-8 text-xs font-bold ${
              isLight ? "text-zinc-400" : "text-zinc-600"
            }`}
          >
            No hay movimientos registrados
          </div>
        ) : (
          groups.map(({ category: cat, items, total }) => {
            const isExpanded = isSearching || !!expandedCategories[cat.id];

            return (
              <div
                key={cat.id}
                className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
                  isLight
                    ? "bg-white border-zinc-200 shadow-xs"
                    : "bg-[#0E0E10] border-[#222224] shadow-xs"
                }`}
              >
                {/* Header accordion card */}
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={`w-full p-3 flex items-center justify-between text-left transition-colors cursor-pointer select-none ${
                    isLight ? "hover:bg-zinc-50" : "hover:bg-[#151518]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-black tracking-tight">{cat.name}</span>
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                          isLight ? "bg-zinc-100 text-zinc-600" : "bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        {items.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-black tabular-numbers"
                      style={{ color: cat.color }}
                    >
                      {total >= 0 ? "− " : "+ "}
                      {formatCurrency(Math.abs(total))}
                    </span>
                    <ChevronDown
                      size={15}
                      className={`text-zinc-400 transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {/* Expanded individual transactions */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className={`border-t flex flex-col divide-y ${
                        isLight
                          ? "border-zinc-100 divide-zinc-100 bg-zinc-50/60"
                          : "border-zinc-900 divide-zinc-900 bg-black/40"
                      }`}
                    >
                      {items.map((m) => {
                        const isEditing = editingId === m.id;

                        return (
                          <div key={m.id} className="p-2.5 px-3 flex flex-col gap-1.5">
                            {isEditing ? (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editAmount}
                                    onChange={(e) => {
                                      setEditAmount(formatAmountInput(e.target.value));
                                    }}
                                    className={`w-28 text-xs font-black px-2.5 py-1 rounded-xl border focus:outline-none ${
                                      isLight
                                        ? "bg-white border-zinc-300 text-black"
                                        : "bg-zinc-900 border-zinc-700 text-white"
                                    }`}
                                    placeholder="Monto"
                                    autoFocus
                                  />
                                  <input
                                    type="text"
                                    value={editNote}
                                    onChange={(e) => setEditNote(e.target.value)}
                                    className={`flex-1 text-xs font-bold px-2.5 py-1 rounded-xl border focus:outline-none ${
                                      isLight
                                        ? "bg-white border-zinc-300 text-black"
                                        : "bg-zinc-900 border-zinc-700 text-white"
                                    }`}
                                    placeholder="Nota opcional"
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                    className="px-2.5 py-0.5 rounded-lg text-xs font-bold opacity-60 hover:opacity-100 cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleSaveEdit(m, e)}
                                    className={`px-3 py-0.5 rounded-lg font-black text-xs cursor-pointer ${
                                      isLight
                                        ? "bg-black text-white hover:bg-zinc-800"
                                        : "bg-white text-black hover:bg-zinc-200"
                                    }`}
                                  >
                                    Guardar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col text-left overflow-hidden mr-2">
                                  <span className="text-[11px] font-extrabold text-zinc-700 dark:text-zinc-200 truncate max-w-[200px]">
                                    {m.note || "Sin nota"}
                                  </span>
                                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-400">
                                    <span>{formatShortDate(m.date)}</span>
                                    {m.source !== "manual" && (
                                      <>
                                        <span>·</span>
                                        <span className="uppercase text-[8px] font-black">
                                          {m.source}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className="text-xs font-black tabular-numbers"
                                    style={{ color: cat.color }}
                                  >
                                    {m.kind === "expense" ? "− " : "+ "}
                                    {formatCurrency(m.amount)}
                                  </span>
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      type="button"
                                      onClick={(e) => handleStartEdit(m, e)}
                                      className="p-1 rounded-md text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-500/10 transition-colors cursor-pointer"
                                      title="Editar"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteMovement(m.id);
                                      }}
                                      className="p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                                      title="Borrar"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
