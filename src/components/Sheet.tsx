import React, { useEffect } from "react";
import { motion, AnimatePresence, useDragControls } from "motion/react";
import { X } from "lucide-react";

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  isLight?: boolean;
  children: React.ReactNode;
}

export function Sheet({
  isOpen,
  onClose,
  title,
  subtitle,
  isLight,
  children,
}: SheetProps) {
  // Arrastrar desde el asa o el título hacia abajo cierra el panel (celular)
  const drag = useDragControls();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div role="dialog" aria-modal="true" className="absolute inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60"
          />

          {/* Sheet Body */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.8 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) onClose();
            }}
            className={`relative w-full h-[93%] rounded-t-[20px] border-t shadow-2xl flex flex-col overflow-hidden select-none ${
              isLight
                ? "bg-[#FFFFFF] border-[#E4E4E7] text-black"
                : "bg-[#050506] border-[#262626] text-white"
            }`}
          >
            {/* Asa superior, estilo hoja de iOS */}
            <div
              className="w-full flex justify-center pt-2 shrink-0 touch-none cursor-grab active:cursor-grabbing"
              aria-hidden="true"
              onPointerDown={(e) => drag.start(e)}
            >
              <div className={`w-9 h-1 rounded-full ${isLight ? "bg-zinc-300" : "bg-zinc-700"}`} />
            </div>

            {/* Header */}
            <div
              onPointerDown={(e) => drag.start(e)}
              className={`px-4 py-2.5 flex items-center justify-between border-b shrink-0 touch-none ${
                isLight ? "border-zinc-200" : "border-[#1F1F22]"
              }`}
            >
              <div>
                <h3 className="text-sm font-extrabold tracking-tight">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-[11px] font-semibold opacity-75">
                    {subtitle}
                  </p>
                )}
              </div>

              <button
                type="button"
                aria-label="Cerrar"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onClose}
                className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                  isLight
                    ? "hover:bg-zinc-100 text-zinc-600"
                    : "hover:bg-zinc-800 text-zinc-400"
                }`}
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div
              className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+var(--safe-bottom))] scrollbar-thin"
              onFocus={(e) => {
                // Celular: cuando aparece el teclado, que el campo no quede tapado
                const el = e.target as HTMLElement;
                if (el.matches("input, textarea")) setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
              }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
