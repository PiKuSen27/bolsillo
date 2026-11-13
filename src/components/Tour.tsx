import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface TourStep {
  target: string; // valor de data-tour del elemento a señalar
  title: string;
  text: string;
}

/** Recorrido corto: ilumina cada parte de la pantalla y explica para qué sirve. */
export function Tour({ steps, isLight, onClose }: { steps: TourStep[]; isLight?: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];

  useLayoutEffect(() => {
    const measure = () => {
      const el = [...document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`)].find((e) => e.offsetParent !== null);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step.target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const last = i === steps.length - 1;
  const pad = 6;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(320, vw - 24);
  // La tarjeta va debajo de lo señalado si entra; si no, arriba; si no hay nada que señalar, al centro
  const below = rect ? rect.bottom + pad + 12 : 0;
  const cardTop = !rect ? vh / 2 - 80 : below + 170 < vh ? below : Math.max(12, rect.top - pad - 12 - 170);
  const cardLeft = !rect ? (vw - cardW) / 2 : Math.min(Math.max(12, rect.left + rect.width / 2 - cardW / 2), vw - cardW - 12);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="tour-title" className="fixed inset-0 z-[90]">
      {rect ? (
        <div
          aria-hidden="true"
          className="absolute rounded-2xl transition-all duration-200 ring-2 ring-white/80"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
          }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-black/60" />
      )}
      <div
        className={`absolute rounded-2xl border p-4 flex flex-col gap-2 shadow-2xl ${
          isLight ? "bg-white border-zinc-300 text-black" : "bg-[#0A0A0C] border-[#262626] text-white"
        }`}
        style={{ top: cardTop, left: cardLeft, width: cardW }}
      >
        <span className={`text-[10px] font-extrabold ${isLight ? "text-zinc-500" : "text-zinc-400"}`}>
          {i + 1} de {steps.length}
        </span>
        <h4 id="tour-title" className="text-sm font-extrabold">
          {step.title}
        </h4>
        <p className={`text-xs font-semibold leading-relaxed ${isLight ? "text-zinc-700" : "text-zinc-300"}`}>{step.text}</p>
        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={onClose} className="text-xs font-bold opacity-75 hover:opacity-100 cursor-pointer">
            Saltar
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => (last ? onClose() : setI(i + 1))}
            className={`px-4 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${
              isLight ? "bg-black text-white hover:bg-zinc-800" : "bg-white text-black hover:bg-zinc-200"
            }`}
          >
            {last ? "Listo" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
