import { regions } from "@/lib/mock-data";
import { FactionDot } from "@/components/ui";
import { cn, formatCompact, formatSigned } from "@/lib/utils";

export function RegionalActivity() {
  const maxActivity = Math.max(...regions.map((r) => r.activity));

  return (
    <div className="flex flex-col divide-y divide-line-soft">
      {regions.map((r) => (
        <div key={r.name} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.5">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              <FactionDot faction={r.control} />
              <span className="truncate text-sm text-ink">{r.name}</span>
              {r.net24h !== 0 && (
                <span
                  className={cn(
                    "tnum text-[11px]",
                    r.net24h > 0 ? "text-warden" : "text-colonial"
                  )}
                >
                  {formatSigned(r.net24h)} obj
                </span>
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn(
                  "h-full rounded-full",
                  r.control === "warden" ? "bg-warden" : "bg-colonial"
                )}
                style={{ width: `${(r.activity / maxActivity) * 100}%` }}
                aria-hidden
              />
            </div>
          </div>
          <div className="text-right">
            <div className="tnum text-sm text-ink">{formatCompact(r.casualties24h)}</div>
            <div className="text-[10px] uppercase tracking-wide text-ink-faint">24h cas.</div>
          </div>
        </div>
      ))}
    </div>
  );
}
