# Foxhole Chronicle — .work

This directory contains the authoritative working specifications for Foxhole Chronicle.

The documents are written for both human developers and AI coding agents. They are expected to evolve through reviewed ADRs and source verification, not through undocumented implementation drift.

## Authority order

1. `ARCHITECTURE.md`
2. the domain-specific specification for the topic
3. accepted ADRs in `adr/`
4. research/review material under `reviews/`, `RESEARCH_BRIEF.md`, and `REVIEW_SYNTHESIS.md`

For official Foxhole source semantics, `WAR_API_SEMANTICS.md` is the authoritative source contract. Domain documents MUST NOT strengthen an upstream guarantee beyond it.

Research/review files are evidence and critique, not authoritative architecture by themselves.

## Authoritative structure

```text
.work/
├── ARCHITECTURE.md
├── WAR_API_SEMANTICS.md
├── DATA_MODEL.md
├── INGESTION.md
├── HISTORICAL_DATA.md
├── METRICS.md
├── ANALYTICS.md
├── OBJECTIVE_IDENTITY.md
├── PUBLIC_API.md
├── DATA_LICENSING.md
├── PRODUCT_SCOPE.md
└── adr/
    ├── elapsed-war-day-vs-game-day.md
    ├── observed-events-not-exact-events.md
    ├── objective-identity.md
    ├── historical-source-policy.md
    ├── ruleset-epochs.md
    ├── metric-versioning.md
    ├── war-dna.md
    ├── war-similarity.md
    ├── war-phases.md
    └── public-data-licensing.md
```

Supporting research material:

```text
.work/
├── RESEARCH_BRIEF.md
├── REVIEW_SYNTHESIS.md
├── research/
│   └── OBJECTIVE_IDENTITY_RESEARCH_2026-09-19.md
└── reviews/
    ├── architecture-review-agent-2.md
    └── architecture-ux-analysis-2026.md
```

## Pre-backend architecture gate

The following documents are the most important **before writing the main backend**:

```text
WAR_API_SEMANTICS.md
DATA_MODEL.md
INGESTION.md
OBJECTIVE_IDENTITY.md
METRICS.md
DATA_LICENSING.md
```

Core backend/domain implementation MUST NOT begin by inventing contradictory semantics outside these files.

## Documentation rules

Specifications use RFC 2119 terminology: **MUST**, **SHOULD**, **MAY**.

Material statements SHOULD be classified where useful as:

- **VERIFIED FACT** — verified against a cited primary/official source.
- **OBSERVED/SECONDARY** — observed or supported by a secondary source but not an official guarantee.
- **DESIGN DECISION** — chosen architecture/product decision.
- **ASSUMPTION** — assumption requiring validation.
- **ESTIMATE** — sizing/capacity estimate, not an observed fact.
- **PENDING VERIFICATION** — implementation must not assume the claim until source verification resolves it.

For Foxhole data semantics, latest official Siege Camp/Foxhole documentation and the official `clapfoot/warapi` repository are the primary source of truth.

FoxholeStats and FoxholeHub are historical/bootstrap candidates only and MUST NOT silently override official semantics or become runtime hard dependencies.

## Product direction

Foxhole Chronicle is a public historical and analytical World Conquest platform, not a map-first tactical replacement.

Core product:

- Overview
- War Analytics
- Daily Chronicle
- Regions
- Compare
- Records
- Archive
- War Phases

Extended analytical features:

- Similar Wars
- War DNA
- Day vs Day
- Objective History
- Largest Swings / State Reversals
- Shareable Insights
- Public Data API / CSV
- Population Lab where legitimate compatible historical data exists

Phase 2:

- Event Stream
- Watch Mode

Explicit non-goals for v1:

- opaque/causal "Turning Points"
- winner/outcome prediction
- accounts / Discord
- player profiles
- comments
- AI/LLM summaries
- native mobile app
- hidden/private intelligence
- gameplay automation

Deterministic War Phases and descriptive Swing Analysis are allowed because their formulas, evidence, versions and coverage are explicit.

## Data honesty rules

Chronicle MUST preserve this semantic chain:

`source -> fetch -> observation -> normalized fact -> observed change -> derived metric -> analytical model/result -> share/export`

Chronicle MUST NOT:

- invent exact event times from polling;
- hide historical resolution gaps;
- silently redefine metrics;
- merge uncertain objective identities by guess;
- claim causal explanations from correlation;
- expose upstream raw data contrary to source policy;
- sum map-scoped enlistments and call them globally unique players;
- treat a dynamic map disappearance as a proven destruction event;
- treat map `lastUpdated` as an item-level event timestamp.

## Current status

The War API source-semantics gate has been materialized in `WAR_API_SEMANTICS.md`.

The Objective Identity deep-research pass is integrated into `OBJECTIVE_IDENTITY.md`, `DATA_MODEL.md`, `INGESTION.md`, `METRICS.md`, `ANALYTICS.md`, `PUBLIC_API.md`, and `adr/objective-identity.md`. Production matcher thresholds remain intentionally uncommitted until calibration against a labeled real-payload corpus.

Items explicitly marked UNKNOWN or unresolved remain conservative implementation constraints, not invitations to guess.
