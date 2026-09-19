# Foxhole Chronicle — Ingestion Architecture

Status: **Authoritative working specification**

This document defines current/future data collection, historical imports, retries, replay, reconciliation and raw-data retention.

## 1. Source policy

Chronicle recognizes three source classes.

### A. Official runtime source

The official Foxhole War API is the authoritative runtime source for current/future public World Conquest state.

The worker MUST use the latest verified official endpoint semantics and MUST honor documented HTTP cache behavior such as ETag/conditional requests where supported.

### B. Historical community bootstrap

FoxholeStats and FoxholeHub are candidate historical/bootstrap sources.

They MUST NOT become runtime dependencies for normal Chronicle page rendering.

Automated import MUST remain disabled until DATA_LICENSING.md records an acceptable source-use decision.

### C. Chronicle-derived

Aggregates, observed changes, phase segments, similarity results, War DNA, swing windows and records are Chronicle-derived. They MUST always preserve the input source lineage and algorithm version.

## 2. Pipeline

Canonical pipeline:

`schedule -> fetch -> persist fetch metadata -> deduplicate payload -> normalize -> validate -> reconcile -> persist facts -> detect observed changes -> aggregate -> derive metrics -> analytical models -> cache invalidation -> share/export`

Each stage MUST be replayable from a durable predecessor whenever practical.

## 3. Scheduler

The scheduler MUST be freshness-driven rather than a blind fixed-frequency loop.

Per endpoint state:

- `source_key`
- `endpoint_key`
- `next_eligible_at`
- `last_attempt_at`
- `last_success_at`
- `last_changed_at`
- `etag`
- `cache_control`
- `consecutive_failures`
- `circuit_state`
- `lease_owner`
- `lease_until`

The next fetch time SHOULD be:

`max(source_cache_eligibility, chronicle_min_interval, retry_backoff)`

Chronicle MAY impose a slower interval than the upstream cache allows; it MUST NOT intentionally exceed a documented upstream request limit.

## 4. Conditional requests and deduplication

Where supported, requests MUST send `If-None-Match` using the last verified ETag.

On `304 Not Modified`:

- persist fetch metadata;
- update source health/freshness metadata;
- do not create a duplicate payload;
- do not rerun normalization unless an explicit reprocessing operation requests it.

On `200`:

1. read response bytes;
2. compute SHA-256 over canonical raw bytes;
3. upsert content-addressed payload;
4. record `content_hash`;
5. if hash is unchanged for the same semantic endpoint, skip fact mutation;
6. if changed, normalize and reconcile.

Local `captured_at` MUST NOT be the idempotency key.

## 5. Ingestion job state machine

`ingestion_jobs`

States:

- `scheduled`
- `fetching`
- `fetched_unchanged`
- `fetched_changed`
- `normalizing`
- `validating`
- `persisting`
- `deriving`
- `completed`
- `retry_wait`
- `blocked_circuit_open`
- `quarantined_schema_drift`
- `failed_terminal`

Transitions MUST be monotonic for one attempt. Retries create a new attempt record linked to the same logical job.

Each attempt records:

- attempt number;
- started/completed timestamps;
- failure class;
- retryability;
- next retry time;
- fetch ID;
- parser/normalizer version;
- worker build/commit identifier.

## 6. Retry policy

Retry only errors classified as transient.

Recommended baseline:

- exponential backoff;
- full jitter;
- bounded maximum delay;
- retry budget per endpoint;
- circuit breaker after repeated source-level failures.

Do not retry:

- deterministic parser/schema validation failures without a new build/config;
- explicit authentication/authorization failures;
- known permanent 4xx responses;
- licensing/policy blocks.

A circuit breaker protects the upstream source and the worker. It MUST NOT make the public site unavailable; stale-but-known-good data remains readable with freshness warnings.

## 7. Concurrency

Single-VPS v1 does not require a distributed broker.

The worker SHOULD use PostgreSQL advisory locks or lease rows to ensure one active fetch/derive operation per logical endpoint/task.

Multiple worker processes MAY be supported later, but correctness MUST not depend on only one process existing.

## 8. Schema drift

Every JSON payload SHOULD produce a lightweight structural fingerprint.

If required fields disappear, types change incompatibly or unknown structural changes cross a configured severity threshold:

- persist raw fetch metadata/payload if policy permits;
- quarantine normalization for that endpoint;
- raise an alert;
- continue serving last-known-good normalized data;
- do not silently coerce incompatible data.

Parser fixtures MUST be updated only with reviewed source evidence.

## 9. Raw payload retention

