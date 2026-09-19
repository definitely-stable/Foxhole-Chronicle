import { comparison, war } from "@/lib/mock-data";

function RangeBar({
  min,
  max,
  typicalLow,
  typicalHigh,
  marker,
}: {
  min: number;
  max: number;
  typicalLow: number;
  typicalHigh: number;
  marker: number;
}) {
  const span = max - min || 1;
  const toPct = (v: number) => ((v - min) / span) * 100;
  return (
    <div className="relative h-2.5 w-full rounded-full bg-surface-2">
      {/* typical (interquartile) band */}
      <div
        className="absolute inset-y-0 rounded-full bg-line"
        style={{ left: `${toPct(typicalLow)}%`, width: `${toPct(typicalHigh) - toPct(typicalLow)}%` }}
        aria-hidden
      />
      {/* current-value marker */}
      <div
        className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-base bg-ink shadow"
        style={{ left: `${toPct(marker)}%` }}
        aria-hidden
      />
    </div>
  );
}

export function WarUnusualness() {
  return (
    <div>
      <div className="flex flex-col gap-5">
        {comparison.map((row) => (
          <div key={row.label} className="grid grid-cols-1 items-center gap-x-5 gap-y-2 sm:grid-cols-[1fr_auto] lg:grid-cols-[180px_120px_1fr_auto]">
            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">{row.label}</div>
            <div className="text-lg font-semibold text-ink tnum">{row.value}</div>
            <div className="flex flex-col gap-1.5">
              <span
                className={
                  row.deltaTone === "high"
                    ? "text-xs font-medium text-accent"
                    : "text-xs text-ink-faint"
                }
              >
                {row.delta}
              </span>
              <RangeBar {...row} />
            </div>
            <div className="text-right text-[11px] text-ink-faint tnum">{row.rangeLabel}</div>
          </div>
        ))}
      </div>
      <p className="mt-5 border-t border-line-soft pt-4 text-[11px] text-ink-faint">
        Compared with past wars at Day {war.elapsedDay}. Ranges show the 10th–90th percentile of the historical archive; the band marks
        the typical (interquartile) region and the marker is this war&apos;s current value.
      </p>
    </div>
  );
}
