import { war } from "@/lib/mock-data";

export function StatusBar() {
  return (
    <div className="border-b border-line-soft bg-surface/60">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          World Conquest {war.number}
        </h2>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-colonial/40 bg-colonial/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-colonial">
          <span className="live-dot size-1.5 rounded-full bg-colonial" aria-hidden />
          {war.status}
        </span>

        <span className="text-sm font-medium uppercase tracking-wider text-ink-muted tnum">
          Day {war.elapsedDay}
        </span>

        <span className="text-xs text-ink-faint">Updated {war.updatedAgo}</span>

        <p className="hidden flex-1 text-center text-sm italic text-ink-muted lg:block">
          {war.headline}
        </p>

        <div className="ml-auto flex flex-col items-end gap-0.5 text-right">
          <a
            href="#"
            className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:text-colonial"
          >
            Live observations →
          </a>
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
            Recorded war history
          </span>
        </div>
      </div>
    </div>
  );
}
