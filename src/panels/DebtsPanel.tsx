import React, { useState } from "react";
import { Plus, Trash2, CheckCircle2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import confetti from "canvas-confetti";
import { Debt, DebtKind } from "../types";
import { formatCurrency, formatShortDate, formatAmountInput } from "../lib/format";

interface DebtsPanelProps {
  debts: Debt[];
  isLight?: boolean;
  onAddDebt: (d: Omit<Debt, "id" | "settled" | "createdAt">) => void;
  onSettleDebt: (debt: Debt, addToMovement: boolean) => void;
  onDeleteDebt: (id: string) => void;
}

export function DebtsPanel({
  debts,
  isLight,
  onAddDebt,
  onSettleDebt,
  onDeleteDebt,
}: DebtsPanelProps) {
  const [filter, setFilter] = useState<"all" | DebtKind>("all");
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<DebtKind>("i_owe");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");

  // Modal to settle debt asking whether to add to movements
  const [settlingDebt, setSettlingDebt] = useState<Debt | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseInt(amount.replace(/\./g, ""), 10);
    if (!person.trim() || isNaN(cleanAmount) || cleanAmount <= 0) return;

    onAddDebt({
      person: person.trim(),
      amount: cleanAmount,
      kind,
      dueDate: dueDate || undefined,
      note: note.trim() || undefined,
    });

    setPerson("");
    setAmount("");
    setDueDate("");
    setNote("");
    setShowAddForm(false);
  };

  const handleConfirmSettle = (addToMovement: boolean) => {
    if (!settlingDebt) return;
    try {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    } catch {
      // ignore
    }
    onSettleDebt(settlingDebt, addToMovement);
    setSettlingDebt(null);
  };

  const filteredDebts = debts.filter((d) => {
    if (filter === "all") return true;
    return d.kind === filter;
  });

  const pendingDebts = filteredDebts.filter((d) => !d.settled);
  const settledDebts = filteredDebts.filter((d) => d.settled);

  return (
    <div className="flex flex-col gap-3 select-none">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div
          className={`flex items-center gap-1 p-0.5 rounded-xl border ${
            isLight ? "bg-zinc-200 border-zinc-300" : "bg-black border-[#262626]"
          }`}
        >
          {(["all", "i_owe", "they_owe"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                filter === k
                  ? isLight
                    ? "bg-white text-black shadow-xs"
                    : "bg-zinc-800 text-white"
                  : isLight
                  ? "text-zinc-600 hover:text-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {k === "all" ? "Todas" : k === "i_owe" ? "Debo plata" : "Me deben"}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1.5 rounded-xl bg-white text-black font-extrabold text-xs flex items-center gap-1 hover:bg-zinc-200 transition-all cursor-pointer"
        >
          <Plus size={14} />
          <span>{showAddForm ? "Cerrar" : "Nueva"}</span>
        </button>
      </div>

      {/* Add Debt Form */}
      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className={`p-3 rounded-2xl border flex flex-col gap-2 ${
            isLight ? "bg-white border-zinc-300" : "bg-[#000000] border-[#262626]"
          }`}
        >
          <span className="text-xs font-extrabold">Registrar Deuda</span>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind("i_owe")}
              className={`py-1.5 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                kind === "i_owe"
                  ? "bg-red-500/20 border-red-500 text-red-500 font-black"
                  : isLight
                  ? "bg-zinc-100 border-zinc-200 text-zinc-600"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400"
              }`}
            >
              <ArrowDownLeft size={14} />
              <span>Debo plata</span>
            </button>

            <button
              type="button"
              onClick={() => setKind("they_owe")}
              className={`py-1.5 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                kind === "they_owe"
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-500 font-black"
                  : isLight
                  ? "bg-zinc-100 border-zinc-200 text-zinc-600"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400"
              }`}
            >
              <ArrowUpRight size={14} />
              <span>Me deben plata</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Persona o motivo"
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border focus:outline-none ${
                isLight
                  ? "bg-zinc-100 border-zinc-300 text-black"
                  : "bg-zinc-900 border-zinc-700 text-white"
              }`}
              required
            />
            <input
              type="text"
              placeholder="Monto ($ ARS)"
              value={amount}
              onChange={(e) => {
                setAmount(formatAmountInput(e.target.value));
              }}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border focus:outline-none ${
                isLight
                  ? "bg-zinc-100 border-zinc-300 text-black"
                  : "bg-zinc-900 border-zinc-700 text-white"
              }`}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold block mb-0.5 opacity-60">
                Fecha límite (opcional)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full text-xs font-bold px-2 py-1 rounded-lg border focus:outline-none ${
                  isLight
                    ? "bg-zinc-100 border-zinc-300 text-black"
                    : "bg-zinc-900 border-zinc-700 text-white"
                }`}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold block mb-0.5 opacity-60">
                Nota adicional (opcional)
              </label>
              <input
                type="text"
                placeholder="Ej. Cena, prestado..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={`w-full text-xs font-bold px-2 py-1 rounded-lg border focus:outline-none ${
                  isLight
                    ? "bg-zinc-100 border-zinc-300 text-black"
                    : "bg-zinc-900 border-zinc-700 text-white"
                }`}
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-white text-black font-extrabold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              Guardar deuda
            </button>
          </div>
        </form>
      )}

      {/* Pending debts list */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-extrabold uppercase opacity-60">
          Pendientes ({pendingDebts.length})
        </span>

        {pendingDebts.length === 0 ? (
          <div
            className={`text-center py-6 text-xs font-bold ${
              isLight ? "text-zinc-400" : "text-zinc-600"
            }`}
          >
            No tenés deudas pendientes
          </div>
        ) : (
          pendingDebts.map((d) => (
            <div
              key={d.id}
              className={`p-3 rounded-2xl border flex items-center justify-between ${
                isLight ? "bg-white border-zinc-200" : "bg-[#0E0E10] border-[#222224]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    d.kind === "i_owe"
                      ? "bg-red-500/15 text-[#EF4444]"
                      : "bg-emerald-500/15 text-[#22C55E]"
                  }`}
                >
                  {d.kind === "i_owe" ? (
                    <ArrowDownLeft size={16} />
                  ) : (
                    <ArrowUpRight size={16} />
                  )}
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold">{d.person}</span>
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                        d.kind === "i_owe"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-emerald-500/20 text-emerald-400"
                      }`}
                    >
                      {d.kind === "i_owe" ? "Debo" : "Me debe"}
                    </span>
                  </div>
                  {d.note && (
                    <span className="text-[10px] text-zinc-400 font-semibold">
                      {d.note}
                    </span>
                  )}
                  {d.dueDate && (
                    <span className="text-[9px] text-amber-500 font-bold">
                      Vence: {formatShortDate(d.dueDate)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-extrabold tabular-numbers ${
                    d.kind === "i_owe" ? "text-[#EF4444]" : "text-[#22C55E]"
                  }`}
                >
                  {formatCurrency(d.amount)}
                </span>

                <button
                  type="button"
                  onClick={() => setSettlingDebt(d)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                    isLight
                      ? "bg-zinc-200 hover:bg-zinc-300 text-black"
                      : "bg-zinc-800 hover:bg-zinc-700 text-white"
                  }`}
                >
                  Saldar
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteDebt(d.id)}
                  className="p-1 text-zinc-500 hover:text-red-500"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Settled debts history */}
      {settledDebts.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
          <span className="text-[11px] font-extrabold uppercase opacity-40">
            Saldadas ({settledDebts.length})
          </span>

          {settledDebts.map((d) => (
            <div
              key={d.id}
              className={`p-2 rounded-xl border flex items-center justify-between opacity-60 ${
                isLight ? "bg-zinc-100 border-zinc-200" : "bg-[#09090A] border-[#1C1C1E]"
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold line-through">
                <span>{d.person}</span>
                <span>({d.kind === "i_owe" ? "pagado" : "cobrado"})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold line-through tabular-numbers">
                  {formatCurrency(d.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteDebt(d.id)}
                  className="text-zinc-500 hover:text-red-500"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Settle Debt Confirmation Modal */}
      {settlingDebt && (
        <div role="dialog" aria-modal="true" className="absolute inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setSettlingDebt(null)}
            className="absolute inset-0 bg-black/70 backdrop-blur-xs"
          />

          <div
            className={`relative w-full max-w-xs rounded-2xl border p-4 flex flex-col gap-3 shadow-2xl ${
              isLight ? "bg-white border-zinc-300 text-black" : "bg-black border-[#262626] text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-[#10B981]" />
              <h4 className="text-sm font-extrabold">Saldar Deuda</h4>
            </div>

            <p className="text-xs font-semibold">
              Vas a marcar la deuda de <strong>{formatCurrency(settlingDebt.amount)}</strong> con{" "}
              <strong>{settlingDebt.person}</strong> como saldada.
            </p>

            <p className="text-[11px] opacity-70">
              ¿Querés registrar automáticamente el movimiento en tu saldo disponible?
            </p>

            <div className="flex flex-col gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleConfirmSettle(true)}
                className="w-full py-2 rounded-xl bg-white text-black font-extrabold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                Sí, {settlingDebt.kind === "i_owe" ? "descontar de mi saldo" : "sumar a mi saldo"}
              </button>

              <button
                type="button"
                onClick={() => handleConfirmSettle(false)}
                className={`w-full py-2 rounded-xl font-extrabold text-xs border transition-colors cursor-pointer ${
                  isLight ? "bg-zinc-100 border-zinc-300 text-black" : "bg-zinc-900 border-zinc-800 text-white"
                }`}
              >
                Solo saldar deuda (sin mover saldo)
              </button>

              <button
                type="button"
                onClick={() => setSettlingDebt(null)}
                className="text-[10px] font-bold opacity-60 hover:opacity-100 text-center pt-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
