import { recentDays } from "@/lib/mock-data";

function MiniBars({ points }: { points: number[] }) {
  const max = Math.max(...points);
  return (
    <div className="flex h-5 items-end gap-[3px]" aria-hidden>
      {points.map((p, i) => (
        <span
          key={i}
          className="w-[3px] rounded-t-sm bg-ink-faint/50"
          style={{ height: `${Math.max(12, (p / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function Metric({ dot, value, label }: { dot: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`size-2 shrink-0 rounded-sm ${dot}`} aria-hidden />
      <span className="text-sm font-semibold text-ink tnum">{value}</span>
      <span className="text-[11px] text-ink-faint">{label}</span>
    </div>
  );
}

export function RecentWarDays() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {recentDays.map((d) => (
        <div key={d.day} className="rounded-md border border-line-soft bg-surface-2/60 p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted tnum">
            Day {d.day}
          </div>
          <div className="flex flex-col gap-2">
            <Metric dot="bg-ink-faint" value={d.casualties.toLocaleString()} label="Casualties" />
            <Metric dot="bg-colonial" value={String(d.objectiveChanges)} label="Objective changes" />
            <Metric dot="bg-warden" value={String(d.activeRegions)} label="Active regions" />
          </div>
          <div className="mt-4 flex items-end justify-between gap-2">
            <span className="text-[10px] text-ink-faint">Relative activity</span>
            <MiniBars points={d.spark} />
          </div>
        </div>
      ))}
    </div>
  );
}
