import { useState } from "react";
import { Plus, Trash2, CheckCircle } from "lucide-react";
import confetti from "canvas-confetti";
import { Category, Installment, Recurring } from "../types";
import { formatCurrency, formatAmountInput, formatLocalDate } from "../lib/format";
import { Select } from "../components/Select";
import { DateField } from "../components/DateField";

interface FixedAndInstallmentsPanelProps {
  recurrings: Recurring[];
  installments: Installment[];
  categories: Category[];
  isLight?: boolean;
  onAddRecurring: (r: Omit<Recurring, "id">) => void;
  onUpdateRecurring?: (r: Recurring) => void;
  onDeleteRecurring: (id: string) => void;
  onAddInstallment: (i: Omit<Installment, "id">) => void;
  onUpdateInstallment?: (i: Installment) => void;
  onDeleteInstallment: (id: string) => void;
  onPayInstallment: (inst: Installment) => void;
}

export function FixedAndInstallmentsPanel({
  recurrings,
  installments,
  categories,
  isLight,
  onAddRecurring,
  onDeleteRecurring,
  onAddInstallment,
  onDeleteInstallment,
  onPayInstallment,
}: FixedAndInstallmentsPanelProps) {
  const [tab, setTab] = useState<"recurring" | "installments">("recurring");
  const [showAddForm, setShowAddForm] = useState(false);

  // New Recurring state
  const [recName, setRecName] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recDay, setRecDay] = useState("10");
  const defaultCategory = (preferred: string) =>
    categories.find((c) => c.id === preferred)?.id || categories[0]?.id || preferred;
  const [recCategory, setRecCategory] = useState(() => defaultCategory("suscripciones"));
  const [recAutoAdd, setRecAutoAdd] = useState(true);

  // New Installment state
  const [instName, setInstName] = useState("");
  const [instTotal, setInstTotal] = useState("");
  const [instCount, setInstCount] = useState("12");
  const [instFirstDate, setInstFirstDate] = useState(() => formatLocalDate(new Date()));
  const [instCategory, setInstCategory] = useState(() => defaultCategory("otros"));

  const categorySelect = (value: string, onChange: (id: string) => void) => (
    <Select
      ariaLabel="Categoría"
      value={value}
      onChange={onChange}
      isLight={isLight}
      options={categories.map((c) => ({ value: c.id, label: c.name, color: c.color }))}
    />
  );
  const [instAutoAdd, setInstAutoAdd] = useState(true);

  const handleCreateRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(recAmount.replace(/\./g, ""), 10);
    const day = parseInt(recDay, 10);
    if (!recName.trim() || isNaN(amount) || amount <= 0) return;

    onAddRecurring({
      name: recName.trim(),
      amount,
      dueDay: Math.min(31, Math.max(1, day || 1)),
      categoryId: recCategory,
      autoAdd: recAutoAdd,
      active: true,
      createdAt: formatLocalDate(new Date()),
    });

    setRecName("");
    setRecAmount("");
    setShowAddForm(false);
  };

  const handleCreateInstallment = (e: React.FormEvent) => {
    e.preventDefault();
    const total = parseInt(instTotal.replace(/\./g, ""), 10);
    const count = parseInt(instCount, 10);
    if (!instName.trim() || isNaN(total) || total <= 0 || isNaN(count) || count <= 0) {
      return;
    }

    const perInstallment = Math.round(total / count);

    onAddInstallment({
      name: instName.trim(),
      totalAmount: total,
      installmentsCount: count,
      installmentAmount: perInstallment,
      firstDueDate: instFirstDate,
      paidCount: 0,
      categoryId: instCategory,
      autoAdd: instAutoAdd,
      active: true,
    });

    setInstName("");
    setInstTotal("");
    setShowAddForm(false);
  };

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }
  };

  const handleManualPayInstallment = (inst: Installment) => {
    onPayInstallment(inst);
    if (inst.paidCount + 1 >= inst.installmentsCount) {
      triggerConfetti();
    }
  };

  return (
    <div className="flex flex-col gap-3 select-none">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div
          className={`flex items-center gap-1 p-0.5 rounded-xl border ${
            isLight ? "bg-zinc-200 border-zinc-300" : "bg-black border-[#262626]"
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setTab("recurring");
              setShowAddForm(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              tab === "recurring"
                ? isLight
                  ? "bg-white text-black shadow-xs"
                  : "bg-zinc-800 text-white"
                : isLight
                ? "text-zinc-600 hover:text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Suscripciones y Fijos
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("installments");
              setShowAddForm(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              tab === "installments"
                ? isLight
                  ? "bg-white text-black shadow-xs"
                  : "bg-zinc-800 text-white"
                : isLight
                ? "text-zinc-600 hover:text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Cuotas
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1.5 rounded-xl bg-white text-black font-extrabold text-xs flex items-center gap-1 hover:bg-zinc-200 transition-all cursor-pointer"
        >
          <Plus size={14} />
          <span>{showAddForm ? "Cerrar" : "Agregar"}</span>
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div
          className={`p-3.5 rounded-2xl border flex flex-col gap-2.5 ${
            isLight ? "bg-white border-zinc-300" : "bg-[#0A0A0C] border-[#222224]"
          }`}
        >
          {tab === "recurring" ? (
            <form onSubmit={handleCreateRecurring} className="flex flex-col gap-2.5">
              <span className="text-xs font-extrabold">
                Nueva Suscripción o Gasto Fijo
              </span>
              <input
                type="text"
                placeholder="Nombre (ej. Netflix, Luz)"
                value={recName}
                onChange={(e) => setRecName(e.target.value)}
                className={`text-xs font-bold px-3 py-2 rounded-xl border focus:outline-none ${
                  isLight
                    ? "bg-zinc-100 border-zinc-300 text-black"
                    : "bg-zinc-900 border-zinc-700 text-white"
                }`}
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Monto ($ ARS)"
                  value={recAmount}
                  onChange={(e) => {
                    setRecAmount(formatAmountInput(e.target.value));
                  }}
                  className={`text-xs font-bold px-3 py-2 rounded-xl border focus:outline-none ${
                    isLight
                      ? "bg-zinc-100 border-zinc-300 text-black"
                      : "bg-zinc-900 border-zinc-700 text-white"
                  }`}
                  required
                />
                <input
                  type="number"
                  placeholder="Día de cobro (1-31)"
                  value={recDay}
                  min={1}
                  max={31}
                  onChange={(e) => setRecDay(e.target.value)}
                  className={`text-xs font-bold px-3 py-2 rounded-xl border focus:outline-none ${
                    isLight
                      ? "bg-zinc-100 border-zinc-300 text-black"
                      : "bg-zinc-900 border-zinc-700 text-white"
                  }`}
                  required
                />
              </div>
              {categorySelect(recCategory, setRecCategory)}

              <div className="flex items-center justify-between text-xs font-bold pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer opacity-80">
                  <input
                    type="checkbox"
                    checked={recAutoAdd}
                    onChange={(e) => setRecAutoAdd(e.target.checked)}
                    className="accent-[#16A34A] rounded"
                  />
                  <span>Anotar automático el día que vence</span>
                </label>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-white text-black font-extrabold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateInstallment} className="flex flex-col gap-2.5">
              <span className="text-xs font-extrabold">
                Nueva Compra en Cuotas
              </span>
              <input
                type="text"
                placeholder="Nombre (ej. Zapatillas, Heladera)"
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
                className={`text-xs font-bold px-3 py-2 rounded-xl border focus:outline-none ${
                  isLight
                    ? "bg-zinc-100 border-zinc-300 text-black"
                    : "bg-zinc-900 border-zinc-700 text-white"
                }`}
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Total ($ ARS)"
                  value={instTotal}
                  onChange={(e) => {
                    setInstTotal(formatAmountInput(e.target.value));
                  }}
                  className={`text-xs font-bold px-3 py-2 rounded-xl border focus:outline-none ${
                    isLight
                      ? "bg-zinc-100 border-zinc-300 text-black"
                      : "bg-zinc-900 border-zinc-700 text-white"
                  }`}
                  required
                />
                <input
                  type="number"
                  placeholder="Cantidad de cuotas (ej. 12)"
                  value={instCount}
                  min={1}
                  max={72}
                  onChange={(e) => setInstCount(e.target.value)}
                  className={`text-xs font-bold px-3 py-2 rounded-xl border focus:outline-none ${
                    isLight
                      ? "bg-zinc-100 border-zinc-300 text-black"
                      : "bg-zinc-900 border-zinc-700 text-white"
                  }`}
                  required
                />
              </div>
              {categorySelect(instCategory, setInstCategory)}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold opacity-70">Primer vencimiento:</span>
                <DateField
                  ariaLabel="Primer vencimiento"
                  value={instFirstDate}
                  onChange={setInstFirstDate}
                  isLight={isLight}
                  className="flex-1"
                />
              </div>

              <div className="flex items-center justify-between text-xs font-bold pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer opacity-80">
                  <input
                    type="checkbox"
                    checked={instAutoAdd}
                    onChange={(e) => setInstAutoAdd(e.target.checked)}
                    className="accent-[#16A34A] rounded"
                  />
                  <span>Anotar automático</span>
                </label>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-white text-black font-extrabold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* List items */}
      <div className="flex flex-col gap-2">
        {tab === "recurring" ? (
          recurrings.length === 0 ? (
            <div
              className={`text-center py-8 text-xs font-bold ${
                isLight ? "text-zinc-400" : "text-zinc-600"
              }`}
            >
              No tenés suscripciones ni fijos guardados
            </div>
          ) : (
            recurrings.map((r) => (
              <div
                key={r.id}
                className={`p-3 rounded-2xl border flex items-center justify-between ${
                  isLight
                    ? "bg-white border-zinc-200"
                    : "bg-[#0E0E10] border-[#222224]"
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-extrabold">{r.name}</span>
                  <span className="text-[11px] font-semibold opacity-75">
                    Vence los días {r.dueDay} · {r.autoAdd ? "Automático" : "Manual"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold tabular-numbers">
                    {formatCurrency(r.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteRecurring(r.id)}
                    className="p-1 opacity-75 hover:opacity-100 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )
        ) : installments.length === 0 ? (
          <div
            className={`text-center py-8 text-xs font-bold ${
              isLight ? "text-zinc-400" : "text-zinc-600"
            }`}
          >
            No tenés cuotas activas
          </div>
        ) : (
          installments.map((inst) => {
            const isCompleted = inst.paidCount >= inst.installmentsCount;
            const progress = Math.min(
              100,
              Math.round((inst.paidCount / inst.installmentsCount) * 100)
            );

            return (
              <div
                key={inst.id}
                className={`p-3 rounded-2xl border flex flex-col gap-2 ${
                  isLight
                    ? "bg-white border-zinc-200"
                    : "bg-[#0E0E10] border-[#222224]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-extrabold">{inst.name}</span>
                    <span className="text-[11px] font-semibold opacity-75">
                      Total: {formatCurrency(inst.totalAmount)} ({inst.installmentsCount}{" "}
                      cuotas de {formatCurrency(inst.installmentAmount)}{inst.totalAmount !== inst.installmentAmount * inst.installmentsCount ? ", la última ajusta el redondeo" : ""})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-amber-500 tabular-numbers">
                      {inst.paidCount} / {inst.installmentsCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteInstallment(inst.id)}
                      className="p-1 opacity-75 hover:opacity-100 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  className={`w-full h-1.5 rounded-full overflow-hidden ${
                    isLight ? "bg-zinc-200" : "bg-zinc-800"
                  }`}
                >
                  <div
                    className="h-full bg-[#8B5CF6] rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-bold">
                  {isCompleted ? (
                    <span className="text-[#10B981] font-extrabold">
                      ¡Terminaste de pagar! 🎉
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleManualPayInstallment(inst)}
                      className={`px-3 py-1 rounded-xl font-extrabold text-xs flex items-center gap-1 transition-all cursor-pointer border ${
                        isLight
                          ? "bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-black"
                          : "bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-white"
                      }`}
                    >
                      <CheckCircle size={12} className="text-[#10B981]" />
                      <span>Pagar cuota {inst.paidCount + 1}</span>
                    </button>
                  )}
                  <span className="opacity-75 text-[10px]">
                    {inst.autoAdd ? "Auto-anotado" : "Manual"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
