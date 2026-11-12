import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, fieldButtonClass } from "./Popover";

export interface SelectOption {
  value: string;
  label: string;
  color?: string; // puntito de color (categorías)
}

/** Desplegable propio con el estilo del tema (reemplaza al <select> nativo). */
export function Select({
  value,
  options,
  onChange,
  isLight,
  ariaLabel,
  className,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  isLight?: boolean;
  ariaLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

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
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={fieldButtonClass(isLight)}
        >
          <span className="flex items-center gap-1.5 truncate">
            {current?.color && (
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: current.color }} />
            )}
            {current?.label ?? "Elegir…"}
          </span>
          <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      }
    >
      <ul role="listbox" className="min-w-[180px] max-h-56 overflow-y-auto py-1">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-bold text-left cursor-pointer ${
                  isLight ? "hover:bg-zinc-100" : "hover:bg-zinc-800"
                } ${selected ? "font-black" : ""}`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {o.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: o.color }} />}
                  {o.label}
                </span>
                {selected && <Check size={12} className={isLight ? "text-[#16A34A]" : "text-[#22C55E]"} />}
              </button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}
