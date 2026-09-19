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

## Source-semantics verification status

### War API identity and timing — resolved for backend baseline

The 2026-09-19 source-semantics pass is materialized in [WAR_API_SEMANTICS.md](./WAR_API_SEMANTICS.md).

Resolved baseline:

- canonical Chronicle war identity remains internal UUID;
- official runtime identity is shard + `warId`;
- `warNumber` is shard-scoped display/navigation data, not a PK;
- official map items expose no documented stable objective ID;
- map `lastUpdated` is map-state update metadata, not an item event timestamp;
- ETag/`If-None-Match`/304 are documented and required for ingestion efficiency;
- raw `dayOfWar` is not Chronicle's analytical 24-hour day;
- map-scoped enlistments must not be summed into a global unique-player count.

Remaining unknowns are explicitly listed in WAR_API_SEMANTICS.md and MUST stay conservative.

### Time semantics

The 2026-09-19 deep-research pass is materialized in [TIME_SEMANTICS.md](./TIME_SEMANTICS.md) and [adr/elapsed-war-day-vs-game-day.md](./adr/elapsed-war-day-vs-game-day.md).

Resolved baseline:

- Chronicle elapsed war day is a 1-based 24-hour bucket anchored to validated `conquestStartTime`;
- conquest analytics use half-open intervals;
- exact conquest-end boundaries do not create an empty following day;
- completed day count is separate from day-at-instant;
- raw `dayOfWar` is diagnostics only;
- UTC calendar date/local timezone/DST do not define analytical buckets;
- collector/API downtime reduces coverage but does not pause elapsed time;
- boundary-crossing polling uncertainty is not assigned to a fake exact day;
- source-time corrections create a new war-time revision and trigger deterministic recomputation.

### Collection cadence and storage

The 2026-09-19 cadence/storage analysis is materialized in [adr/collection-cadence-and-storage.md](./adr/collection-cadence-and-storage.md) and [research/COLLECTION_CADENCE_STORAGE_ANALYSIS_2026-09-19.md](./research/COLLECTION_CADENCE_STORAGE_ANALYSIS_2026-09-19.md).

Accepted baseline:

- `chronicle-collection-v1`;
- war 5m;
- warReport 15m/map;
- dynamic/public 15m/map;
- maps 60m plus transition/reconciliation triggers;
- static once per war/map;
- 30 active maps/shard for initial capacity planning;
- 6,072 scheduled regular requests/day/shard at that baseline;
- fixed cadence/no hot mode in v1;
- replay-critical exact raw payloads retained through a hybrid payload abstraction: small payloads may be inline PostgreSQL bytes, larger payloads use Zstd-compressed CAS;
- PostgreSQL stores sparse semantic/item history rather than every unchanged item occurrence;
- 15m -> 30m -> 60m downsampling analysis is required before relaxing cadence.

Precise GB/year is intentionally not treated as known until real payload, compression, semantic-change and relation/index growth are measured.
### Data lifecycle, archival and recovery

The September 2026 lifecycle review is materialized in [DATA_LIFECYCLE.md](./DATA_LIFECYCLE.md) and [adr/data-lifecycle-and-recovery.md](./adr/data-lifecycle-and-recovery.md).

Resolved baseline:

- payload content identity is SHA-256 of exact original response bytes before compression;
- small payloads may be inline in PostgreSQL; large dynamic/static payloads use Zstd CAS;
- external CAS is made durable before PostgreSQL commits a reference;
- PostgreSQL transactional outbox replaces a separate broker in v1;
- ordinary high-resolution warReport/dynamic analytics are 15m, not synthetic 5m;
- completed wars pass active -> soft_closed -> sealing -> sealed;
- sealed manifests are revisioned; late corrections create a new archive revision;
- Parquet/Zstd is a sealed analytical projection, not source truth;
- PostgreSQL DR uses physical backup + continuous WAL/PITR, with pgBackRest as the preferred manager;
- raw replay evidence is replicated to an independent offsite failure domain;
- recovery is incomplete if PostgreSQL references missing external replay payloads;
- no table partitioning, custom packfiles or large-data platform components without measured evidence.
### Idempotency, transactions and crash recovery

The September 2026 idempotency/crash-recovery pass is materialized in [IDEMPOTENCY_RECOVERY.md](./IDEMPOTENCY_RECOVERY.md), [research/IDEMPOTENCY_TRANSACTION_CRASH_RECOVERY_RESEARCH_2026-09-19.md](./research/IDEMPOTENCY_TRANSACTION_CRASH_RECOVERY_RESEARCH_2026-09-19.md), and [adr/idempotency-transaction-crash-recovery.md](./adr/idempotency-transaction-crash-recovery.md).

Resolved baseline:

- Chronicle does not claim exactly-once execution;
- logical collection job, attempt, HTTP fetch, payload, representation validation and canonical reconciliation operation are distinct identities;
- deterministic job/operation IDs and unique constraints provide retry idempotency; request/capture timestamps do not;
- HTTP/compression/external CAS/heavy analytics remain outside PostgreSQL transactions;
- normal reconciliation uses short READ COMMITTED transactions plus explicit endpoint cursor locking;
- lease_generation is the stale-worker fencing token;
- external CAS is durably published before DB reference commit; orphan objects are the safe failure direction;
- unknown COMMIT is reconciled by stable operation ID; PostgreSQL pg_xact_status(xid8) is supplemental evidence when XID is available;
- outbox delivery is at-least-once; claim transaction ends before handler execution; completion is generation-fenced;
- LISTEN/NOTIFY is wake-up only, never durable queue state;
- reprocessing activation and war sealing are versioned/fenced;
- complete PITR recovery is bounded by both WAL availability and verified external replay-payload availability;
- kill -9, network cut around COMMIT, ENOSPC, duplicate/stale worker and PITR+CAS restore tests are production gates.

Community material from Reddit/Habr was used only to test operational failure patterns. PostgreSQL/.NET/Linux/object-store/pgBackRest primary documentation defines guarantees.

### Objective identity

Chronicle-owned objective identity is now an accepted requirement because the official map-item schema has no stable objective ID. Coordinate tolerance and cross-war matching still require calibration against a real payload corpus before being treated as collision-free.

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
