// Prototype fixtures for the Foxhole Chronicle Overview.
// Shapes mirror the semantic chain in .work/PRODUCT_SCOPE.md:
// source -> observation -> normalized fact -> derived metric.
// All values are illustrative and labeled as such in the UI.

export type Faction = "colonial" | "warden";

export const war = {
  number: 122,
  elapsedDay: 18,
  elapsedHours: 18 * 24 + 7,
  status: "active" as const,
  rulesetEpoch: "1.60",
  startedAtIso: "2026-09-01T18:00:00Z",
};

export const provenance = {
  source: "clapfoot/warapi (able)",
  asOfIso: "2026-09-19T14:35:00Z",
  resolution: "15m",
  coverage: 0.968,
  metricVersion: "elapsed-war-clock@1 · casualties@2",
  freshnessSeconds: 190,
};

export const casualties = {
  total: 4_812_663,
  colonial: 2_390_114,
  warden: 2_422_549,
  last24h: 214_880,
  last24hColonial: 111_402,
  last24hWarden: 103_478,
  ratePerHour: 8_953,
  prev24h: 198_240,
};

// Elapsed-war-day casualty series (deterministic daily buckets).
export const dailyCasualties: {
  day: number;
  colonial: number;
  warden: number;
}[] = [
  { day: 1, colonial: 61200, warden: 58400 },
  { day: 2, colonial: 88300, warden: 91200 },
  { day: 3, colonial: 102400, warden: 99800 },
  { day: 4, colonial: 134500, warden: 141200 },
  { day: 5, colonial: 156800, warden: 149300 },
  { day: 6, colonial: 143200, warden: 151900 },
  { day: 7, colonial: 178400, warden: 170200 },
  { day: 8, colonial: 189600, warden: 201400 },
  { day: 9, colonial: 172300, warden: 168900 },
  { day: 10, colonial: 158900, warden: 163400 },
  { day: 11, colonial: 201200, warden: 195600 },
  { day: 12, colonial: 224500, warden: 231800 },
  { day: 13, colonial: 198700, warden: 189300 },
  { day: 14, colonial: 176400, warden: 182100 },
  { day: 15, colonial: 211900, warden: 205400 },
  { day: 16, colonial: 189300, warden: 197800 },
  { day: 17, colonial: 168400, warden: 172900 },
  { day: 18, colonial: 111402, warden: 103478 },
];

// Deterministic war phase classification (formula + evidence per spec).
export type Phase = {
  key: string;
  label: string;
  dayStart: number;
  dayEnd: number | null;
  faction?: Faction | "neutral";
};

export const phases: Phase[] = [
  { key: "opening", label: "Opening Skirmishes", dayStart: 1, dayEnd: 4, faction: "neutral" },
  { key: "escalation", label: "Escalation", dayStart: 5, dayEnd: 9, faction: "neutral" },
  { key: "attrition", label: "Attrition Deadlock", dayStart: 10, dayEnd: 14, faction: "neutral" },
  { key: "push-warden", label: "Warden Offensive", dayStart: 15, dayEnd: null, faction: "warden" },
];

export const currentPhase = {
  label: "Warden Offensive",
  faction: "warden" as Faction,
  since: "Day 15",
  basis: "Net observed objective control shifted +7 toward Wardens across a rolling 72h window.",
  confidence: "supported",
};

export const regions: {
  name: string;
  control: Faction;
  activity: number; // 0-100 contested intensity
  net24h: number; // signed objective delta, + = warden gain
  casualties24h: number;
}[] = [
  { name: "Deadlands", control: "warden", activity: 94, net24h: 3, casualties24h: 41200 },
  { name: "Marban Hollow", control: "colonial", activity: 88, net24h: -1, casualties24h: 33800 },
  { name: "Callahan's Passage", control: "warden", activity: 81, net24h: 2, casualties24h: 29100 },
  { name: "The Fingers", control: "warden", activity: 66, net24h: 1, casualties24h: 21400 },
  { name: "Umbral Wildwood", control: "colonial", activity: 59, net24h: 0, casualties24h: 18900 },
  { name: "Kalokai", control: "colonial", activity: 44, net24h: -2, casualties24h: 12600 },
];

// Historical context: how this war compares to prior wars at the same day.
export const historicalContext = {
  percentileCasualties: 82,
  percentileTempo: 74,
  medianDayCasualties: 148_000,
  sampleWars: 41,
  note: "Day 18 casualty tempo sits in the upper quartile of the 41-war archive.",
};

// Observed objective changes for the current day (not exact events).
export const recentChanges: {
  objective: string;
  region: string;
  from: Faction;
  to: Faction;
  window: string;
}[] = [
  { objective: "Ash Fields", region: "Deadlands", from: "colonial", to: "warden", window: "~2h ago" },
  { objective: "Reaching Trail", region: "Callahan's Passage", from: "colonial", to: "warden", window: "~5h ago" },
  { objective: "Sentry Post 14", region: "The Fingers", from: "warden", to: "colonial", window: "~9h ago" },
  { objective: "Liberation Gate", region: "Marban Hollow", from: "warden", to: "colonial", window: "~13h ago" },
];