v1 decision:

- fetch metadata: retain indefinitely;
- normalized facts: retain indefinitely;
- aggregates/derived outputs: retain indefinitely subject to algorithm lifecycle;
- changed official raw payloads: retain hot for a bounded period;
- unchanged responses: metadata only;
- historical-import source artifacts: retain immutable manifest and, when permitted, exact imported artifact hash/copy.

Default hot raw retention target SHOULD begin at **30 days** and be revisited after measured storage sizing. This is a design default, not a claim about required volume.

Physical storage decision:

- small/medium JSON payloads MAY initially use PostgreSQL JSONB if measured DB growth remains acceptable;
- the preferred production boundary is **content-addressed compressed files on a dedicated persistent filesystem volume**, with metadata/hash in PostgreSQL;
- S3-compatible offsite/object storage MAY later replace or mirror that volume without changing logical identity.

Rationale: raw payloads are append-only blobs with different retention/backup characteristics from queryable normalized facts.

## 10. Historical import

Historical imports MUST be controlled import jobs, not live page-time scraping.

Each import batch requires a manifest:

- source key;
- source URI(s);
- retrieval timestamp;
- source artifact SHA-256;
- parser version;
- importer version;
- source policy decision/version;
- declared historical coverage;
- row/object counts;
- warnings;
- operator/build identity.

Imported records MUST retain:

- original source;
- original identifiers/text where useful;
- normalized Chronicle identity;
- resolution class;
- quality flags.

When two historical sources conflict, Chronicle MUST retain both provenance records and apply an explicit reconciliation policy. It MUST NOT silently overwrite one source with another.

## 11. Reconciliation

Reconciliation compares current normalized state with the previous valid state.

For objective state:

- identify canonical objective;
- compare previous and current normalized state;
- if materially changed, emit an `observed_change`;
- set interval `(previous_observed_at, current_observed_at]`;
- never infer an exact event time from the midpoint.

For cumulative counters:

- increasing value: normal;
- equal value: no delta;
- lower value: classify as correction/reset/anomaly until source/war transition logic proves meaning.

Corrections MUST trigger targeted recomputation of affected aggregates/metrics rather than a full database rebuild.

## 12. Backfill and reprocessing

Chronicle MUST support two distinct operations.

### Backfill

Adds facts that were previously absent from a source/import.

### Reprocess

Re-runs normalization/derivation over already captured immutable input using a new parser/algorithm version.

Reprocessing MUST write new versioned derived outputs or atomically supersede old outputs according to metric/model lifecycle rules. It MUST NOT destroy reproducibility.

## 13. War lifecycle handling

On detection of a new official war identity:

- create or reconcile the war row;
- associate the correct shard;
- freeze the previous war as completed only when verified by source semantics;
- start new source coverage segments;
- load/refresh static map data needed for objective identity;
- assign ruleset epoch only from documented evidence.

Static map data SHOULD be refreshed when source versioning/war transitions suggest a change rather than assumed immutable forever.

## 14. Freshness classes

Recommended product freshness states:

- `fresh`: within target interval;
- `delayed`: > 2x expected collection interval;
- `stale`: > configured source-specific stale threshold;
- `unavailable`: no valid data for the requested scope.

Every live API response SHOULD expose `data_as_of` and `freshness_state`.

## 15. Observability

Worker MUST emit:

- fetch attempts by endpoint/status;
- 200/304 ratio;
- changed-payload ratio;
- bytes fetched/stored;
- last successful fetch;
- ingestion lag;
- normalization failures;
- schema-drift quarantines;
- derived-job lag;
- reconciliation anomalies;
- retry/circuit state;
- historical import counts.

## 16. Security boundaries

The ingestion worker MUST use an allowlist of configured upstream hosts. User input MUST NOT determine arbitrary fetch URLs.

Redirects SHOULD be restricted or revalidated against the allowlist.

Response size/time limits MUST be enforced.

Raw source text MUST be treated as untrusted input before eventual rendering.

## 17. Acceptance criteria

Before backend feature work depends on ingestion:

1. Re-running an unchanged payload produces no duplicate facts.
2. A `304` produces no duplicate observation.
3. A worker crash between fetch and normalization can resume safely.
4. Two workers cannot simultaneously mutate the same logical ingestion task.
5. Parser schema drift produces quarantine + alert, not silent corruption.
6. Objective changes are represented as bounded observations, not invented exact timestamps.
7. A historical importer can be removed without breaking normal current-war runtime.
8. Targeted recomputation works after a late correction.
9. Source provenance is queryable for every normalized historical fact.
