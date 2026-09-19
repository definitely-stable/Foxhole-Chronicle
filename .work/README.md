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
├── TIME_SEMANTICS.md
├── DATA_MODEL.md
├── INGESTION.md
├── DATA_LIFECYCLE.md
├── IDEMPOTENCY_RECOVERY.md
├── HISTORICAL_DATA.md
├── METRICS.md
├── ANALYTICS.md
├── OBJECTIVE_IDENTITY.md
├── PUBLIC_API.md
├── DATA_LICENSING.md
├── PRODUCT_SCOPE.md
└── adr/
    ├── elapsed-war-day-vs-game-day.md
    ├── collection-cadence-and-storage.md
    ├── data-lifecycle-and-recovery.md
    ├── idempotency-transaction-crash-recovery.md
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
│   ├── OBJECTIVE_IDENTITY_RESEARCH_2026-09-19.md
│   ├── TIME_SEMANTICS_RESEARCH_2026-09-19.md
│   ├── COLLECTION_CADENCE_STORAGE_ANALYSIS_2026-09-19.md
│   └── DATA_LIFECYCLE_ARCHIVAL_RESEARCH_2026-09-19.md
└── reviews/
    ├── architecture-review-agent-2.md
    └── architecture-ux-analysis-2026.md
```

## Pre-backend architecture gate

The following documents are the most important **before writing the main backend**:

```text
WAR_API_SEMANTICS.md
TIME_SEMANTICS.md
DATA_MODEL.md
INGESTION.md
DATA_LIFECYCLE.md
IDEMPOTENCY_RECOVERY.md
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
- equate raw `dayOfWar`, UTC calendar day and Chronicle elapsed war day;
- create an empty following day when conquest ends exactly on a 24-hour elapsed boundary;
- allocate boundary-crossing poll uncertainty to a fake exact day;
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

The Time Semantics deep-research pass is integrated into `TIME_SEMANTICS.md`, `WAR_API_SEMANTICS.md`, `DATA_MODEL.md`, `INGESTION.md`, `HISTORICAL_DATA.md`, `METRICS.md`, `ANALYTICS.md`, `PUBLIC_API.md`, `ARCHITECTURE.md`, and `adr/elapsed-war-day-vs-game-day.md`. Canonical time semantics version is `elapsed-war-clock@1`.

Collection/storage profile `chronicle-collection-v1` is accepted: war 5m, warReport 15m/map, dynamic 15m/map, maps 60m, static once per war/map, with a 30-map/shard planning baseline. PostgreSQL stores sparse semantic history instead of duplicating every unchanged item occurrence. Exact raw evidence uses hybrid storage: small payloads may be inline; larger dynamic/static payloads use Zstd-compressed CAS. See `adr/collection-cadence-and-storage.md`.

The data lifecycle/recovery pass is integrated in `DATA_LIFECYCLE.md` and `adr/data-lifecycle-and-recovery.md`: PostgreSQL transactional outbox, war sealing/archive revisions, Parquet/Zstd sealed projections, pgBackRest + WAL/PITR, offsite raw replication and restore verification. Generic high-resolution analytical output is now `15m` under `chronicle-collection-v1`; `5m` is metric-specific only when underlying evidence supports it.

The idempotency/transaction/crash-recovery pass is integrated in `IDEMPOTENCY_RECOVERY.md` and `adr/idempotency-transaction-crash-recovery.md`: logical jobs are separated from attempts/fetches; endpoint lease generations fence stale workers; reconciliation uses short explicit PostgreSQL transactions; unknown COMMIT is reconciled by stable operation identity; outbox is explicitly at-least-once with idempotent effects; POSIX/object-store CAS publication, sealing and PITR+CAS recovery now have formal crash semantics and fault-injection gates.

Items explicitly marked UNKNOWN or unresolved remain conservative implementation constraints, not invitations to guess.
