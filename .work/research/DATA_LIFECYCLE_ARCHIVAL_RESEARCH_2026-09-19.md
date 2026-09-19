# Data Lifecycle / Archival / Recovery Research — 2026-09-19

Status: **Supporting research; authoritative decisions are in DATA_LIFECYCLE.md and adr/data-lifecycle-and-recovery.md**

## 1. Scope

This review validates the full Chronicle data lifecycle for the accepted collection profile:

- 30 active maps/shard planning baseline;
- war every 5 minutes;
- warReport every 15 minutes/map;
- dynamic/public every 15 minutes/map;
- maps every 60 minutes;
- static once per war/map.

At that baseline Chronicle schedules 6,072 regular requests/day/shard, 182,160 per 30-day war and 2,216,280/year/shard before retries/recovery/static.

The scale is small enough that architectural complexity should optimize for durability, replayability and operational simplicity rather than raw throughput.

## 2. Verified current platform capabilities — September 2026

### PostgreSQL 18

Official PostgreSQL 18 documentation confirms:

- PostgreSQL supports continuous WAL archiving and point-in-time recovery;
- PostgreSQL 18 supports incremental physical backups and `pg_combinebackup`;
- data checksums are enabled by default for new PostgreSQL 18 clusters;
- B-tree remains the general default index; BRIN is useful when values correlate with physical row order;
- declarative partitioning can improve specific large-table workloads but has operational costs and is not automatically beneficial.

Primary references:

- https://www.postgresql.org/docs/18/backup.html
- https://www.postgresql.org/docs/18/app-pgcombinebackup.html
- https://www.postgresql.org/docs/18/app-initdb.html
- https://www.postgresql.org/docs/18/app-pgamcheck.html
- https://www.postgresql.org/docs/18/indexes-types.html
- https://www.postgresql.org/docs/18/ddl-partitioning.html

### pgBackRest

Current pgBackRest guidance recommends:

- Zstandard (`zst`) compression for new repositories because it is substantially faster while providing compression comparable to gzip;
- repository file bundling to reduce small-file/object-store overhead;
- block-incremental repository support where appropriate;
- regular repository/check/restore discipline.

Reference:

- https://pgbackrest.org/user-guide.html

### Zstandard

RFC 8878 defines Zstandard as a lossless compression format suitable for files and streams. Independent frames allow independent decompression.

Reference:

- https://www.rfc-editor.org/rfc/rfc8878.html

### Apache Parquet

Parquet remains a column-oriented analytical interchange/storage format. The current specification supports ZSTD compression.

References:

- https://parquet.apache.org/docs/overview/
- https://parquet.apache.org/docs/file-format/data-pages/compression/

### OpenTelemetry .NET

Current OpenTelemetry documentation marks .NET traces, metrics and logs as Stable.

Reference:

- https://opentelemetry.io/docs/languages/dotnet/

### Immutable object storage

Current S3 documentation is one concrete example of versioned WORM-capable object retention through Object Lock. Chronicle should express this requirement vendor-neutrally: offsite archive/backup storage SHOULD support versioning and immutable-retention controls when available.

Reference:

- https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html

## 3. Architectural scale conclusion

At ~2.2 million regular fetch interactions/year/shard, Chronicle does **not** need:

- Kafka;
- RabbitMQ;
- Redis as a queue;
- ClickHouse;
- TimescaleDB;
- Iceberg/Delta Lake;
- Kubernetes;
- mandatory PostgreSQL table partitioning.

PostgreSQL + a worker + an outbox + replay archive is sufficient.

The difficult problem is not throughput. It is preserving source evidence without turning every poll into large relational duplication.

## 4. Payload-storage decision refinement

The previous rule “all raw payloads are external CAS files” is too coarse.

It creates unnecessary small-object/file overhead for tiny payloads such as war state and warReport, while external CAS remains desirable for larger dynamic/static snapshots.

Chronicle should use one logical payload abstraction with two physical storage kinds:

### Inline payload

Suitable for small exact responses.

- PostgreSQL `bytea` stores the exact original response bytes.
- `content_hash` remains SHA-256 of those original bytes.
- PostgreSQL/TOAST owns physical storage details.
- No millions of tiny filesystem/object-store objects are created.

Likely v1 candidates:

- war;
- maps;
- warReport.

The exact inline-size threshold is an implementation/configuration value and MUST be calibrated from real payloads rather than becoming source semantics.

### External CAS payload

Suitable for larger/replay-heavy bodies.

