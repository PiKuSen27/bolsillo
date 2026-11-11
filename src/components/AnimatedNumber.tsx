import { useEffect, useState } from "react";
import { formatCurrency } from "../lib/format";

interface AnimatedNumberProps {
  value: number;
  duration?: number; // ms
  className?: string;
}

export function AnimatedNumber({ value, duration = 400, className = "" }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = displayValue;
    const difference = value - startValue;

    if (difference === 0) return;
    // "Reducir movimiento" del sistema: mostrar el valor final sin contar
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(value);
      return;
    }

    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + difference * easeProgress);

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  return (
    <span className={`tabular-numbers ${className}`}>
      {formatCurrency(displayValue)}
    </span>
  );
}
