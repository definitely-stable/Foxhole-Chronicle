// Prototype fixtures for the Foxhole Chronicle Overview.
// Shapes mirror the semantic chain in .work/PRODUCT_SCOPE.md:
// source -> observation -> normalized fact -> derived metric.
// All values are illustrative and labeled as such in the UI.

export type Faction = "colonial" | "warden";

export const TOTAL_DAYS = 23;

export const war = {
  number: 129,
  elapsedDay: 23,
  status: "active" as const,
  rulesetEpoch: "1.60",
  updatedAgo: "2m ago",
  headline: "War activity remains above the historical median.",
};

// Deterministic pseudo-random so fixtures are stable across renders.
function wobble(seed: number, ...harmonics: [amp: number, freq: number, phase: number][]) {
  return harmonics.reduce((acc, [amp, freq, phase]) => acc + amp * Math.sin(seed * freq + phase), 0);
}

// Elapsed-war-clock buckets at 6h resolution across the whole war.
export type Bucket = {
  t: number; // elapsed day, fractional (0.25 steps == 6h)
  day: number;
  casualties: number; // per-6h observed
  median: number; // historical median at same elapsed t
  p10: number;
  p90: number;
  colonialRegions: number; // territorial state
  wardenRegions: number;
  regionalActivity: number; // relative 0-1
};

export const timeline: Bucket[] = (() => {
  const out: Bucket[] = [];
  const steps = TOTAL_DAYS * 4; // 6h buckets
  for (let i = 0; i <= steps; i++) {
    const t = 1 + i / 4;
    const day = Math.floor(t);
    // Ramp: quiet opening -> contested plateau -> high-mobility peak -> late-war taper.
    const phaseRamp =
      t < 5 ? 0.35 + t * 0.08 : t < 12 ? 0.7 + (t - 5) * 0.03 : t < 20 ? 0.9 + Math.sin((t - 12) * 0.5) * 0.12 : 0.86 - (t - 20) * 0.02;
    const base = 22_000 * phaseRamp;
    const noise = wobble(i, [3200, 0.9, 0.4], [1800, 2.3, 1.1], [1000, 5.1, 0.2]);
    const casualties = Math.max(3800, Math.round(base + noise));
    const median = Math.round(15_500 * (t < 6 ? 0.5 + t * 0.09 : t < 18 ? 1.02 : 1.02 - (t - 18) * 0.03));
    const spread = median * 0.42;
    // Territorial state: 27 controlled regions total, drifting toward Warden mid-war.
    const wardenShare = 0.46 + 0.1 * Math.sin(t * 0.4 - 1) + (t > 13 ? (t - 13) * 0.006 : 0);
    const totalRegions = 54;
    const wardenRegions = Math.round(totalRegions * wardenShare);
    out.push({
      t: Number(t.toFixed(2)),
      day,
      casualties,
      median,
      p10: Math.round(median - spread),
      p90: Math.round(median + spread),
      wardenRegions,
      colonialRegions: totalRegions - wardenRegions,
      regionalActivity: Math.min(1, Math.max(0.12, 0.5 + wobble(i, [0.28, 1.7, 0.3], [0.16, 4.2, 1.4]))),
    });
  }
  return out;
})();

// Observed objective changes (not exact events) placed along the war clock.
export type ObjectiveChange = { t: number; faction: Faction };
export const objectiveChanges: ObjectiveChange[] = (() => {
  const out: ObjectiveChange[] = [];
  for (let i = 0; i < 34; i++) {
    const t = 1.4 + (i / 34) * (TOTAL_DAYS - 1.2) + wobble(i, [0.18, 3.3, 0.5]);
    out.push({ t: Number(t.toFixed(2)), faction: i % 3 === 0 ? "colonial" : "warden" });
  }
  return out;
})();

