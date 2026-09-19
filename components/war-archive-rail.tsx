import { archive } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function Sparkline({ points, className }: { points: number[]; className?: string }) {
  const w = 72;
  const h = 22;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((p - min) / span) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function WarArchiveRail() {
  return (
    <aside className="rounded-[var(--radius-card)] border border-line-soft bg-surface p-3">
      <h3 className="px-2 pb-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
        Historical Archive
      </h3>
      <ul className="flex flex-col gap-1">
        {archive.map((w) => (
          <li key={w.number}>
            <button
              type="button"
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                w.active
                  ? "border-colonial/50 bg-colonial/10"
                  : "border-transparent hover:border-line-soft hover:bg-surface-2"
              )}
            >
              <span
                className={cn(
                  "text-sm font-medium tracking-wide tnum",
                  w.active ? "text-ink" : "text-ink-muted"
                )}
              >
                WAR {w.number}
              </span>
              <Sparkline
                points={w.spark}
                className={w.active ? "text-colonial" : "text-ink-faint"}
              />
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
