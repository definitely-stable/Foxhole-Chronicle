# Architecture review synthesis

This file records the review findings that the final specifications must validate rather than blindly adopt.

## Findings with strong architectural merit

1. Long-term storage should favor normalized observations/changes/aggregates over indefinite full dynamic-map snapshots.
2. Idempotency must be based on source identity/content identity, not local capture time alone.
3. Daily Chronicle semantics must follow war-relative time, not UTC calendar boundaries.
4. Polling discovers a change within an observation interval; it does not establish the exact instant of the underlying in-game event.
5. Coverage/provenance/quality metadata are first-class analytical data.
6. Derived metrics require versioned formulas and golden tests.
7. Downsampling must preserve metric semantics and important extrema/spikes.
8. Historical bootstrap data must not become a hidden runtime dependency.
9. Next.js and ASP.NET Core should not independently invent competing caching layers or duplicated API contracts.
10. Single-node operations require realistic SLOs, offsite backups and tested restores.

## Items requiring explicit verification

### War API identity and timing

Verify from the official API/documentation:

- meaning and stability of `warId`
- relationship between war ID and displayed war number
- shard semantics
- availability of upstream timestamps
- whether map items expose any stable objective identifier
- documented cache headers and ETag behavior

Until verified, no schema should assume guarantees that the source does not state.

### Objective identity

The review proposes an internal `objective_key` derived from static map data, canonical coordinates, objective family and an identity algorithm version. This is directionally sound but MUST be tested against real payload evolution before being treated as collision-free.

### Partitioning

The reviews disagree in emphasis. The default v1 decision should be **no table partitioning until measured data volume/query/retention pressure justifies it**. The final architecture should define thresholds, observability and a migration path. BRIN/B-tree strategy should be selected per query shape and cardinality, not by convention.

### TimescaleDB

Do not add TimescaleDB merely because the product contains time series. PostgreSQL-native tables/indexes/aggregates are the baseline unless measured workload demonstrates a concrete need.

### Clean Architecture

Do not create ceremonial project layers. Preserve dependency boundaries, but organize the modular monolith around vertical slices/modules and explicit domain/data contracts.

### Redis/message brokers

No Redis, Kafka or RabbitMQ in v1 unless research demonstrates a specific requirement that PostgreSQL/in-process coordination cannot satisfy on the target single-VPS topology.

### SSE

SSE is a phase-2 option for Watch Mode/Event Stream. It should not delay MVP and should only be adopted if polling/cache invalidation proves inadequate for the required freshness.

## Historical FoxholeStats import

Treat public HTML accessibility as neither a license nor permission to scrape.

The final policy should require:

- legal/ToS/robots review
- attribution where required
- controlled bootstrap import
- immutable/versioned import manifests
- source URL
- retrieval timestamp
- SHA-256
- parser version
- source classification
- provenance on imported facts
- ability to disable/remove the importer without breaking runtime

If permission/terms remain unclear, the architecture should remain fully functional without FoxholeStats.

## Product scope guardrails

MVP is limited to:

- Overview
- War Analytics
- Daily Chronicle
- Regions
- Compare
- Records
- Archive

Phase 2:

- Event Stream
- Watch Mode

Not v1:

- Turning Points
- Population Lab
- accounts
- Discord
- player profiles
- comments
- AI summaries
- mobile application
- winner/outcome prediction
- map-first tactical UX

## Required final decision chain

The documentation should preserve the semantic chain:

`source -> fetch -> observation -> normalized fact -> observed change -> derived metric/interpretation`

Each layer should retain enough provenance and version information to be reproduced or reprocessed.
