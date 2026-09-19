import { war, currentPhase } from "@/lib/mock-data";
import { Chip, FactionDot } from "@/components/ui";

export function WarHeadline() {
  const days = Math.floor(war.elapsedHours / 24);
  const hours = war.elapsedHours % 24;

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line-soft bg-surface">
      <div className="observatory-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex flex-col gap-5 p-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Chip className="border-positive/30 text-positive">
              <span className="live-dot size-1.5 rounded-full bg-positive" aria-hidden />
              Active war
            </Chip>
            <Chip>Ruleset epoch {war.rulesetEpoch}</Chip>
            <Chip>
              <FactionDot faction={currentPhase.faction} />
              {currentPhase.label} · since {currentPhase.since}
            </Chip>
          </div>

          <h1 className="text-pretty text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            War 122 Overview
          </h1>
          <p className="mt-2 max-w-xl text-pretty text-sm text-ink-muted">
            What is happening in the current World Conquest, and how unusual is
            it? A deterministic read of the war so far — no predictions, no
            hidden intelligence.
          </p>
        </div>

        <div className="flex items-end gap-8">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
              Elapsed war day
            </div>
            <div className="tnum mt-1 text-5xl font-semibold leading-none text-ink">
              {war.elapsedDay}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
              Duration
            </div>
            <div className="tnum mt-1 text-2xl font-medium leading-none text-ink-muted">
              {days}d {hours}h
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
