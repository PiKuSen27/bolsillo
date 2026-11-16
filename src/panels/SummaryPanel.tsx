import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Category, Movement, Settings, WorkDay } from "../types";
import { compareSpending, periodAtOffset, summarizePeriod } from "../lib/summary";
import { calculateVariableIncome } from "../lib/workdays";
import { formatCurrency, formatShortDate } from "../lib/format";

/** Resumen del período: gastos por categoría, ingresos y comparación con el período anterior. */
export function SummaryPanel({
  settings,
  movements,
  categories,
  workDays,
  todayStr,
  isLight,
}: {
  settings: Settings;
  movements: Movement[];
  categories: Category[];
  workDays: WorkDay[];
  todayStr: string;
  isLight?: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const build = (off: number) => {
    const r = periodAtOffset(settings, todayStr, off);
    const baseIncome =
      settings.incomeMode === "daily"
        ? calculateVariableIncome({ ...settings, dailyRangeStart: r.startDate, dailyRangeEnd: r.endDate }, workDays)
        : settings.fixedSalary;
    return { range: r, ...summarizePeriod({ movements, categories, startDate: r.startDate, endDate: r.endDate, baseIncome }) };
  };
  const cur = useMemo(() => build(offset), [offset, movements, categories, settings, workDays, todayStr]); // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => build(offset + 1), [offset, movements, categories, settings, workDays, todayStr]); // eslint-disable-line react-hooks/exhaustive-deps
  const cmp = compareSpending(cur.totalExpenses, prev.totalExpenses);

  const card = `p-3.5 rounded-2xl border ${isLight ? "bg-white border-zinc-200" : "bg-[#0A0A0C] border-[#222224]"}`;
  const muted = isLight ? "text-zinc-600" : "text-zinc-400";
  const nav = `p-1.5 rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-default ${isLight ? "hover:bg-zinc-100" : "hover:bg-zinc-800"}`;

  return (
    <div className="flex flex-col gap-3 select-none">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Período anterior" className={nav} disabled={offset >= 24} onClick={() => { setOffset(offset + 1); setOpen(null); }}>
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <div className="text-sm font-extrabold">
            {formatShortDate(cur.range.startDate)} – {formatShortDate(cur.range.endDate)}
          </div>
          <div className={`text-[11px] font-bold ${muted}`}>{offset === 0 ? "Período actual" : offset === 1 ? "Período anterior" : `Hace ${offset} períodos`}</div>
        </div>
        <button type="button" aria-label="Período siguiente" className={nav} disabled={offset === 0} onClick={() => { setOffset(offset - 1); setOpen(null); }}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className={`${card} grid grid-cols-2 gap-2`}>
        <div>
          <div className={`text-[11px] font-extrabold uppercase ${muted}`}>Gastaste</div>
          <div className={`text-xl font-extrabold tabular-numbers ${isLight ? "text-[#DC2626]" : "text-[#EF4444]"}`}>{formatCurrency(cur.totalExpenses)}</div>
        </div>
        <div>
          <div className={`text-[11px] font-extrabold uppercase ${muted}`}>Ingresos</div>
          <div className={`text-xl font-extrabold tabular-numbers ${isLight ? "text-[#16A34A]" : "text-[#22C55E]"}`}>{formatCurrency(cur.totalIncome)}</div>
        </div>
        <p className={`col-span-2 text-[11px] font-bold ${muted}`}>
          {cmp.pct === null
            ? prev.totalExpenses === 0 && cur.totalExpenses === 0
              ? "Sin gastos en este período ni en el anterior."
              : "En el período anterior no hubo gastos para comparar."
            : cmp.pct === 0
            ? `Gastaste lo mismo que en el período anterior (${formatCurrency(prev.totalExpenses)}).`
            : `Gastaste ${Math.abs(cmp.pct)}% ${cmp.pct > 0 ? "más" : "menos"} que en el período anterior (${formatCurrency(prev.totalExpenses)}).`}
        </p>
      </div>

      <div className={`${card} flex flex-col gap-1`}>
        <span className={`text-[11px] font-extrabold uppercase mb-1 ${muted}`}>Gastos por categoría</span>
        {cur.byCategory.length === 0 && <p className={`py-4 text-center text-xs font-bold ${muted}`}>No hay gastos en este período</p>}
        {cur.byCategory.map((c) => {
          const isOpen = open === c.categoryId;
          return (
            <div key={c.categoryId} className="flex flex-col">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : c.categoryId)}
                className={`flex flex-col gap-1 py-1.5 px-1 -mx-1 rounded-lg text-left cursor-pointer ${isLight ? "hover:bg-zinc-50" : "hover:bg-[#111113]"}`}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-extrabold">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0 tabular-numbers">
                    {formatCurrency(c.amount)}
                    <span className={`w-9 text-right ${muted}`}>{c.pct}%</span>
                    <ChevronDown size={13} className={`opacity-60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${isLight ? "bg-zinc-100" : "bg-zinc-800"}`}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, c.pct)}%`, backgroundColor: c.color }} />
                </div>
              </button>
              {isOpen && (
                <ul className={`flex flex-col pb-1.5 pl-4 text-[11px] font-semibold ${muted}`}>
                  {c.movements.map((m) => (
                    <li key={m.id} className="flex justify-between gap-2 py-0.5">
                      <span className="truncate">
                        {formatShortDate(m.date)} · {m.note || c.name}
                      </span>
                      <span className="tabular-numbers shrink-0">{formatCurrency(m.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