- exact source bytes are hashed before compression;
- body is compressed with Zstandard;
- object key/path is derived from content hash;
- PostgreSQL stores content hash, uncompressed/compressed size, compression and storage reference.

Likely v1 candidates:

- dynamic/public;
- static;
- oversized/malformed diagnostic payloads.

Likewise, endpoint class is only a default policy. A measured size threshold may override it.

## 5. Raw-payload identity

Chronicle maintains:

1. ETag — transport/cache validator;
2. content hash — SHA-256 of exact original response bytes;
3. semantic fingerprint — versioned parser/canonicalization result.

Compression never participates in source identity.

A compressed object can be recompressed later without changing `content_hash`.

## 6. Crash consistency

For external CAS payloads, the safe write order is:

1. receive body;
2. calculate SHA-256;
3. compress to a temporary file/object;
4. durable write/fsync or provider-confirmed durable PUT;
5. atomically publish/finalize the CAS object;
6. begin PostgreSQL transaction;
7. persist payload metadata, fetch record, normalized/sparse facts and outbox jobs;
8. commit.

This makes an interrupted pre-commit operation leave, at worst, an unreferenced CAS object.

The opposite state — committed DB reference to a missing raw payload — MUST be prevented.

Unreferenced objects are cleaned by delayed garbage collection after a grace period and cross-check against PostgreSQL references.

Inline payloads can be committed atomically with fetch metadata inside PostgreSQL.

## 7. Transactional outbox

At Chronicle scale, downstream work should use PostgreSQL as the durable coordination mechanism.

A source mutation transaction writes both:

- canonical/normalized changes;
- outbox rows for downstream processing.

Workers consume outbox jobs using leases or `FOR UPDATE SKIP LOCKED`.

Candidate work:

- normalization/reprocessing;
- objective identity resolution;
- coverage rebuild;
- 15m/1h/1d aggregation;
- model invalidation/recompute;
- raw archive replication;
- war sealing/export.

No separate broker is justified before measured need.

## 8. Native analytical resolution

Collection resolution and public/output resolution are separate.

For warReport/dynamic-derived time series under `chronicle-collection-v1`, the highest ordinary Chronicle collection bucket is **15 minutes**.

Therefore the default generic analytical resolutions should be:

- `native` / effective source resolution;
- `15m`;
- `1h`;
- `1d`.

A `5m` analytical result MUST be metric/dataset-specific and available only when its supporting observations actually have adequate resolution. Chronicle MUST NOT upsample 15m observations and label them 5m data.

## 9. War archive lifecycle

Recommended lifecycle:

- `active`;
- `soft_closed`;
- `sealing`;
- `sealed`.

### active

Current war still collecting.

### soft_closed

A valid conquest end has been observed, but collection/reconciliation continues through transition confirmation.

### sealing

Chronicle finalizes:

- coverage;
- final state intervals;
- final aggregates;
- model outputs;
- archive manifest;
- raw payload verification;
- offsite archive verification.

### sealed

A reproducible archive revision exists.

A later accepted source correction does not mutate the sealed manifest in place. It creates a new archive revision and resealing run.

## 10. Archive manifest

Every sealed war should have a versioned manifest containing at least:

- war/shard/source identity;
- archive revision;
- collection profile version;
- collection start/end;
- expected/successful/failed fetch counts;
- 200/304/content-change/semantic-change counts;
- coverage summary per endpoint/region;
- raw payload count and bytes;
- compressed external-archive bytes;
- parser/normalizer versions;
- semantic fingerprint version;
- time semantics version and war time revision;
- objective identity resolution version;
- metric/model versions;
- export artifacts/hashes;
- manifest creation time;
- manifest SHA-256.

A manifest is reproducibility metadata, not a source snapshot.

## 11. Parquet policy

Parquet is useful **after sealing** as a portable analytical projection.

Recommended sealed-war datasets may include:

- war;
- regions;
- objective state intervals;
- observed changes;
- casualties/native-15m;
- casualties/1h;
- casualties/1d.

Use ZSTD compression.

Parquet MUST NOT replace raw source evidence or PostgreSQL canonical truth.

Parquet generation is not required for request-time serving.

## 12. Hot / warm / cold lifecycle

### HOT

- active-war PostgreSQL state;
- local payload storage/cache;
- offsite replication in progress;
- current aggregates.

### WARM

- recently sealed war;
- PostgreSQL queryable history;
- raw archive still locally available when capacity permits;
- sealed Parquet/manifest.

### COLD

