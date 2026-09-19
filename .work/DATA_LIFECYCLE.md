# Foxhole Chronicle — Data Lifecycle, Archival and Recovery

Status: **Authoritative working specification — 2026-09-19**

This document defines Chronicle's durable data lifecycle from ingestion through active storage, sealing, archival, backup, recovery and long-term reprocessing.

It complements:

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [INGESTION.md](./INGESTION.md)
- [DATA_MODEL.md](./DATA_MODEL.md)
- [TIME_SEMANTICS.md](./TIME_SEMANTICS.md)
- [OBJECTIVE_IDENTITY.md](./OBJECTIVE_IDENTITY.md)
- [IDEMPOTENCY_RECOVERY.md](./IDEMPOTENCY_RECOVERY.md)

Research basis: [research/DATA_LIFECYCLE_ARCHIVAL_RESEARCH_2026-09-19.md](./research/DATA_LIFECYCLE_ARCHIVAL_RESEARCH_2026-09-19.md).

## 1. Core principle

Chronicle treats collected public source state as potentially **non-recreatable**.

Once a transient source state disappears, Chronicle may be unable to retrieve it again. Therefore durability requirements apply not only to canonical PostgreSQL facts, but also to replay-critical raw source evidence.

The lifecycle MUST preserve:

`fetch -> exact raw evidence -> normalized/canonical history -> derived analytics -> sealed archive revision`

## 2. Storage tiers

Chronicle separates four logical layers.

### 2.1 Fetch/validation metadata

Stored in PostgreSQL.

Includes:

- source/shard/endpoint;
- collection profile/version;
- scheduled/request/completion time;
- HTTP status/outcome;
- ETag/cache metadata;
- content hash;
- representation link;
- parser/schema information;
- error/retry metadata.

### 2.2 Raw replay evidence

Exact source responses are stored through one logical `source_payloads` abstraction with two physical storage kinds.

#### Inline

Small exact payload bytes stored in PostgreSQL `bytea`.

Typical candidates:

- war;
- maps;
- warReport.

The inline size threshold is implementation/configuration policy and MUST be calibrated from actual payload measurements.

#### External CAS

Larger payloads stored as content-addressed compressed objects/files.

Typical candidates:

- dynamic/public;
- static;
- oversized diagnostic/malformed payloads.

External objects use Zstandard compression.

### 2.3 Sparse canonical/query history

PostgreSQL stores query-oriented semantic facts rather than full repeated snapshots:

- canonical war/region/objective state;
- sparse source-item evidence;
- state intervals;
- observed changes;
- coverage;
- counter observations;
- aggregates;
- metric/model results.

### 2.4 Sealed analytical projections

Completed/sealed wars MAY produce immutable analytical exports such as Parquet + ZSTD.

These are secondary projections, not source truth.

## 3. Payload identity and compression

Every payload has exact source identity:

`content_hash = SHA256(original_response_bytes)`

The hash is computed **before** compression.

Chronicle also keeps a separate versioned semantic fingerprint.

These concepts are distinct:

- ETag — source transport/cache validator;
- content hash — exact source-byte identity;
- semantic fingerprint — parser/canonicalization-level equivalence;
- canonical objective identity — Chronicle domain inference.

Compression format/version MUST NOT alter source identity.

External CAS SHOULD use Zstandard.

## 4. External CAS write protocol

A PostgreSQL row MUST NOT commit a reference to an external payload that is not durably available.

Chronicle distinguishes raw durability from canonical acceptance: preserving a received response durably is allowed before deciding whether it is current, valid, anomalous or stale-fenced.

Safe order:

1. receive source bytes;
2. calculate content hash over exact original bytes;
3. compress into a temporary destination;
4. durably flush/upload object;
5. atomically/conditionally publish the final content-addressed object;
6. verify stored identity/size according to the storage adapter;
7. only then begin a short PostgreSQL **raw-capture transaction**;
8. store stable fetch metadata plus payload metadata/reference and commit;
9. only after that raw-durable COMMIT, run a separate short canonical reconciliation transaction for normalized observations/current state/changes/outbox.

