import { phases, war, currentPhase } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function PhaseStrip() {
  const totalDays = war.elapsedDay;

  return (
    <div>
      <div className="flex h-9 w-full overflow-hidden rounded-md border border-line-soft">
        {phases.map((p) => {
          const end = p.dayEnd ?? totalDays;
          const span = end - p.dayStart + 1;
          const pct = (span / totalDays) * 100;
          return (
            <div
              key={p.key}
              className={cn(
                "relative flex items-center justify-center border-r border-base/40 last:border-r-0",
                p.faction === "warden" && "bg-warden-soft",
                p.faction === "colonial" && "bg-colonial-soft",
                (!p.faction || p.faction === "neutral") && "bg-surface-2"
              )}
              style={{ width: `${pct}%` }}
              title={`${p.label} · Day ${p.dayStart}–${p.dayEnd ?? "now"}`}
            >
              <span className="truncate px-2 text-[11px] font-medium text-ink-muted">
                {p.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink-faint">
        <span>Day 1</span>
        <span className="tnum">Day {totalDays} · now</span>
      </div>
      <p className="mt-3 text-pretty text-xs leading-relaxed text-ink-muted">
        <span className="font-medium text-ink">Current: {currentPhase.label}.</span>{" "}
        {currentPhase.basis} Classification is deterministic and evidence-backed
        &mdash; not a causal &ldquo;turning point&rdquo; claim.
      </p>
    </div>
  );
}
