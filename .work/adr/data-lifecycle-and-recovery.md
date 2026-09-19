# ADR: Data Lifecycle, Archival and Recovery

Status: **Accepted — 2026-09-19**

## Context

Chronicle collects source state that may disappear and become impossible to fetch again.

The accepted collection profile produces a modest request rate, but raw source evidence and canonical history must survive:

- process crashes;
- VPS loss;
- PostgreSQL corruption;
- operator mistakes;
- parser/matcher upgrades;
- late source corrections;
- long-term reprocessing.

The architecture therefore needs an explicit lifecycle for exact raw payloads, canonical PostgreSQL state, sealed war archives, backup and disaster recovery.

See:

- [DATA_LIFECYCLE.md](../DATA_LIFECYCLE.md)
- [INGESTION.md](../INGESTION.md)
- [DATA_MODEL.md](../DATA_MODEL.md)
- [IDEMPOTENCY_RECOVERY.md](../IDEMPOTENCY_RECOVERY.md)
- [adr/idempotency-transaction-crash-recovery.md](./idempotency-transaction-crash-recovery.md)
- [research/DATA_LIFECYCLE_ARCHIVAL_RESEARCH_2026-09-19.md](../research/DATA_LIFECYCLE_ARCHIVAL_RESEARCH_2026-09-19.md)

## Decision

### Hybrid payload storage

Chronicle uses one logical raw-payload abstraction with two physical storage kinds:

- small exact source bodies MAY be stored inline in PostgreSQL `bytea`;
- larger replay-heavy payloads are stored in compressed content-addressed storage.

The implementation threshold is configurable and measurement-driven.

Likely v1 defaults:

- war/maps/warReport -> inline when small;
- dynamic/static/oversized diagnostics -> external CAS.

Storage location MUST NOT affect payload identity.

### Payload identity

`content_hash = SHA256(original source bytes)`

is computed before compression.

ETag, content hash, semantic fingerprint and canonical domain identity remain separate concepts.

External CAS uses Zstandard compression by default.

### Crash consistency

External payload bytes must be durably published before PostgreSQL commits a reference to them. Local POSIX publication follows temp-write + file fsync + atomic publish + parent-directory fsync; object-store adapters must verify their own conditional-write/checksum semantics.

An orphan CAS object is acceptable and garbage-collectable after grace/reference/in-flight checks.

A committed DB reference to a missing CAS object is not acceptable.

### Transactional outbox

PostgreSQL transactional outbox is the v1 durable asynchronous work mechanism. Delivery is at-least-once; handlers are idempotent/deduplicated and lease completion is generation-fenced. LISTEN/NOTIFY, if used, is wake-up only.

No Kafka/RabbitMQ/Redis queue is required.

### Analytical resolution

For `chronicle-collection-v1`, ordinary warReport/dynamic-derived native high resolution is 15 minutes.

Generic analytical resolution contract:

- native;
- 15m;
- 1h;
- 1d.

5m is dataset/metric-specific only when underlying evidence actually supports it.

### War sealing

Completed wars use lifecycle:

`active -> soft_closed -> sealing -> sealed`

A sealed war has a versioned immutable archive manifest.

Accepted late corrections produce a new archive revision instead of rewriting an existing sealed manifest.

### Analytical export

Parquet + ZSTD is the preferred sealed analytical/bulk-export projection where useful.

Parquet is not source truth and does not replace PostgreSQL or raw replay evidence.

### Backup/recovery

Primary PostgreSQL DR:

- PostgreSQL 18 checksums enabled;
- continuous WAL archiving/PITR;
- pgBackRest;
- weekly full;
- daily differential;
- current recommended ZSTD/bundling/block-incremental repository capabilities where supported;
- regular repository checks;
- periodic pg_amcheck;
- monthly restore drill.

A logical dump is optional secondary portability, not primary recovery.

### Offsite raw evidence

Replay-critical raw payloads are replicated to an independent offsite failure domain shortly after ingestion.

Initial operational targets:

- normal **verified** raw-replication lag < 5m;
- alert > 15m;
- <=15m complete-recovery RPO is an objective, not a claim, until both WAL/PITR and external-payload recovery watermark measurements prove it.

Versioning and immutable/WORM-like retention SHOULD be used when the selected storage supports them.

### No premature large-data platform

v1 does not add:

- Kafka;
- ClickHouse;
- TimescaleDB;
- Iceberg/Delta;
- mandatory PostgreSQL partitioning;
- custom raw packfile format.

These require measured evidence and a new ADR.

## Consequences

- Small payloads avoid millions of tiny filesystem/object-store objects.
- Large snapshots avoid inflating PostgreSQL and its WAL/backups.
- Exact raw evidence remains replayable independently from parser/matcher version.
- PostgreSQL and raw archive form one recovery unit even though they use different physical stores.
- Archive sealing gives each completed war a reproducible data revision.
- 15m/1h/1d outputs can be generated from one canonical collected history.
- Backup validity now requires tested restore and DB-to-CAS referential verification.
- The safe recovery point is bounded by both PostgreSQL WAL availability and verified external replay-payload availability.

## Rejected alternatives

### All raw payloads in PostgreSQL

Rejected as the universal rule because large dynamic/static payloads unnecessarily inflate DB/WAL/backups.

### All raw payloads as individual external files/objects

Rejected as the universal rule because high-volume tiny warReport/war payloads create avoidable small-object overhead.

### Parquet as source truth

Rejected because columnar analytical projection cannot replace exact source evidence and transactional canonical state.

### Nightly-only raw archive backup

Rejected because transient collected source state can disappear permanently before the nightly backup.

### Universal 5m analytical timeline

Rejected because warReport/dynamic are collected at 15m under the accepted profile; advertising finer generic resolution would create unsupported precision.

### Mandatory table partitioning

Rejected until query/maintenance measurements demonstrate a concrete benefit.

## Review triggers

Revisit after measured evidence for:

- inline/external payload-size distribution;
- unique payload count and compression;
- DB/WAL/backup growth;
- offsite object count/cost;
- restore duration;
- query/index maintenance;
- one representative sealed war;
- downsampling and replay benchmarks.