For local POSIX/Linux storage, durable publication means at minimum:

- temp file on the same filesystem as final object;
- write compressed bytes;
- flush application buffers;
- `fsync(temp_file)`;
- atomic publish/rename without overwriting a different object;
- `fsync(parent_directory)` after publication.

A plain write + rename is not sufficient crash-durability protocol.

For S3-compatible object storage, Chronicle SHOULD use deterministic hash keys plus conditional create semantics where the selected provider supports them. Provider PUT/multipart/checksum semantics MUST be verified for that adapter. Object-store ETag MUST NOT be assumed to equal Chronicle SHA-256 or MD5.

Concurrent writers for the same content hash converge on one object. If an existing object at the expected hash path fails integrity verification, Chronicle MUST raise a corruption/collision incident rather than overwrite it.

A crash before database commit may leave an unreferenced CAS object. That is acceptable.

A crash MUST NOT leave a committed database reference to a missing object.

Unreferenced CAS objects MAY be garbage-collected only after:

- a grace period;
- database reference scan;
- exclusion of in-flight writes/sealing/reprocessing;
- applicable retention/offsite requirements.

## 5. Inline payload protocol

Inline payload bytes and fetch metadata commit together in the short raw-capture transaction.

The bytes MUST be the exact original response body.

The raw-capture COMMIT is the raw-durable boundary for inline storage. Canonical normalization/reconciliation is a later transaction. A Worker crash after receiving a response but before raw-capture COMMIT may lose that response; after raw-capture COMMIT it MUST be recoverable without depending on a refetch.

Inline payloads MUST retain the same content-hash semantics as external payloads.

Changing an implementation threshold between inline/external storage MUST NOT change payload identity or public semantics.

## 6. Transactional outbox

Chronicle v1 uses PostgreSQL transactional outbox/lease semantics for asynchronous durable work.

A transaction that changes canonical state MUST write all required downstream work items atomically with that mutation.

Example job kinds:

- identity resolution;
- coverage rebuild;
- 15m/1h/1d aggregation;
- analytical model invalidation/recompute;
- raw offsite replication;
- archive sealing;
- export generation.

Workers claim jobs in a short `READ COMMITTED` transaction with row locking such as `FOR UPDATE SKIP LOCKED`, set lease owner/expiry, increment `lease_generation`, and commit before executing the handler.

Delivery is **at-least-once**. A worker can crash after an effect succeeds but before the outbox row is marked completed. Therefore handlers MUST use deterministic dedup keys, naturally idempotent effects, conditional create or an equivalent effect ledger.

Completion MUST verify the same lease generation. A stale worker cannot acknowledge a job after lease steal.

`LISTEN/NOTIFY` MAY wake workers after commit but is not durable queue state. Workers poll the outbox on startup and periodically.

Kafka/RabbitMQ/Redis queues are not required for v1.

## 7. Native analytical resolution

Collection resolution and output resolution are separate concepts.

Under `chronicle-collection-v1`:

- war lifecycle collection: 5m;
- warReport collection: 15m;
- dynamic/public collection: 15m.

For warReport/dynamic-derived ordinary analytics, **15m is the highest generic Chronicle-native resolution**.

Canonical generic resolutions:

- `native`;
- `15m`;
- `1h`;
- `1d`.

A finer result such as `5m` MUST be exposed only for a metric/dataset whose actual supporting evidence permits it.

Chronicle MUST NOT interpolate/upsample 15m evidence and label it 5m source resolution.

## 8. War archival lifecycle

Canonical lifecycle:

- `active`;
- `soft_closed`;
- `sealing`;
- `sealed`.

### active

Normal collection/reconciliation is running.

### soft_closed

A valid conquest end has been observed, but final transition/reconciliation is not complete.

Chronicle SHOULD continue enough collection to confirm terminal/source transition state.

### sealing

The archive worker finalizes and verifies:

- coverage;
- source-fetch accounting;
- state intervals;
- final aggregates;
- model outputs;
- referenced raw payload presence;
- offsite replication status;
- archive exports;
- manifest.

### sealed

A versioned reproducible archive revision has passed sealing checks.

