"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import { dailyCasualties, phases } from "@/lib/mock-data";
import { formatCompact, formatNumber } from "@/lib/utils";

const COLONIAL = "oklch(0.66 0.11 155)";
const WARDEN = "oklch(0.65 0.11 245)";

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const col = payload.find((p: any) => p.dataKey === "colonial")?.value ?? 0;
  const war = payload.find((p: any) => p.dataKey === "warden")?.value ?? 0;
  return (
    <div className="rounded-lg border border-line bg-surface-2/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-1.5 font-medium text-ink">Elapsed day {label}</div>
      <div className="flex items-center justify-between gap-6">
        <span className="flex items-center gap-1.5 text-ink-muted">
          <span className="size-2 rounded-sm bg-colonial" /> Colonial
        </span>
        <span className="tnum text-ink">{formatNumber(col)}</span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="flex items-center gap-1.5 text-ink-muted">
          <span className="size-2 rounded-sm bg-warden" /> Warden
        </span>
        <span className="tnum text-ink">{formatNumber(war)}</span>
      </div>
    </div>
  );
}

export function CasualtyTimeline() {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={dailyCasualties}
          margin={{ top: 8, right: 8, bottom: 4, left: 4 }}
        >
          <defs>
            <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLONIAL} stopOpacity={0.35} />
              <stop offset="100%" stopColor={COLONIAL} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="warGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={WARDEN} stopOpacity={0.35} />
              <stop offset="100%" stopColor={WARDEN} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {phases
            .filter((p) => p.faction && p.faction !== "neutral")
            .map((p) => (
              <ReferenceArea
                key={p.key}
                x1={p.dayStart}
                x2={p.dayEnd ?? dailyCasualties[dailyCasualties.length - 1].day}
                fill={p.faction === "warden" ? WARDEN : COLONIAL}
                fillOpacity={0.05}
                strokeOpacity={0}
              />
            ))}

          <CartesianGrid
            strokeDasharray="2 4"
            stroke="oklch(0.30 0.008 260)"
            vertical={false}
          />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "oklch(0.56 0.006 260)", fontSize: 11 }}
            tickFormatter={(d) => `D${d}`}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={38}
            tick={{ fill: "oklch(0.56 0.006 260)", fontSize: 11 }}
            tickFormatter={(v) => formatCompact(v)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "oklch(0.40 0.008 260)" }} />
          <Area
            type="monotone"
            dataKey="colonial"
            stroke={COLONIAL}
            strokeWidth={2}
            fill="url(#colGrad)"
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Area
            type="monotone"
            dataKey="warden"
            stroke={WARDEN}
            strokeWidth={2}
            fill="url(#warGrad)"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