- raw replay archive and sealed analytical exports in verified offsite storage;
- local raw copies may be evicted only after offsite verification and manifest/sealing checks;
- PostgreSQL canonical/queryable history remains online at current scale.

Chronicle should not evict old canonical history from PostgreSQL simply to imitate a large-scale data lake.

## 13. Small-object compaction

Do not build a custom packfile/archive-container system in v1.

Use:

- inline PostgreSQL storage for small payloads;
- individual CAS objects/files for larger unique payloads.

After real measurements, sealed-war CAS objects MAY be packed/compacted if object count, backup, filesystem or object-store overhead becomes material.

Compaction MUST preserve per-payload SHA-256 identity and manifest lookup.

## 14. PostgreSQL backup/recovery baseline

Recommended production baseline:

- PostgreSQL 18 data checksums enabled;
- continuous WAL archiving for PITR;
- pgBackRest as the preferred backup manager;
- Zstandard repository compression;
- repository bundling;
- block-incremental support where deployed version/config supports it;
- weekly full backup;
- daily differential backup;
- retention sufficient for at least the chosen PITR window;
- monthly full restore drill;
- regular pgBackRest repository checks;
- periodic `pg_amcheck` during low-load windows.

Logical `pg_dump` may be kept as a portability/migration artifact, but it is not the primary disaster-recovery mechanism.

`archive_timeout` SHOULD be selected from required RPO and measured WAL generation; do not hard-code an aggressive value before measurement.

## 15. Raw archive replication

Raw source evidence is not recreatable after the source state disappears.

Therefore active-war replay payloads SHOULD be copied to independent offsite storage shortly after commit.

Initial operational target:

- normal replication lag < 5 minutes;
- alert when lag exceeds 15 minutes.

This is an operational target, not source semantics.

Destination verification checks the uncompressed/original `content_hash`.

Versioning and immutable/WORM-style retention SHOULD be enabled where the chosen provider supports them.

## 16. Recovery model

A disaster recovery must restore **both**:

1. PostgreSQL to a consistent point through base backup + WAL/PITR;
2. every raw payload referenced by the restored database state.

Restore procedure therefore verifies referential archive integrity:

- every referenced external payload exists;
- compressed object is readable;
- decompressed bytes hash to the expected content hash;
- sealed manifests and exports hash correctly.

A DB-only restore is not sufficient if external replay evidence is missing.

## 17. Observability

Key low-cardinality telemetry:

- fetch requests/outcomes;
- 200/304 ratio;
- content-change ratio;
- semantic-change ratio;
- scheduler lag;
- payload original/compressed bytes;
- local/offsite archive replication lag;
- missing/archive-integrity failures;
- PostgreSQL relation/index bytes;
- WAL bytes;
- outbox depth/oldest age;
- aggregate/model lag;
- coverage gaps;
- backup age/status;
- last successful restore drill;
- pg_amcheck/checksum failures.

Labels SHOULD remain low cardinality: shard, endpoint kind, outcome, job kind.

Do not use payload hash/objective ID/trace ID as general metric labels.

## 18. Partitioning/index strategy

Keep v1 unpartitioned.

Use targeted B-tree indexes for actual query predicates.

Consider BRIN for very large append-correlated timestamp tables only after measured benefit.

Partitioning requires an ADR when actual evidence shows benefits for:

- pruning/query latency;
- bulk retention/deletion;
- index maintenance;
- vacuum/maintenance windows.

Row count alone is not sufficient.

## 19. Capacity policy

The prior rough “~10 GB PostgreSQL/year/shard” remains only a planning headroom estimate.

Do not turn it into a forecast.

Measure daily:

- `pg_total_relation_size` by table/index;
- raw inline bytes;
- external original/compressed bytes;
- WAL bytes;
- backup growth;
- object counts;
- semantic evidence rows;
- replay throughput.

Use real measurements to decide:

- inline threshold;
- CAS packing;
- partitioning;
- BRIN;
- backup retention;
- VPS disk size.

## 20. Final recommendation

Chronicle v1 should use:

- PostgreSQL 18 for queryable truth and small inline raw payloads;
- Zstd content-addressed CAS for larger raw payloads;
- PostgreSQL transactional outbox rather than a broker;
- 15m as ordinary native analytical resolution for dynamic/warReport data;
- war sealing + versioned archive manifest;
- Parquet/Zstd only as sealed analytical export;
- pgBackRest + WAL/PITR + verified restore drills;
- immediate/near-immediate offsite raw archive replication;
- vendor-neutral versioning/immutability controls;
- no partitioning/BRIN/custom packfiles until measurements justify them.