A later accepted source correction does not mutate the sealed manifest in place. It creates a new archive revision and sealing run.

## 9. Archive revisions and manifest

`war_archive_revisions` identify reproducible sealed states.

Every sealed revision MUST have a manifest containing:

- war/shard/source identity;
- archive revision;
- collection profile version;
- collection interval;
- expected/successful/failed fetch counts;
- HTTP 200/304 counts;
- content-change count;
- semantic-change count;
- coverage summary;
- raw payload count;
- original raw bytes;
- compressed external bytes;
- parser/normalizer versions;
- semantic fingerprint version;
- time semantics version;
- war time revision;
- objective identity resolution version;
- metric/model versions;
- export artifacts and hashes;
- manifest creation time;
- manifest hash.

The manifest itself is immutable for one archive revision.

## 10. Parquet exports

Parquet is a sealed analytical/export format, not runtime source truth.

Sealed-war export candidates:

- war summary;
- regions;
- objective state intervals;
- observed changes;
- casualty timeline at native/15m;
- 1h aggregates;
- 1d aggregates.

Parquet exports SHOULD use ZSTD compression.

They MAY support:

- offline analysis;
- research;
- bulk export;
- DuckDB/Python/Jupyter workflows;
- reproducibility checks.

Request-time API correctness MUST NOT depend on Parquet availability.

## 11. Hot / warm / cold lifecycle

### HOT

- current PostgreSQL facts;
- current local raw storage/cache;
- active outbox;
- active offsite replication;
- current aggregates.

### WARM

- recent sealed wars;
- PostgreSQL history remains online;
- sealed manifest/export exists;
- local raw copy MAY remain cached.

### COLD

- verified offsite raw archive;
- sealed manifests/exports;
- PostgreSQL canonical/queryable history remains online at v1 scale;
- local raw copies MAY be evicted after independent offsite verification.

A local raw payload MUST NOT be evicted merely because a remote upload request returned success. Chronicle MUST verify expected object identity/hash.

## 12. Offsite raw replication

Replay-critical external payloads SHOULD be replicated to independent offsite storage shortly after ingestion.

Initial operational target:

- normal verified-replica lag < 5 minutes;
- alert at > 15 minutes.

Chronicle MUST NOT claim a <=15 minute complete recovery point unless both PostgreSQL WAL/PITR and every required external payload for that point have reached verified offsite durability.

The destination object MUST be verified against the original uncompressed content hash. Upload completion and replica verification are separate states/timestamps.

Provider storage SHOULD support:

- object versioning;
- immutable/WORM-like retention when available;
- independent credentials/failure domain from the application VPS.

This is durability protection, not a compliance requirement.

## 13. PostgreSQL backup baseline

PostgreSQL 18 production cluster SHOULD retain data checksums enabled.

Primary disaster recovery uses:

- physical backup;
- continuous WAL archive/PITR;
- pgBackRest-managed backup repository.

Operations MUST alert if the pgBackRest WAL archive stream loses continuity. In particular, an archive-push queue overflow/drop condition is a PITR continuity failure requiring remediation/new backup, not ordinary replication lag.

Recommended initial schedule:

- weekly full;
- daily differential;
- continuous WAL archive;
- monthly full restore drill.

pgBackRest repository SHOULD use current recommended capabilities where supported by the deployed version:

- Zstandard compression;
- repository bundling;
- block-incremental storage.

Logical dumps MAY be used for portability/migrations but are not the primary DR mechanism.

## 14. WAL/RPO configuration

Chronicle MUST define and monitor a real DB recovery-point objective before launch.

`archive_timeout` and WAL archive behavior SHOULD be selected from:

- required RPO;
- measured WAL generation;
- backup repository cost/behavior.

Do not hard-code an aggressive `archive_timeout` merely to create frequent WAL files.

Initial operational objective SHOULD be no worse than 15 minutes of database/raw-evidence loss under a single-VPS failure, with improvement toward lower RPO where cost permits.

## 15. Integrity checking

Production operations SHOULD include:

