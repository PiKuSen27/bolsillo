import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Delete, MessageSquare } from "lucide-react";
import { DateField } from "./DateField";
import { Category } from "../types";
import { evaluateCalcExpression } from "../lib/calc";
import { shouldCalculatorHandleKey } from "../lib/keyboard";
import { MAX_AMOUNT } from "../lib/constants";
import { formatCurrency, formatExpressionWithDots } from "../lib/format";

interface CalculatorProps {
  categories: Category[];
  selectedDateStr: string;
  onChangeDate: (dateStr: string) => void;
  isLight?: boolean;
  onSaveMovement: (params: {
    amount: number;
    kind: "expense" | "income";
    categoryId: string;
    note?: string;
    date: string;
  }) => void;
}

export function Calculator({
  categories,
  selectedDateStr,
  onChangeDate,
  isLight,
  onSaveMovement,
}: CalculatorProps) {
  // Store raw expression without decorative dots
  const [expression, setExpression] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    categories[0]?.id || "comida"
  );
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState("");
  const noteInputRef = useRef<HTMLInputElement>(null);

  // Evaluate expression preview if valid
  let evaluatedValue: number | null = null;
  let evalError: string | null = null;
  try {
    if (expression.trim()) {
      evaluatedValue = evaluateCalcExpression(expression);
    }
  } catch (err) {
    evaluatedValue = null;
    const msg = err instanceof Error ? err.message : "";
    if (msg === "Monto demasiado grande") {
      evalError = `Monto demasiado grande (máximo ${formatCurrency(MAX_AMOUNT)})`;
    } else if (msg === "División por cero") {
      evalError = "No se puede dividir por cero";
    }
  }

  const handleInputChar = useCallback((char: string) => {
    setExpression((prev) => {
      // Prevent consecutive duplicate operators
      const lastChar = prev.slice(-1);
      if ("+-×÷/*".includes(char) && "+-×÷/*".includes(lastChar)) {
        return prev.slice(0, -1) + char;
      }
      // Prevent numbers with more than 12 digits in the current number segment
      if (char >= "0" && char <= "9") {
        const lastNumSegment = prev.split(/[-+×÷/*]/).pop() || "";
        if (lastNumSegment.replace(/\D/g, "").length >= 12) {
          return prev;
        }
      }
      return prev + char;
    });
  }, []);

  const handleBackspace = useCallback(() => {
    setExpression((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setExpression("");
    setNote("");
    setShowNoteInput(false);
  }, []);

  const handleSave = useCallback(
    (kind: "expense" | "income") => {
      let amount = 0;
      try {
        amount = evaluateCalcExpression(expression);
      } catch {
        return;
      }

      if (amount <= 0) return;

      onSaveMovement({
        amount,
        kind,
        categoryId: kind === "income" ? "income" : selectedCategoryId,
        note: note.trim() || undefined,
        date: selectedDateStr,
      });

      // Clear after save
      setExpression("");
      setNote("");
      setShowNoteInput(false);
    },
    [expression, selectedCategoryId, note, selectedDateStr, onSaveMovement]
  );

  // Physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const dialogOpen = !!document.querySelector('[role="dialog"]');
      const activeTag = document.activeElement?.tagName;
      if (!shouldCalculatorHandleKey({ activeTag, dialogOpen })) {
        if (!dialogOpen && e.key === "Escape") {
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleInputChar(e.key);
      } else if (e.key === "+" || e.key === "-") {
        e.preventDefault();
        handleInputChar(e.key);
      } else if (e.key === "*") {
        e.preventDefault();
        handleInputChar("×");
      } else if (e.key === "/") {
        e.preventDefault();
        handleInputChar("÷");
      } else if (e.key === "." || e.key === ",") {
        e.preventDefault();
        handleInputChar(",");
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Escape" || e.key === "Delete") {
        e.preventDefault();
        handleClear();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          handleSave("income");
        } else {
          handleSave("expense");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleInputChar, handleBackspace, handleClear, handleSave]);

  const numpadKeys = [
    { label: "7", val: "7" },
    { label: "8", val: "8" },
    { label: "9", val: "9" },
    { label: "÷", val: "÷", isOp: true },
    { label: "4", val: "4" },
    { label: "5", val: "5" },
    { label: "6", val: "6" },
    { label: "×", val: "×", isOp: true },
    { label: "1", val: "1" },
    { label: "2", val: "2" },
    { label: "3", val: "3" },
    { label: "−", val: "-", isOp: true },
    { label: "0", val: "0" },
    { label: ",", val: "," },
    { label: "⌫", action: handleBackspace, isIcon: true },
    { label: "+", val: "+", isOp: true },
  ];

  // Live formatted expression with thousands dots (e.g. 20000 -> 20.000)
  const displayExpression = formatExpressionWithDots(expression);

  return (
    <div
      className={`flex-1 h-full rounded-2xl p-2 flex flex-col justify-between overflow-hidden select-none border ${
        isLight
          ? "bg-[#F4F4F5] border-[#E4E4E7] text-black"
          : "bg-[#0D0D0E] border-[#262626] text-white"
      }`}
    >
      {/* Display Card */}
      <div
        className={`rounded-xl px-3 py-1.5 flex flex-col justify-center min-h-[50px] border ${
          isLight
            ? "bg-white border-zinc-200 shadow-xs"
            : "bg-[#000000] border-[#202022]"
        }`}
      >
        <div className="flex items-center justify-between text-[11px] font-bold">
          <div className="flex items-center gap-1.5">
            <DateField ariaLabel="Fecha del movimiento" value={selectedDateStr} onChange={onChangeDate} isLight={isLight} compact />

            <button
              type="button"
              onClick={() => {
                setShowNoteInput(!showNoteInput);
                setTimeout(() => noteInputRef.current?.focus(), 50);
              }}
              className={`flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                note
                  ? isLight
                    ? "bg-zinc-800 text-white"
                    : "bg-white text-black"
                  : isLight
                  ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-600"
                  : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400"
              }`}
            >
              <MessageSquare size={11} />
              <span>{note ? "Con nota" : "Nota"}</span>
            </button>
          </div>

          {evaluatedValue !== null && expression.length > 0 && (
            <span
              className={`tabular-numbers font-extrabold text-xs ${
                isLight ? "text-[#16A34A]" : "text-[#22C55E]"
              }`}
            >
              = {formatCurrency(evaluatedValue)}
            </span>
          )}
        </div>

        {/* Note input inline with spring animation */}
        <AnimatePresence>
          {showNoteInput && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="overflow-hidden mt-1"
            >
              <input
                ref={noteInputRef}
                type="text"
                placeholder="Ej. Almuerzo, nafta, súper..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={`w-full text-xs font-semibold px-2 py-1 rounded border focus:outline-none ${
                  isLight
                    ? "bg-zinc-100 border-zinc-300 text-black placeholder:text-zinc-400"
                    : "bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
                }`}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expression string with live thousands dots */}
        <div
          className={`text-right text-xl font-extrabold tracking-tight tabular-numbers overflow-x-auto whitespace-nowrap pt-0.5 ${
            isLight ? "text-black" : "text-white"
          }`}
        >
          {displayExpression}
        </div>

        {evalError && (
          <div
            role="alert"
            className={`text-[10px] font-extrabold text-right pt-0.5 ${
              isLight ? "text-[#DC2626]" : "text-[#EF4444]"
            }`}
          >
            {evalError}
          </div>
        )}
      </div>

      {/* Categories Chips with sliding layoutId indicator */}
      <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
        {categories.map((cat) => {
          const isSelected = cat.id === selectedCategoryId;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(cat.id)}
              className="relative shrink-0 px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer"
              style={{
                color: isSelected
                  ? isLight
                    ? "#000000"
                    : "#FFFFFF"
                  : isLight
                  ? "#71717A"
                  : "#A1A1AA",
              }}
            >
              {isSelected && (
                <motion.div
                  layoutId="activeCategory"
                  className={`absolute inset-0 rounded-full border ${
                    isLight ? "bg-white border-zinc-300 shadow-xs" : "bg-zinc-800 border-zinc-600"
                  }`}
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Numpad Grid with elastic press animation */}
      <div className="grid grid-cols-4 gap-1.5">
        {numpadKeys.map((key, idx) => (
          <motion.button
            key={idx}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 600, damping: 30 }}
            type="button"
            onClick={() => {
              if (key.action) key.action();
              else if (key.val) handleInputChar(key.val);
            }}
            className={`h-9 rounded-xl text-sm font-extrabold flex items-center justify-center transition-colors cursor-pointer border ${
              key.isOp
                ? isLight
                  ? "bg-zinc-200 border-zinc-300 text-zinc-900 hover:bg-zinc-300"
                  : "bg-zinc-900 border-zinc-800 text-amber-400 hover:bg-zinc-800"
                : isLight
                ? "bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-100 shadow-2xs"
                : "bg-zinc-900/70 border-[#222224] text-white hover:bg-zinc-800"
            }`}
          >
            {key.isIcon ? <Delete size={15} /> : key.label}
          </motion.button>
        ))}
      </div>

      {/* Action Buttons: Gasto & Ingreso */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <motion.button
          whileTap={{ scale: 0.94 }}
          type="button"
          onClick={() => handleSave("expense")}
          className={`h-9 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1 shadow-md transition-all cursor-pointer ${
            isLight
              ? "bg-[#DC2626] hover:bg-[#B91C1C] text-white shadow-[#DC2626]/20"
              : "bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-[#EF4444]/20"
          }`}
        >
          <span>− Gasto</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.94 }}
          type="button"
          onClick={() => handleSave("income")}
          className={`h-9 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1 shadow-md transition-all cursor-pointer ${
            isLight
              ? "bg-[#16A34A] hover:bg-[#15803D] text-white shadow-[#16A34A]/20"
              : "bg-[#22C55E] hover:bg-[#16A34A] text-black shadow-[#22C55E]/20"
          }`}
        >
          <span>+ Ingreso</span>
        </motion.button>
      </div>
    </div>
  );
}
