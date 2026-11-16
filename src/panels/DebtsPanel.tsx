import React, { useState } from "react";
import { Plus, Trash2, CheckCircle2, ArrowDownLeft, ArrowUpRight, ChevronDown, Users, Edit2 } from "lucide-react";
import confetti from "canvas-confetti";
import { Debt, DebtKind, DollarType } from "../types";
import { debtArs, fetchQuote, Quote } from "../lib/dollars";
import { QuoteField } from "../components/QuoteField";
import { formatCurrency, formatShortDate, formatAmountInput, formatNumberWithDots, formatUsd, formatLocalDate } from "../lib/format";
import { groupDebtsByPerson, PersonGroup, suggestPersonNames } from "../lib/debts";
import { DateField } from "../components/DateField";

type DebtFields = Omit<Debt, "id" | "settled" | "createdAt" | "settledAt">;

interface DebtsPanelProps {
  debts: Debt[];
  isLight?: boolean;
  onAddDebt: (d: DebtFields) => void;
  onSettleDebt: (debts: Debt[], addToMovement: boolean) => void;
  onDeleteDebt: (id: string) => void;
  onUpdateDebt: (d: Debt) => void;
  dollars: { enabled: boolean; type: DollarType };
}

/** "Rocio te debe $ X" / "Le debés $ X" / "Están a mano" */
function netLabel(g: PersonGroup) {
  if (g.net > 0) return `${g.name} te debe ${formatCurrency(g.net)}`;
  if (g.net < 0) return `Le debés ${formatCurrency(-g.net)}`;
  return "Están a mano";
}

