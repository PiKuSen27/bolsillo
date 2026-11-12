import React, { useEffect, useRef } from "react";

/**
 * Base de los desplegables propios (Select y DateField): un botón y, debajo, un panel
 * con el estilo del tema. Se cierra con Escape o tocando afuera. Nada nativo del sistema.
 */
export function Popover({
  open,
  onClose,
  isLight,
  button,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  isLight?: boolean;
  button: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    // capture: que el Escape cierre el desplegable antes de que lo vea el Sheet
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {button}
      {open && (
        <div
          role="dialog"
          className={`absolute left-0 top-full mt-1 z-50 rounded-xl border shadow-2xl overflow-hidden ${
            isLight ? "bg-white border-zinc-300 text-black" : "bg-[#141416] border-[#2A2A2E] text-white"
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** Estilo común del botón que abre un desplegable (igual a los inputs de la app). */
export function fieldButtonClass(isLight?: boolean) {
  return `w-full flex items-center justify-between gap-2 text-xs font-bold px-2.5 py-1.5 rounded-xl border cursor-pointer text-left ${
    isLight ? "bg-zinc-100 border-zinc-300 text-black" : "bg-zinc-900 border-zinc-700 text-white"
  }`;
}
