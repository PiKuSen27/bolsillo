import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * Fila horizontal de chips que se puede recorrer con la rueda del mouse o arrastrando,
 * con un degradado en el borde que avisa que hay más contenido.
 */
export function HScroll({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startLeft: number; moved: boolean } | null>(null);
  const [fade, setFade] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setFade({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update, children]);

  return (
    <div className={`relative min-w-0 ${className}`}>
      <div
        ref={ref}
        onScroll={update}
        onWheel={(e) => {
          const el = ref.current;
          if (!el || el.scrollWidth <= el.clientWidth) return;
          el.scrollLeft += e.deltaY + e.deltaX;
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" || e.button !== 0 || !ref.current) return;
          drag.current = { startX: e.clientX, startLeft: ref.current.scrollLeft, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || !ref.current) return;
          const dx = e.clientX - d.startX;
          if (Math.abs(dx) > 4) d.moved = true;
          if (d.moved) ref.current.scrollLeft = d.startLeft - dx;
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerLeave={() => {
          drag.current = null;
        }}
        onClickCapture={(e) => {
          // Si fue un arrastre, que no cuente como clic en un chip
          if (drag.current?.moved) e.stopPropagation();
        }}
        className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none cursor-grab active:cursor-grabbing"
      >
        {children}
      </div>
      {fade.left && (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[var(--hscroll-bg)] to-transparent" />
      )}
      {fade.right && (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[var(--hscroll-bg)] to-transparent" />
      )}
    </div>
  );
}
