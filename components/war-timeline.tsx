"use client";

import { Area, AreaChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { timeline, objectiveChanges, phases, focusPoint, TOTAL_DAYS } from "@/lib/mock-data";

const COL = "oklch(0.66 0.11 155)"; // colonial green
const WAR = "oklch(0.64 0.11 245)"; // warden blue
const LINE = "oklch(0.96 0.004 260)"; // casualty white line
const MEDIAN = "oklch(0.62 0.006 260)";
const BAND = "oklch(0.72 0.008 260 / 0.16)";
const GRID = "oklch(0.30 0.008 260 / 0.5)";

// Domain covers day 1..23 with half-day padding so each day is an equal column.
const DOMAIN: [number, number] = [0.5, TOTAL_DAYS + 0.5];
const PLOT_PAD = { paddingLeft: 44, paddingRight: 8 };

const data = timeline.map((b) => ({ ...b, band: b.p90 - b.p10 }));

function pct(t: number) {
  return ((t - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0])) * 100;
}

function phaseForDay(day: number) {
  return phases.find((p) => day >= p.dayStart && (p.dayEnd === null || day <= p.dayEnd))?.label ?? "";
}

function TimelineTooltip({ active, payload }: { active?: boolean; payload?: { payload: (typeof data)[number] }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const hh = Math.round((d.t % 1) * 24)
    .toString()
    .padStart(2, "0");
  const rows: [string, string][] = [
    ["Casualties", d.casualties.toLocaleString()],
    ["Historical median", d.median.toLocaleString()],
    ["Active regions", String(d.colonialRegions + d.wardenRegions)],
    ["Phase", phaseForDay(d.day)],
  ];
  return (
    <div className="rounded-md border border-line bg-surface-2/95 px-3 py-2.5 text-xs shadow-xl backdrop-blur-sm">
      <div className="mb-1.5 font-semibold tracking-wide text-ink tnum">
        Day {d.day} · {hh}:00
      </div>
      <dl className="flex flex-col gap-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-6">
            <dt className="text-ink-faint">{k}</dt>
            <dd className="font-medium text-ink tnum">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function LegendItem({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-ink-muted">
      {swatch}
      {children}
    </span>
  );
}

function Row({ label, sub, height, children }: { label: string; sub?: string; height: number; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-stretch">
      <div className="flex flex-col justify-center pr-3 text-right">
        <span className="text-[11px] font-medium leading-tight text-ink-muted">{label}</span>
        {sub ? <span className="text-[10px] leading-tight text-ink-faint">{sub}</span> : null}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

export function WarTimeline() {
  return (
    <div>
      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line-soft pb-4">
        <LegendItem swatch={<span className="h-[2px] w-5 bg-ink" aria-hidden />}>Casualties (6h)</LegendItem>
        <LegendItem
          swatch={
            <span className="w-5" aria-hidden style={{ borderTop: `2px dashed ${MEDIAN}` }} />
          }
        >
          Historical median
        </LegendItem>
        <LegendItem swatch={<span className="h-3 w-5 rounded-sm bg-ink-faint/25" aria-hidden />}>
          Historical range (10th–90th)
        </LegendItem>
        <LegendItem swatch={<span className="size-2 rounded-full bg-colonial" aria-hidden />}>Objective changes</LegendItem>
        <LegendItem swatch={<span className="size-2 rounded-sm bg-warden" aria-hidden />}>Territorial state</LegendItem>
        <LegendItem swatch={<span className="h-3 w-4 bg-ink-faint/40" aria-hidden />}>Regional activity</LegendItem>
        <span className="ml-auto inline-flex items-center gap-2 rounded-md border border-line-soft bg-surface-2 px-3 py-1.5 text-[11px] text-ink-muted">
          Wars 110–128 (historical reference)
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      {/* Phase header, aligned to the plot area */}
      <div className="grid grid-cols-[120px_1fr]">
        <div />
        <div className="flex" style={PLOT_PAD}>
          {phases.map((p) => {
            const span = (p.dayEnd ?? TOTAL_DAYS) - p.dayStart + 1;
            return (
              <div key={p.key} className="border-l border-line-soft pl-3" style={{ flexGrow: span, flexBasis: 0 }}>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink">{p.label}</div>
                <div className="text-[10px] text-ink-faint tnum">
                  Days {p.dayStart}
                  {p.dayEnd ? `–${p.dayEnd}` : "+"}
                </div>
                <div className="mt-0.5 max-w-[15ch] text-[10px] leading-tight text-ink-faint">{p.caption}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Casualties: white line over historical band + median */}
      <Row label="Casualties" sub="(per 6 hours)" height={200}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="t" type="number" domain={DOMAIN} hide />
            <YAxis
              width={44}
              domain={[0, 42000]}
              ticks={[0, 10000, 20000, 30000, 40000]}
              tickFormatter={(v: number) => (v === 0 ? "0" : `${v / 1000}K`)}
              tick={{ fill: "oklch(0.56 0.006 260)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Area dataKey="p10" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
            <Area dataKey="band" stackId="band" stroke="none" fill={BAND} isAnimationActive={false} />
            <Line dataKey="median" stroke={MEDIAN} strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line dataKey="casualties" stroke={LINE} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Tooltip content={<TimelineTooltip />} cursor={{ stroke: "oklch(0.8 0.006 260 / 0.5)", strokeWidth: 1 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Row>

      {/* Objective-change dot row */}
      <Row label="Objective changes" height={26}>
        <div className="relative h-full" style={PLOT_PAD}>
          <div className="relative h-full">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-soft" />
            {objectiveChanges.map((o, i) => (
              <span
                key={i}
                className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-base"
                style={{ left: `${pct(o.t)}%`, backgroundColor: o.faction === "colonial" ? COL : WAR }}
                aria-hidden
              />
            ))}
          </div>
        </div>
      </Row>

      {/* Territorial state: stacked controlled regions */}
      <Row label="Territorial state" sub="(controlled regions)" height={96}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="t" type="number" domain={DOMAIN} hide />
            <YAxis
              width={44}
              domain={[0, 60]}
              ticks={[0, 30, 60]}
              tick={{ fill: "oklch(0.56 0.006 260)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Area dataKey="colonialRegions" stackId="terr" stroke={COL} strokeWidth={1} fill={COL} fillOpacity={0.55} isAnimationActive={false} />
            <Area dataKey="wardenRegions" stackId="terr" stroke={WAR} strokeWidth={1} fill={WAR} fillOpacity={0.55} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Row>

      {/* Objective-change ticks */}
      <Row label="Objective changes" height={36}>
        <div className="relative h-full" style={PLOT_PAD}>
          <div className="relative h-full">
            {objectiveChanges.map((o, i) => (
              <span
                key={i}
                className="absolute bottom-1 top-1 w-[3px] -translate-x-1/2 rounded-sm"
                style={{ left: `${pct(o.t)}%`, backgroundColor: o.faction === "colonial" ? COL : WAR }}
                aria-hidden
              />
            ))}
          </div>
        </div>
      </Row>

      {/* Regional activity bars */}
      <Row label="Regional activity" sub="(relative)" height={48}>
        <div className="relative h-full" style={PLOT_PAD}>
          <div className="relative h-full">
            {data.map((b, i) => (
              <span
                key={i}
                className="absolute bottom-0 w-[3px] -translate-x-1/2 rounded-t-sm bg-ink-faint/45"
                style={{ left: `${pct(b.t)}%`, height: `${b.regionalActivity * 100}%` }}
                aria-hidden
              />
            ))}
          </div>
        </div>
      </Row>

      {/* Shared day axis */}
      <div className="grid grid-cols-[120px_1fr]">
        <div />
        <div className="relative mt-1 h-4" style={PLOT_PAD}>
          <div className="relative h-full">
            {Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1).map((day) => (
              <span
                key={day}
                className="absolute top-0 -translate-x-1/2 text-[9px] text-ink-faint tnum"
                style={{ left: `${pct(day)}%` }}
              >
                Day {day}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-ink-faint">
        Focus reference · Day {focusPoint.day} {focusPoint.clock}: {focusPoint.casualties.toLocaleString()} casualties,{" "}
        {focusPoint.observedChanges} observed changes, {focusPoint.activeRegions} active regions ({focusPoint.phase}). Hover the
        casualty series to inspect any 6-hour bucket.
      </p>
    </div>
  );
}