// Deterministic war-phase classification.
export type Phase = { key: string; label: string; dayStart: number; dayEnd: number | null; caption: string };
export const phases: Phase[] = [
  { key: "opening", label: "Opening", dayStart: 1, dayEnd: 5, caption: "Initial deployment and border skirmishes." },
  { key: "contested", label: "Contested", dayStart: 6, dayEnd: 12, caption: "Expanding fronts and increased resistance." },
  { key: "high-mobility", label: "High Mobility", dayStart: 13, dayEnd: 20, caption: "Rapid territorial changes." },
  { key: "late-war", label: "Late War", dayStart: 21, dayEnd: null, caption: "Consolidation and final objectives." },
];

// Crosshair reference point shown in the timeline tooltip by default.
export const focusPoint = {
  day: 17,
  clock: "18:30",
  casualties: 18_420,
  observedChanges: 14,
  activeRegions: 27,
  phase: "High Mobility",
};

// Left-rail historical archive: recent wars with sparkline shapes.
export type ArchiveWar = { number: number; active?: boolean; spark: number[] };
export const archive: ArchiveWar[] = [124, 123, 122, 121, 120, 119, 118].map((number, idx) => ({
  number,
  active: number === 124,
  spark: Array.from({ length: 22 }, (_, i) =>
    Math.max(6, 40 + wobble(i + idx * 5, [22, 0.8, idx], [12, 2.4, 1.1], [7, 5.5, 0.4]))
  ),
}));

// Recent war days summary cards.
export type WarDay = {
  day: number;
  casualties: number;
  objectiveChanges: number;
  activeRegions: number;
  spark: number[];
};
export const recentDays: WarDay[] = [
  { day: 19, casualties: 12_840, objectiveChanges: 9, activeRegions: 24 },
  { day: 20, casualties: 16_210, objectiveChanges: 11, activeRegions: 26 },
  { day: 21, casualties: 14_905, objectiveChanges: 8, activeRegions: 25 },
  { day: 22, casualties: 19_330, objectiveChanges: 15, activeRegions: 28 },
  { day: 23, casualties: 17_660, objectiveChanges: 12, activeRegions: 27 },
].map((d, idx) => ({
  ...d,
  spark: Array.from({ length: 8 }, (_, i) => Math.max(8, 30 + wobble(i + idx * 3, [16, 1.2, idx], [8, 3.1, 0.6]))),
}));

// "How unusual is this war?" comparison against past wars at the same day.
export type ComparisonRow = {
  label: string;
  value: string;
  delta: string; // e.g. "+22% vs typical" or "Within typical range"
  deltaTone: "high" | "neutral";
  min: number;
  max: number;
  typicalLow: number;
  typicalHigh: number;
  marker: number; // absolute value for marker placement
  rangeLabel: string;
};
export const comparison: ComparisonRow[] = [
  {
    label: "Casualty rate",
    value: "12.4K / day",
    delta: "+22% vs typical",
    deltaTone: "high",
    min: 5.1,
    max: 18.7,
    typicalLow: 8.4,
    typicalHigh: 13.6,
    marker: 12.4,
    rangeLabel: "5.1K – 18.7K",
  },
  {
    label: "Objective activity",
    value: "9.8 / day",
    delta: "+31% vs typical",
    deltaTone: "high",
    min: 2.1,
    max: 15.4,
    typicalLow: 5.2,
    typicalHigh: 9.1,
    marker: 9.8,
    rangeLabel: "2.1 – 15.4",
  },
  {
    label: "Regional activity",
    value: "0.76",
    delta: "Within typical range",
    deltaTone: "neutral",
    min: 0.3,
    max: 1.4,
    typicalLow: 0.6,
    typicalHigh: 0.95,
    marker: 0.76,
    rangeLabel: "0.3 – 1.4",
  },
  {
    label: "Territorial volatility",
    value: "0.64",
    delta: "+18% vs typical",
    deltaTone: "high",
    min: 0.2,
    max: 1.1,
    typicalLow: 0.4,
    typicalHigh: 0.62,
    marker: 0.64,
    rangeLabel: "0.2 – 1.1",
  },
];

export const NAV = ["Overview", "Wars", "Regions", "Compare", "Records", "Archive"];
