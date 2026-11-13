import { useEffect } from "react";
import { createPortal } from "react-dom";

/** Cuadro de confirmación de la app ("¿Borrar…?"): arriba de todo, con detalle y dos botones. */
export function ConfirmDialog({
  title,
  detail,
  confirmLabel = "Borrar",
  isLight,
  onConfirm,
  onCancel,
}: {
  title: string;
  detail?: string;
  confirmLabel?: string;
  isLight?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // capture: que el Escape cancele acá y no cierre también el panel de atrás
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div onClick={onCancel} className="absolute inset-0 bg-black/70" />
      <div
        className={`relative w-full max-w-xs rounded-2xl border p-4 flex flex-col gap-3 shadow-2xl ${
          isLight ? "bg-white border-zinc-300 text-black" : "bg-[#0A0A0C] border-[#262626] text-white"
        }`}
      >
        <h4 id="confirm-title" className="text-sm font-extrabold">
          {title}
        </h4>
        {detail && (
          <p className={`text-xs font-semibold break-words ${isLight ? "text-zinc-600" : "text-zinc-300"}`}>{detail}</p>
        )}
        <div className="flex flex-col gap-1.5 pt-1">
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className="w-full py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-extrabold text-xs cursor-pointer transition-colors"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className={`w-full py-2 rounded-xl font-extrabold text-xs border cursor-pointer transition-colors ${
              isLight ? "bg-zinc-100 border-zinc-300 text-black hover:bg-zinc-200" : "bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800"
            }`}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
