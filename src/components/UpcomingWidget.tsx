import { UpcomingItem } from "../types";
import { formatCurrency, formatRelativeDue } from "../lib/format";

interface UpcomingWidgetProps {
  items: UpcomingItem[];
  onOpenFixedAndInstallments: () => void;
}

export function UpcomingWidget({
  items,
  onOpenFixedAndInstallments,
}: UpcomingWidgetProps) {
  // Show first 4 items in the widget
  const displayItems = items.slice(0, 4);

  return (
    <div className="w-28 h-full rounded-[20px] bg-white/[0.04] border border-white/5 p-2 flex flex-col justify-between overflow-hidden select-none">
      <div className="flex items-center justify-between pb-1 border-b border-white/5">
        <span className="text-[10px] font-bold tracking-wider text-white/50 uppercase">
          Próximos
        </span>
      </div>

      {/* List */}
      <div className="flex-1 flex flex-col gap-1.5 py-1.5 overflow-y-auto scrollbar-none">
        {displayItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[10px] text-white/30 px-1">
            Sin pagos pendientes
          </div>
        ) : (
          displayItems.map((item) => {
            const isDueSoon = item.daysUntil <= 3 && item.daysUntil > 0;
            const isDueTodayOrOverdue = item.daysUntil <= 0;

            const badgeColor = isDueTodayOrOverdue
              ? "text-[#FF6B6B]"
              : isDueSoon
              ? "text-[#FFC857]"
              : "text-white/40";

            return (
              <div
                key={item.id}
                className="flex flex-col rounded-lg bg-white/[0.03] p-1.5 border border-white/5"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-bold text-white truncate max-w-[55px]"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                  <span className="text-[10px] font-bold text-white/90 tabular-numbers">
                    {formatCurrency(item.amount)}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-0.5 text-[9px]">
                  <span className={`font-semibold ${badgeColor}`}>
                    {formatRelativeDue(item.daysUntil)}
                  </span>

                  {item.progressText && (
                    <span className="text-white/30 text-[8px]">
                      {item.progressText}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* "Ver todo" footer button */}
      <button
        type="button"
        onClick={onOpenFixedAndInstallments}
        className="w-full py-1 text-center text-[10px] font-bold text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
      >
        Ver todo
      </button>
    </div>
  );
}
