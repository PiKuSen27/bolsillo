import { AlertCircle, ChevronRight } from "lucide-react";
import { formatMissingDaysBanner } from "../lib/reminders";

interface BannerMissingDaysProps {
  missingDays: string[];
  onSelectMissingDay: (dateStr: string) => void;
  isLight?: boolean;
}

export function BannerMissingDays({
  missingDays,
  onSelectMissingDay,
  isLight,
}: BannerMissingDaysProps) {
  if (missingDays.length === 0) return null;

  const text = formatMissingDaysBanner(missingDays);
  const firstMissing = missingDays[0];

  return (
    <div
      onClick={() => onSelectMissingDay(firstMissing)}
      className={`w-full mb-1.5 px-3 py-1.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none font-extrabold ${
        isLight
          ? "bg-red-50 hover:bg-red-100 border-red-300 text-red-700"
          : "bg-red-950/40 hover:bg-red-900/50 border-red-800 text-red-400"
      }`}
    >
      <div className="flex items-center gap-1.5 truncate">
        <AlertCircle size={13} className="shrink-0" />
        <span className="text-[10px] truncate">{text}</span>
      </div>

      <div className="flex items-center gap-0.5 text-[10px] shrink-0 ml-1">
        <span>Anotar</span>
        <ChevronRight size={12} />
      </div>
    </div>
  );
}