/** Formulario de deuda: sirve para crear y para editar. */
function DebtForm({
  title,
  initial,
  lockedKind,
  allDebts,
  isLight,
  submitLabel,
  onSubmit,
  onCancel,
  dollars,
}: {
  dollars?: { enabled: boolean; type: DollarType };
  title: string;
  initial?: Partial<DebtFields>;
  lockedKind?: DebtKind; // parado en "Debo plata" / "Me deben": no se pregunta
  allDebts: Debt[];
  isLight?: boolean;
  submitLabel: string;
  onSubmit: (d: DebtFields) => void;
  onCancel?: () => void;
}) {
  const [person, setPerson] = useState(initial?.person ?? "");
  const [amount, setAmount] = useState(initial?.amount ? formatNumberWithDots(initial.amount) : "");
  const [kind, setKind] = useState<DebtKind>(initial?.kind ?? "i_owe");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [currency, setCurrency] = useState<"ARS" | "USD">(initial?.currency ?? "ARS");
  const [quote, setQuote] = useState<Quote | null>(
    initial?.rate ? { rate: initial.rate, date: initial.rateDate ?? formatLocalDate(new Date()), type: initial.rateType ?? dollars?.type ?? "oficial" } : null
  );
  const showCurrency = !!dollars?.enabled || initial?.currency === "USD";
  const finalKind = lockedKind ?? kind;
  const suggestions = suggestPersonNames(allDebts, person);

  const input = `text-xs font-bold px-2.5 py-1.5 rounded-lg border focus:outline-none ${
    isLight ? "bg-zinc-100 border-zinc-300 text-black" : "bg-zinc-900 border-zinc-700 text-white"
  }`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseInt(amount.replace(/\./g, ""), 10);
    if (!person.trim() || isNaN(cleanAmount) || cleanAmount <= 0) return;
    if (currency === "USD" && !quote) return; // en dólares hace falta la cotización
    onSubmit({
      person: person.trim().replace(/\s+/g, " "),
      amount: cleanAmount,
      kind: finalKind,
      currency: currency === "USD" ? "USD" : undefined,
      rate: currency === "USD" ? quote!.rate : undefined,
      rateDate: currency === "USD" ? quote!.date : undefined,
      rateType: currency === "USD" ? quote!.type : undefined,
      dueDate: dueDate || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`p-3 rounded-2xl border flex flex-col gap-2 ${
        isLight ? "bg-white border-zinc-300" : "bg-[#000000] border-[#262626]"
      }`}
    >
      <span className="text-xs font-extrabold">{title}</span>

      {!lockedKind && (
        <div className="grid grid-cols-2 gap-2">
          {(["i_owe", "they_owe"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`py-1.5 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                kind === k
                  ? k === "i_owe"
                    ? "bg-red-500/20 border-red-500 text-red-500 font-black"
                    : "bg-emerald-500/20 border-emerald-500 text-emerald-600 font-black"
                  : isLight
                  ? "bg-zinc-100 border-zinc-200 text-zinc-600"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400"
              }`}
            >
              {k === "i_owe" ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
              <span>{k === "i_owe" ? "Debo plata" : "Me deben plata"}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Persona o motivo"
          aria-label="Persona o motivo"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          className={input}
          required
        />
        <input
          type="text"
          inputMode="numeric"
          placeholder={currency === "USD" ? "Monto (USD)" : "Monto ($ ARS)"}
          aria-label="Monto"
          value={amount}
          onChange={(e) => setAmount(formatAmountInput(e.target.value))}
          className={input}
          required
        />
      </div>

      {showCurrency && (
        <div className={`p-0.5 rounded-xl border flex gap-0.5 ${isLight ? "bg-zinc-100 border-zinc-200" : "bg-black border-[#222224]"}`}>
          {(["ARS", "USD"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={currency === c}
              onClick={() => setCurrency(c)}
              className={`flex-1 py-1 rounded-lg text-xs font-extrabold cursor-pointer ${
                currency === c ? (isLight ? "bg-white text-black shadow-xs" : "bg-zinc-800 text-white") : isLight ? "text-zinc-600" : "text-zinc-400"
              }`}
            >
              {c === "ARS" ? "Pesos" : "Dólares"}
            </button>
          ))}
        </div>
      )}
      {currency === "USD" && (
        <QuoteField
          usd={parseInt(amount.replace(/\./g, ""), 10) || 0}
          value={quote}
          onChange={setQuote}
          dollarType={dollars?.type ?? "oficial"}
          isLight={isLight}
        />
      )}

      {/* Nombres ya usados: tocá uno para no crear "Rocio" y "Rocío" por separado */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold opacity-75">¿Es</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPerson(s)}
              className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold border cursor-pointer ${
                isLight ? "bg-zinc-100 border-zinc-300 hover:bg-zinc-200" : "bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
              }`}
            >
              {s}
            </button>
          ))}
          <span className="text-[10px] font-bold opacity-75">?</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold block mb-0.5 opacity-75">Fecha límite (opcional)</label>
          <DateField ariaLabel="Fecha límite" value={dueDate} onChange={setDueDate} isLight={isLight} />
        </div>
        <div>
          <label className="text-[10px] font-bold block mb-0.5 opacity-75">Nota adicional (opcional)</label>
          <input
            type="text"
            placeholder="Ej. Cena, prestado..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={`w-full ${input}`}
          />
        </div>
      </div>

      <div className="flex justify-end items-center gap-2 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-xl text-xs font-bold opacity-75 hover:opacity-100 cursor-pointer">
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className={`px-4 py-1.5 rounded-xl font-extrabold text-xs transition-colors cursor-pointer ${
            isLight ? "bg-black text-white hover:bg-zinc-800" : "bg-white text-black hover:bg-zinc-200"
          }`}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function DebtsPanel({ debts, isLight, onAddDebt, onSettleDebt, onDeleteDebt, onUpdateDebt, dollars }: DebtsPanelProps) {
  const [quoteBusy, setQuoteBusy] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<{ id: string; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | DebtKind>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [grouped, setGrouped] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Confirmación para saldar una deuda o todas las de una persona (pregunta si se registra el movimiento)
  const [settling, setSettling] = useState<{ debts: Debt[]; name: string; total: number } | null>(null);
  const askSettle = (list: Debt[], name: string) => {
    const net = list.reduce((s, d) => s + (d.kind === "they_owe" ? debtArs(d) : -debtArs(d)), 0);
    setSettling({ debts: list, name, total: Math.abs(net) });
  };

  const handleConfirmSettle = (addToMovement: boolean) => {
    if (!settling) return;
    try {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    } catch {
      // ignore
    }
    onSettleDebt(settling.debts, addToMovement);
    setSettling(null);
  };

  const filteredDebts = debts.filter((d) => filter === "all" || d.kind === filter);
  const pendingDebts = filteredDebts.filter((d) => !d.settled);
  const settledDebts = filteredDebts.filter((d) => d.settled);
  const groups = groupDebtsByPerson(pendingDebts);

  const card = isLight ? "bg-white border-zinc-200" : "bg-[#0E0E10] border-[#222224]";

  const editForm = (d: Debt) => (
    <DebtForm
      key={d.id}
      title="Editar deuda"
      initial={d}
      allDebts={debts.filter((x) => x.id !== d.id)}
      dollars={dollars}
      isLight={isLight}
      submitLabel="Guardar cambios"
      onCancel={() => setEditingId(null)}
      onSubmit={(fields) => {
        onUpdateDebt({ ...d, ...fields });
        setEditingId(null);
      }}
    />
  );

  const editButton = (d: Debt) => (
    <button
      type="button"
      aria-label="Editar deuda"
      title="Editar"
      onClick={() => setEditingId(d.id)}
      className={`p-1 rounded-md cursor-pointer ${isLight ? "text-zinc-500 hover:text-black" : "text-zinc-400 hover:text-white"}`}
    >
      <Edit2 size={13} />
    </button>
  );

  const debtRow = (d: Debt, showPerson: boolean) => editingId === d.id ? editForm(d) : (
    <div key={d.id} className={`p-3 rounded-2xl border flex flex-col gap-1.5 ${card}`}>
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
            d.kind === "i_owe" ? "bg-red-500/15 text-[#EF4444]" : "bg-emerald-500/15 text-[#16A34A]"
          }`}
        >
          {d.kind === "i_owe" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-extrabold truncate">{showPerson ? d.person : d.note || "Sin nota"}</span>
            {/* En la tarjeta de la persona la flecha de color ya dice el sentido; el cartel ocupa lugar */}
            {showPerson && (
            <span
              className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                d.kind === "i_owe"
                  ? isLight ? "bg-red-100 text-red-700" : "bg-red-500/20 text-red-400"
                  : isLight ? "bg-emerald-100 text-emerald-700" : "bg-emerald-500/20 text-emerald-400"
              }`}
            >
              {d.kind === "i_owe" ? "Debo" : "Me debe"}
            </span>
            )}
          </div>
          {showPerson && d.note && (
            <span className={`text-[10px] font-semibold truncate ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>{d.note}</span>
          )}
          {d.dueDate && (
            <span className="text-[9px] text-amber-600 font-bold">Vence: {formatShortDate(d.dueDate)}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`flex flex-col items-end text-sm font-extrabold tabular-numbers ${d.kind === "i_owe" ? "text-[#EF4444]" : "text-[#16A34A]"}`}>
          {d.currency === "USD" ? formatUsd(d.amount) : formatCurrency(d.amount)}
        </span>
        <button
          type="button"
          onClick={() => askSettle([d], d.person)}
          className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
            isLight ? "bg-zinc-200 hover:bg-zinc-300 text-black" : "bg-zinc-800 hover:bg-zinc-700 text-white"
          }`}
        >
          Saldar
        </button>
        {editButton(d)}
        <button
          type="button"
          aria-label="Borrar deuda"
          title="Borrar"
          onClick={() => onDeleteDebt(d.id)}
          className={`p-1 rounded-md hover:text-red-500 cursor-pointer ${isLight ? "text-zinc-500" : "text-zinc-400"}`}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
    {d.currency === "USD" && (
      <div className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 pl-9 text-[10px] font-bold tabular-numbers ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>
        <span>
          ≈ {formatCurrency(debtArs(d))} (a {formatCurrency(d.rate ?? 0)}
          {d.rateDate ? ` del ${formatShortDate(d.rateDate)}` : ""})
        </span>
          {d.currency === "USD" && (
            <button
              type="button"
              disabled={quoteBusy === d.id}
              onClick={async () => {
                setQuoteBusy(d.id);
                setQuoteError(null);
                try {
                  const q = await fetchQuote(dollars.type);
                  onUpdateDebt({ ...d, rate: q.rate, rateDate: q.date, rateType: q.type });
                } catch (e) {
                  setQuoteError({ id: d.id, text: e instanceof Error ? e.message : String(e) });
                } finally {
                  setQuoteBusy(null);
                }
              }}
              className="text-[10px] font-extrabold underline opacity-80 hover:opacity-100 cursor-pointer disabled:opacity-50"
            >
              {quoteBusy === d.id ? "Buscando…" : "Actualizar cotización"}
            </button>
          )}
          {quoteError?.id === d.id && <span role="alert" className="text-[10px] font-bold text-[#DC2626]">{quoteError.text}</span>}
      </div>
    )}
    </div>
  );

  return (
    <div className="flex flex-col gap-3 select-none">
      {/* Pestañas y "+ Nueva" */}
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-1 p-0.5 rounded-xl border ${isLight ? "bg-zinc-200 border-zinc-300" : "bg-black border-[#262626]"}`}>
          {(["all", "i_owe", "they_owe"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                filter === k
                  ? isLight ? "bg-white text-black shadow-xs" : "bg-zinc-800 text-white"
                  : isLight ? "text-zinc-600 hover:text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              {k === "all" ? "Todas" : k === "i_owe" ? "Debo plata" : "Me deben"}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
            isLight ? "bg-black text-white hover:bg-zinc-800" : "bg-white text-black hover:bg-zinc-200"
          }`}
        >
          <Plus size={14} />
          <span>{showAddForm ? "Cerrar" : "Nueva"}</span>
        </button>
      </div>

      {showAddForm && (
        <DebtForm
          key={filter}
          title={filter === "i_owe" ? "Registrar deuda (debo plata)" : filter === "they_owe" ? "Registrar deuda (me deben plata)" : "Registrar deuda"}
          lockedKind={filter === "all" ? undefined : filter}
          allDebts={debts}
          dollars={dollars}
          isLight={isLight}
          submitLabel="Guardar deuda"
          onSubmit={(d) => {
            onAddDebt(d);
            setShowAddForm(false);
          }}
        />
      )}

      {/* Pendientes */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold uppercase opacity-75">Pendientes ({pendingDebts.length})</span>
          <button
            type="button"
            role="switch"
            aria-checked={grouped}
            onClick={() => setGrouped(!grouped)}
            className="flex items-center gap-1.5 text-[11px] font-extrabold cursor-pointer"
          >
            <Users size={12} className="opacity-75" />
            <span>Agrupar por persona</span>
            <span
              className={`w-7 h-4 rounded-full p-0.5 flex transition-colors ${
                grouped ? (isLight ? "bg-[#16A34A] justify-end" : "bg-[#22C55E] justify-end") : isLight ? "bg-zinc-300" : "bg-zinc-700"
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
            </span>
          </button>
        </div>

        {pendingDebts.length === 0 ? (
          <div className="text-center py-6 text-xs font-bold text-zinc-500">No tenés deudas pendientes</div>
        ) : grouped ? (
          groups.map((g) => {
            const open = !!openGroups[g.key];
            return (
              <div key={g.key} className={`rounded-2xl border overflow-hidden ${card}`}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenGroups((s) => ({ ...s, [g.key]: !open }))}
                  className={`w-full p-3 flex items-center justify-between gap-2 text-left cursor-pointer ${
                    isLight ? "hover:bg-zinc-50" : "hover:bg-[#151518]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-black ${
                        isLight ? "bg-zinc-200 text-black" : "bg-zinc-800 text-white"
                      }`}
                    >
                      {g.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-extrabold truncate">{g.name}</span>
                      <span className={`text-[10px] font-bold ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>
                        {g.count} {g.count === 1 ? "deuda" : "deudas"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-xs font-extrabold tabular-numbers text-right ${
                        g.net > 0 ? "text-[#16A34A]" : g.net < 0 ? "text-[#EF4444]" : isLight ? "text-zinc-600" : "text-zinc-400"
                      }`}
                    >
                      {netLabel(g)}
                    </span>
                    <ChevronDown size={14} className={`opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {open && (
                  <div className="p-2 pt-0 flex flex-col gap-1.5">
                    {g.debts.map((d) => debtRow(d, false))}
                    {g.count > 1 && (
                      <button
                        type="button"
                        onClick={() => askSettle(g.debts, g.name)}
                        className={`self-end px-3 py-1.5 rounded-xl text-[11px] font-extrabold border cursor-pointer ${
                          isLight ? "bg-zinc-100 border-zinc-300 hover:bg-zinc-200" : "bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
                        }`}
                      >
                        Saldar todo
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          pendingDebts.map((d) => debtRow(d, true))
        )}
      </div>

      {/* Saldadas */}
      {settledDebts.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-500/10">
          <span className="text-[11px] font-extrabold uppercase opacity-60">Saldadas ({settledDebts.length})</span>
          {settledDebts.map((d) => editingId === d.id ? editForm(d) : (
            <div
              key={d.id}
              className={`p-2 rounded-xl border flex items-center justify-between opacity-75 ${
                isLight ? "bg-zinc-100 border-zinc-200" : "bg-[#09090A] border-[#1C1C1E]"
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold line-through min-w-0">
                <span className="truncate">{d.person}</span>
                <span className="shrink-0">({d.kind === "i_owe" ? "pagado" : "cobrado"})</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold line-through tabular-numbers">{d.currency === "USD" ? formatUsd(d.amount) : formatCurrency(d.amount)}</span>
                {editButton(d)}
                <button
                  type="button"
                  aria-label="Borrar deuda"
                  onClick={() => onDeleteDebt(d.id)}
                  className={`hover:text-red-500 cursor-pointer ${isLight ? "text-zinc-500" : "text-zinc-400"}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmación para saldar */}
      {settling && (
        <div role="dialog" aria-modal="true" aria-labelledby="settle-title" className="absolute inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setSettling(null)} className="absolute inset-0 bg-black/70 backdrop-blur-xs" />
          <div
            className={`relative w-full max-w-xs rounded-2xl border p-4 flex flex-col gap-3 shadow-2xl ${
              isLight ? "bg-white border-zinc-300 text-black" : "bg-black border-[#262626] text-white"
            }`}
          >
            <div className="flex items-start gap-2">
              <CheckCircle2 size={18} className="text-[#10B981] shrink-0 mt-0.5" />
              <h4 id="settle-title" className="text-sm font-extrabold">
                {settling.debts.length === 1
                  ? `¿Marcar como saldada la deuda de ${settling.name} por ${formatCurrency(settling.total)}?`
                  : `¿Marcar como saldadas las ${settling.debts.length} deudas de ${settling.name} por ${formatCurrency(settling.total)}?`}
              </h4>
            </div>
            <p className={`text-[11px] font-semibold ${isLight ? "text-zinc-600" : "text-zinc-300"}`}>
              ¿Querés registrar también el movimiento en tu saldo disponible?
            </p>
            <div className="flex flex-col gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleConfirmSettle(true)}
                className={`w-full py-2 rounded-xl font-extrabold text-xs transition-colors cursor-pointer ${
                  isLight ? "bg-black text-white hover:bg-zinc-800" : "bg-white text-black hover:bg-zinc-200"
                }`}
              >
                Sí, saldar y registrar en mi saldo
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSettle(false)}
                className={`w-full py-2 rounded-xl font-extrabold text-xs border transition-colors cursor-pointer ${
                  isLight ? "bg-zinc-100 border-zinc-300 text-black" : "bg-zinc-900 border-zinc-800 text-white"
                }`}
              >
                Solo saldar (sin mover saldo)
              </button>
              <button
                type="button"
                onClick={() => setSettling(null)}
                className="py-1 text-xs font-bold opacity-75 hover:opacity-100 text-center cursor-pointer"
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
