import { historicalContext, casualties } from "@/lib/mock-data";
import { formatNumber } from "@/lib/utils";

function PercentileBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs text-ink-muted">{label}</span>
        <span className="tnum text-sm font-medium text-ink">
          {pct}
          <span className="text-ink-faint">th pct</span>
        </span>
      </div>
      <div className="relative h-6 w-full rounded-md bg-surface-2">
        {/* interquartile band */}
        <div
          className="absolute inset-y-0 rounded-md bg-line-soft/60"
          style={{ left: "25%", width: "50%" }}
          aria-hidden
        />
        {/* median marker */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-ink-faint/60" aria-hidden />
        {/* this war */}
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-base bg-accent"
          style={{ left: `${pct}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

export function HistoricalContext() {
  return (
    <div className="flex flex-col gap-5">
      <PercentileBar label="Cumulative casualties (vs same day)" pct={historicalContext.percentileCasualties} />
      <PercentileBar label="Casualty tempo (vs same day)" pct={historicalContext.percentileTempo} />

      <div className="grid grid-cols-2 gap-3 border-t border-line-soft pt-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-ink-faint">
            Median day-18 casualties
          </div>
          <div className="tnum mt-0.5 text-lg font-medium text-ink">
            {formatNumber(historicalContext.medianDayCasualties)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-ink-faint">
            This war, last 24h
          </div>
          <div className="tnum mt-0.5 text-lg font-medium text-ink">
            {formatNumber(casualties.last24h)}
          </div>
        </div>
      </div>

      <p className="text-pretty text-xs leading-relaxed text-ink-muted">
        {historicalContext.note} Compared against {historicalContext.sampleWars}{" "}
        archived wars at the same elapsed day. Band shows the interquartile
        range; the marker is War 122.
      </p>
    </div>
  );
}
