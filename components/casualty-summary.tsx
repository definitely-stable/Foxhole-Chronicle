import { casualties } from "@/lib/mock-data";
import { Panel } from "@/components/ui";
import { formatNumber, formatCompact, formatSigned } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

function Delta({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className={
        up
          ? "inline-flex items-center gap-0.5 text-xs text-danger"
          : "inline-flex items-center gap-0.5 text-xs text-positive"
      }
    >
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {formatSigned(value)}
    </span>
  );
}

function FactionSplitBar() {
  const total = casualties.colonial + casualties.warden;
  const colPct = (casualties.colonial / total) * 100;
  const warPct = 100 - colPct;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-ink-muted">
          <span className="size-2 rounded-sm bg-colonial" aria-hidden /> Colonial
          <span className="tnum ml-1 text-ink">{colPct.toFixed(1)}%</span>
        </span>
        <span className="flex items-center gap-1.5 text-ink-muted">
          <span className="tnum text-ink">{warPct.toFixed(1)}%</span>
          Warden <span className="size-2 rounded-sm bg-warden" aria-hidden />
        </span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div className="bg-colonial" style={{ width: `${colPct}%` }} aria-hidden />
        <div className="bg-warden" style={{ width: `${warPct}%` }} aria-hidden />
      </div>
      <div className="mt-2 flex justify-between">
        <span className="tnum text-xs text-ink-faint">
          {formatNumber(casualties.colonial)}
        </span>
        <span className="tnum text-xs text-ink-faint">
          {formatNumber(casualties.warden)}
        </span>
      </div>
    </div>
  );
}

export function CasualtySummary() {
  const deltaVs = casualties.last24h - casualties.prev24h;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Panel className="p-4 lg:col-span-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          Total casualties
        </div>
        <div className="tnum mt-1 text-3xl font-semibold text-ink">
          {formatNumber(casualties.total)}
        </div>
        <div className="mt-4">
          <FactionSplitBar />
        </div>
      </Panel>

      <Panel className="p-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          Last 24h
        </div>
        <div className="tnum mt-1 text-3xl font-semibold text-ink">
          {formatCompact(casualties.last24h)}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Delta value={deltaVs} />
          <span className="text-xs text-ink-faint">vs prior 24h</span>
        </div>
      </Panel>

      <Panel className="p-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          Casualty rate
        </div>
        <div className="tnum mt-1 text-3xl font-semibold text-ink">
          {formatNumber(casualties.ratePerHour)}
          <span className="ml-1 text-sm font-normal text-ink-faint">/hr</span>
        </div>
        <div className="mt-2 text-xs text-ink-faint">Rolling 24h mean</div>
      </Panel>
    </div>
  );
}
