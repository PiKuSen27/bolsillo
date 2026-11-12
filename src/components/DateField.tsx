import { useState } from "react";
import { addMonths, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, fieldButtonClass } from "./Popover";
import { formatLocalDate, parseLocalDate } from "../lib/format";

const WEEK = ["L", "M", "X", "J", "V", "S", "D"];

/** Selector de fecha propio (reemplaza al <input type="date">, cuyo calendario nativo ignora el tema). */
export function DateField({
  value,
  onChange,
  isLight,
  ariaLabel,
  className,
  compact,
}: {
  value: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
  isLight?: boolean;
  ariaLabel: string;
  className?: string;
  compact?: boolean; // botón chico tipo chip (calculadora)
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseLocalDate(value) : new Date();
  const [month, setMonth] = useState(() => startOfMonth(selected));
  const todayStr = formatLocalDate(new Date());

  const days: Date[] = [];
  let d = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const last = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  while (d.getTime() <= last.getTime()) {
    days.push(d);
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }

  const label = value ? format(selected, compact ? "d MMM" : "d MMM yyyy", { locale: es }) : "Elegir fecha";
  const navBtn = `p-1 rounded-lg cursor-pointer ${isLight ? "hover:bg-zinc-100" : "hover:bg-zinc-800"}`;

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      isLight={isLight}
      className={className}
      button={
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            if (!open && value) setMonth(startOfMonth(parseLocalDate(value)));
            setOpen(!open);
          }}
          className={
            compact
              ? `flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                  isLight ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-700" : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                }`
              : fieldButtonClass(isLight)
          }
        >
          <span className="flex items-center gap-1.5">
            <CalendarIcon size={compact ? 11 : 13} className="shrink-0 opacity-70" />
            <span>{label}</span>
          </span>
        </button>
      }
    >
      <div className="p-2 w-[232px] select-none">
        <div className="flex items-center justify-between mb-1">
          <button type="button" aria-label="Mes anterior" onClick={() => setMonth(addMonths(month, -1))} className={navBtn}>
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-extrabold capitalize">{format(month, "MMMM yyyy", { locale: es })}</span>
          <button type="button" aria-label="Mes siguiente" onClick={() => setMonth(addMonths(month, 1))} className={navBtn}>
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {WEEK.map((w) => (
            <span key={w} className="text-[9px] font-extrabold opacity-70 py-0.5">
              {w}
            </span>
          ))}
          {days.map((day) => {
            const ds = formatLocalDate(day);
            const isSel = ds === value;
            const inMonth = isSameMonth(day, month);
            return (
              <button
                key={ds}
                type="button"
                onClick={() => {
                  onChange(ds);
                  setOpen(false);
                }}
                className={`h-7 rounded-lg text-[11px] font-bold cursor-pointer ${
                  isSel
                    ? isLight
                      ? "bg-black text-white"
                      : "bg-white text-black"
                    : inMonth
                    ? isLight
                      ? "hover:bg-zinc-100"
                      : "hover:bg-zinc-800"
                    : "opacity-30"
                } ${ds === todayStr && !isSel ? (isLight ? "text-[#16A34A]" : "text-[#22C55E]") : ""}`}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    </Popover>
  );
}