- PostgreSQL page checksums;
- pgBackRest repository checks;
- periodic `pg_amcheck`;
- raw CAS checksum verification;
- sealed-manifest verification;
- regular restore drills.

A backup that has never been restored in a drill is not considered fully validated.

## 16. Recovery completeness

A valid disaster recovery requires both:

1. PostgreSQL restored to a consistent point;
2. all external payloads referenced by that restored database state available and verified.

Chronicle SHOULD track a recovery watermark/barrier: the latest DB recovery point for which required external replay payloads are also verified in the recovery failure domain.

Recovery validation MUST check:

- external object existence;
- decompression;
- original content hash;
- archive manifest hash;
- analytical export hashes when required;
- that no restored DB reference lies beyond the selected external-payload recovery watermark.

A database-only restore with missing replay evidence is degraded recovery and MUST be reported as such. External CAS objects newer than the restored database are harmless orphans; the dangerous direction is a restored DB reference to unavailable CAS.

## 17. Small-object policy

Chronicle MUST NOT create a custom packfile/container format in v1.

Small payloads may stay inline in PostgreSQL.

External CAS uses individual unique payload objects/files initially.

After measured evidence, sealed-war CAS compaction MAY be introduced if:

- object/file count becomes operationally material;
- filesystem/object-store request overhead is material;
- backup/restore duration materially improves.

Compaction MUST preserve per-payload content-hash lookup and manifest integrity.

## 18. PostgreSQL indexing/partitioning

v1 remains unpartitioned.

Use B-tree indexes for proven equality/range access patterns.

BRIN MAY be introduced for very large append-correlated timestamp tables after benchmark evidence.

Table partitioning requires a separate ADR and measured justification such as:

- query pruning benefit;
- retention/bulk-delete benefit;
- index-maintenance pressure;
- vacuum/maintenance limitations.

Row count alone is not sufficient justification.

## 19. Observability

Chronicle SHOULD expose low-cardinality telemetry for:

- requests/outcomes;
- 200/304 ratio;
- raw content-change ratio;
- semantic-change ratio;
- scheduler lag;
- original/compressed payload bytes;
- archive replication lag;
- archive verification errors;
- PostgreSQL relation/index size;
- WAL generation;
- outbox depth/oldest age;
- coverage gaps;
- aggregation/model lag;
- backup age/status;
- last restore-drill success;
- checksum/amcheck failures.

OpenTelemetry .NET is the baseline telemetry API/SDK.

Metric labels MUST remain low-cardinality. Payload hashes, objective IDs and trace IDs MUST NOT be general metric dimensions.

## 20. Sizing and capacity

Request count is not a database-size forecast.

Capacity decisions MUST use observed:

- PostgreSQL relation/index sizes;
- inline payload bytes;
- external original/compressed bytes;
- raw object count;
- WAL bytes;
- backup growth;
- semantic evidence-row growth;
- replay throughput.

The current ~10 GB PostgreSQL/year/shard figure is only planning headroom until measured.

## 21. Acceptance gate

The archival/recovery design is implementation-ready only when:

1. one logical payload abstraction supports inline and external storage;
2. source content hash is independent of storage/compression;
3. external CAS writes are durable before DB references commit;
4. orphan-object GC cannot delete in-flight/referenced payloads;
5. outbox jobs are committed atomically with canonical state changes;
6. generic high-resolution analytical API does not exceed real collection resolution;
7. war lifecycle supports sealing and archive revisions;
8. sealed manifest schema is defined and hashed;
9. Parquet is treated as projection/export rather than source truth;
10. replay-critical raw data is replicated offsite;
11. PostgreSQL has PITR-capable backup;
12. backup and raw archive restores are tested;
13. restore validates DB-to-CAS referential integrity;
14. production telemetry covers growth, replication lag, backup/restore and integrity failures;
15. partitioning/custom packfiles remain deferred until measurements justify them;
16. external CAS publication is fault-tested for process kill, ENOSPC and concurrent same-hash writers;
17. outbox handlers are tested for crash after effect success/before completion;
18. sealing finalization is fenced against concurrent input/version changes;
19. the advertised recovery point is bounded by both WAL availability and verified external payload availability.
