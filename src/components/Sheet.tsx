import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
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
        <div className="absolute inset-0 z-50 flex flex-col justify-end">
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
            transition={{ type: "spring", damping: 28, stiffness: 350 }}
            className={`relative w-full h-[93%] rounded-t-[20px] border-t shadow-2xl flex flex-col overflow-hidden select-none ${
              isLight
                ? "bg-[#FFFFFF] border-[#E4E4E7] text-black"
                : "bg-[#050506] border-[#262626] text-white"
            }`}
          >
            {/* Header */}
            <div
              className={`px-4 py-3 flex items-center justify-between border-b shrink-0 ${
                isLight ? "border-zinc-200" : "border-[#1F1F22]"
              }`}
            >
              <div>
                <h3 className="text-sm font-extrabold tracking-tight">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-[11px] font-semibold opacity-60">
                    {subtitle}
                  </p>
                )}
              </div>

              <button
                type="button"
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
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
