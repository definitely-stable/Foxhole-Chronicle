# Foxhole Chronicle — Ingestion Architecture

Status: **Authoritative working specification — War API semantics verified 2026-09-19**

This document defines current/future data collection, historical imports, retries, replay, reconciliation and raw-data retention.

Official source semantics are defined in [WAR_API_SEMANTICS.md](./WAR_API_SEMANTICS.md). The worker MUST NOT invent stronger guarantees.

## 1. Source policy

Chronicle recognizes three source classes.

### A. Official runtime source

The official Foxhole War API is the authoritative runtime source for current/future public World Conquest state.

The worker MUST:

- key every fetch by shard;
- honor returned HTTP cache headers;
- use ETag/`If-None-Match`;
- preserve raw source values and unknown enum/icon/flag values;
- treat dynamic map responses as state observations, not exact events.

### B. Historical community bootstrap

FoxholeStats and FoxholeHub are candidate historical/bootstrap sources.

They MUST NOT become runtime dependencies for normal Chronicle page rendering.

Automated import MUST remain disabled until DATA_LICENSING.md records an acceptable source-use decision.

### C. Chronicle-derived

Aggregates, observed changes, phase segments, similarity results, War DNA, swing windows and records are Chronicle-derived. They MUST always preserve input source lineage and algorithm version.

## 2. Official endpoint schedule

The official War API documents:

- war state may update every 60 seconds;
- region war report may update every 3 seconds;
- dynamic/public map data may update every 3 seconds;
- static map data only needs to be requested once per map between World Conquests;
- clients must respect returned cache headers and ETags.

Chronicle is a historical analytics product, not a tactical map. Initial product polling targets are therefore deliberately slower than the maximum source update cadence:

| Endpoint | Initial Chronicle target | Rule |
|---|---:|---|
| `/worldconquest/war` | ~60 s | never before upstream cache eligibility |
| `/worldconquest/warReport/:map` | ~60 s | per active map, conditional GET |
| `/worldconquest/maps/:map/dynamic/public` | ~60 s | per active map, conditional GET |
| `/worldconquest/maps` | ~5 min plus war-transition trigger | discover active map set |
| `/worldconquest/maps/:map/static` | on new war/new map; optional low-frequency ETag validation | source says once per map between wars |

These are design defaults and MAY be tuned from measured bandwidth, change rate and desired event-bound width. Returned source cache headers always take precedence.

No numeric official request-rate limit is documented in the current README, so Chronicle MUST avoid treating "no documented limit" as permission for aggressive polling.

## 3. Pipeline

Canonical pipeline:

`schedule -> fetch -> persist fetch metadata -> deduplicate payload -> normalize -> validate -> persist source items -> source-anomaly gate -> identity candidate generation -> identity resolution -> persist canonical observations -> detect observed changes -> aggregate -> derive metrics -> analytical models -> cache invalidation -> share/export`

Each stage MUST be replayable from a durable predecessor whenever practical.

## 4. Endpoint semantic key

Every official-source task has a semantic key:

`source + shard + endpoint_kind + map_name?`

Examples:

- `warapi/live-1/war`
- `warapi/live-1/maps`
- `warapi/live-1/war-report/DeadLandsHex`
- `warapi/live-1/dynamic/DeadLandsHex`
- `warapi/live-1/static/DeadLandsHex`

The endpoint key scopes ETag/cache state. ETags MUST NOT be shared across shards/maps/endpoints.

## 5. Scheduler

Per endpoint state:

- `source_key`
- `shard`
- `endpoint_key`
- `map_name NULL`
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

`max(source_cache_eligibility, chronicle_target_interval, retry_backoff)`

If cache headers are missing/unparseable, use the Chronicle target interval and emit an observability flag.

## 6. Conditional requests and deduplication

Official documentation states that API responses include ETags and supports `If-None-Match` / `304 Not Modified`.

On `304 Not Modified`:

- persist fetch metadata;
- update source health/freshness metadata;
- do not create a duplicate payload;
- do not create a duplicate normalized observation;
- do not rerun normalization unless explicit reprocessing requests it.

On `200`:

1. read response bytes with configured size/time limits;
2. compute SHA-256 over exact raw response bytes;
3. upsert content-addressed payload;
4. record ETag and content hash;
5. if hash is unchanged for the same semantic endpoint, skip fact mutation;
6. if changed, normalize, validate and reconcile.

ETag is a transport/cache validator. SHA-256 is Chronicle's durable payload identity.

Local `captured_at` MUST NOT be the idempotency key.

## 7. Source timestamps and map revisions

War-state timestamps are ingested as raw nullable integers first, then validated/converted to Unix milliseconds according to WAR_API_SEMANTICS.md.

Map payloads preserve:

- raw `lastUpdated`;
- converted `source_map_last_updated_at`;
- raw `version`;
- payload hash.

`lastUpdated` is map-state update metadata, not an item event time.

`version` is a source revision counter, not a timestamp.

A map-version regression is an anomaly and MUST NOT automatically emit rollback events.

## 8. Observation batches

The official API documents no atomic/transactional consistency across endpoints.

A collection cycle MUST therefore be stored as an **observation batch**, not a world snapshot.

`observation_batches` SHOULD contain:

- `id`;
- `source_id`;
- `shard`;
- `war_id NULL`;
- `started_at`;
- `completed_at NULL`;
- `status`;
- `expected_endpoint_count`;
- `successful_endpoint_count`;
- `coverage_ratio`.

Each fetch keeps its own request/completion/source timestamps.

Analytics combining war reports and dynamic maps MUST apply freshness/coverage tolerances rather than assume simultaneity.

## 9. Ingestion job state machine

`ingestion_jobs` states:

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
- `quarantined_source_anomaly`
- `failed_terminal`

Transitions MUST be monotonic for one attempt. Retries create a new attempt linked to the same logical job.

Each attempt records:

- attempt number;
- started/completed timestamps;
- failure class;
- retryability;
- next retry time;
- fetch ID;
- parser/normalizer version;
- worker build/commit identifier.

## 10. Retry policy

Retry only errors classified as transient.

Baseline:

- exponential backoff;
- full jitter;
- bounded maximum delay;
- retry budget per endpoint;
- circuit breaker after repeated source-level failures.

Do not retry immediately:

- deterministic parser/schema validation failures without a new build/config;
- known permanent 4xx responses;
- licensing/policy blocks.

For a map-specific 404, refresh the active map list before deciding whether the map is invalid/retired.

A circuit breaker MUST NOT make the public site unavailable; stale-but-known-good data remains readable with freshness warnings.

## 11. Concurrency

Single-VPS v1 does not require a distributed broker.

The worker SHOULD use PostgreSQL advisory locks or lease rows to ensure one active fetch/derive operation per semantic endpoint/task.

Multiple worker processes MAY be supported later, but correctness MUST not depend on only one process existing.

## 12. Schema drift and forward compatibility

Every JSON payload SHOULD produce a lightweight structural fingerprint.

Source DTOs MUST preserve unknown additive fields where practical.

Closed enums MUST NOT reject future:

- `winner`;
- `teamId`;
- `mapMarkerType`;
- `iconType`;
- flag bits.

Known values are normalized separately; raw source values remain stored.

If required fields disappear, types change incompatibly or structural changes cross a configured severity threshold:

- persist raw fetch metadata/payload if policy permits;
- quarantine normalization;
- alert;
- continue serving last-known-good normalized data;
- do not silently coerce incompatible data.

## 13. Source anomaly detection

Before objective diffing, validate the dynamic payload against recent valid state.

At minimum detect:

- implausible mass disappearance of previously stable public items;
- implausible mass transition to `teamId=NONE`;
- map `version` regression;
- unexpected `regionId` change for the same semantic map endpoint;
- empty/near-empty payload after a previously populated state;
- impossible timestamp regression beyond configured tolerance.

Historical official-repository issue #92 demonstrated a server-restart failure mode that once generated partial dynamic payloads and false event-log churn. Although marked fixed, Chronicle MUST keep this as a golden defensive fixture.

A quarantined source anomaly:

- is retained as fetch/payload evidence;
- does not become current valid objective state;
- does not bound normal ObservedChange intervals;
- is re-evaluated after the next valid sample.

## 14. Raw payload retention

v1 decision:

- fetch metadata: retain indefinitely;
- normalized facts: retain indefinitely;
- aggregates/derived outputs: retain indefinitely subject to algorithm lifecycle;
- changed official raw payloads: retain hot for a bounded period;
- unchanged responses: metadata only;
- historical-import source artifacts: retain immutable manifest and, when permitted, exact imported artifact hash/copy.

Default hot raw retention target SHOULD begin at **30 days** and be revisited after measured storage sizing.

Preferred production storage is content-addressed compressed files on a dedicated persistent filesystem volume, with metadata/hash in PostgreSQL. PostgreSQL JSONB MAY be used for small payloads if measured DB growth remains acceptable.

## 15. Historical import

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

Imported records MUST retain original provenance and resolution class.

## 16. Reconciliation

### 16.1 Objective state

For objective state:

- use only valid, non-quarantined observations;
- identify canonical objective through versioned identity logic;
- compare previous/current normalized state;
- if materially changed, emit `ObservedChange`;
- set interval `(previous_observed_at, current_observed_at]`;
- never infer midpoint/exact event time;
- never substitute map `lastUpdated` for item event time.

### 16.2 Counters

For casualty/enlistment counters:

- increasing value: normal candidate;
- equal value: no delta;
- lower value: correction/reset/anomaly until war-transition/source semantics explain it.

Negative casualty deltas MUST NOT enter normal casualty-rate aggregates.

### 16.3 Enlistments

`totalEnlistments` is stored as map/region scoped.

Even though secondary Foxhole documentation describes it as unique players per map, the official README does not define global uniqueness semantics. Chronicle MUST NOT sum maps and expose the result as global unique players or faction population.

## 17. Objective identity pipeline

Identity resolution is a first-class ingestion stage defined by [OBJECTIVE_IDENTITY.md](./OBJECTIVE_IDENTITY.md).

For each valid changed static/dynamic payload:

1. persist immutable `source_item_observations`;
2. classify raw items through the current taxonomy version;
3. run source-level anomaly checks before item-level state mutation;
4. generate within-war identity candidates;
5. calculate deterministic feature vectors/scores;
6. persist all serious candidates;
7. auto-accept only when score threshold **and** best-vs-second-best ambiguity margin pass;
8. persist ambiguous/unmatched decisions without guessing;
9. materialize `objective_observations` only for accepted resolution decisions;
10. derive state intervals and ObservedChanges from accepted valid observations.

`teamId`, mutable flags and one-sample presence/absence MUST NOT serve as durable identity keys.

A single missing dynamic item does not tombstone or delete a canonical objective.

### 17.1 Matcher reprocessing

Matcher/taxonomy upgrades run against preserved source item observations and produce a new `identity_resolution_version`.

Reprocessing MUST:

- preserve old candidates/decisions;
- generate a diff of reassigned/newly-resolved/newly-ambiguous items;
- identify splits/merges;
- queue targeted recomputation for objective history and dependent metrics;
- preserve canonical permalink continuity through aliases/superseded identities.

### 17.2 Manual review

Ambiguous cases are reviewable without editing raw evidence.

Manual actions are append-only and reversible. Merge/split/reassignment MUST enqueue downstream invalidation/recomputation.

## 18. War lifecycle handling

New war detection is based on official `warId` within shard.

```text
fetch war state
validate warId and source timestamps
current = active Chronicle war for shard

if current is null:
    create/reconcile war(shard, warId)
    start coverage
    refresh map list
    fetch static references for active maps
else if current.source_war_id == warId:
    reconcile mutable war-state fields
else:
    close previous collection coverage at observation boundary
    do not invent missing winner/end timestamps
    create/reconcile new war(shard, warId)
    reset per-war endpoint cache state where appropriate
    refresh map list
    fetch new static references
```

`warNumber` alone MUST NOT trigger a transition.

## 19. Backfill and reprocessing

### Backfill

Adds facts previously absent from a source/import.

### Reprocess

Re-runs normalization/derivation over already captured immutable input using a new parser/algorithm version.

Reprocessing MUST write new versioned derived outputs or atomically supersede old outputs according to metric/model lifecycle rules. It MUST NOT destroy reproducibility.

## 20. Freshness classes

Recommended product freshness states:

- `fresh`: within target interval;
- `delayed`: > 2x expected collection interval;
- `stale`: > configured source-specific stale threshold;
- `unavailable`: no valid data for requested scope.

Every live API response SHOULD expose `data_as_of` and `freshness_state`.

## 21. Observability

Worker MUST emit:

- fetch attempts by source/shard/endpoint/status;
- 200/304 ratio;
- changed-payload ratio;
- bytes fetched/stored;
- last successful fetch;
- source cache wait;
- ingestion lag;
- map version regressions;
- mass-collapse quarantines;
- normalization failures;
- schema-drift quarantines;
- derived-job lag;
- reconciliation anomalies;
- retry/circuit state;
- historical import counts.

## 22. Security boundaries

The ingestion worker MUST use an allowlist of configured upstream hosts.

User input MUST NOT determine arbitrary fetch URLs.

Redirects SHOULD be disabled or revalidated against the allowlist.

Response size/time limits MUST be enforced.

Raw source text MUST be treated as untrusted input before rendering.

## 23. Acceptance criteria

Before backend feature work depends on ingestion:

1. Re-running an unchanged payload produces no duplicate facts.
2. A 304 produces no duplicate observation.
3. ETag is not used as the sole payload/database identity.
4. A worker crash between fetch and normalization can resume safely.
5. Two workers cannot simultaneously mutate the same logical endpoint task.
6. Parser schema drift produces quarantine + alert, not silent corruption.
7. Unknown icon/flag/enum values survive ingestion losslessly.
8. Objective changes are bounded observations, not invented exact timestamps.
9. One malformed/partial dynamic payload cannot create mass false events.
10. A casualty counter decrease does not become a normal negative delta.
11. Region enlistments cannot be exposed as global unique players by summation.
12. A war transition is keyed by shard + warId, not warNumber alone.
13. Cross-endpoint batches retain per-fetch timestamps and do not claim atomicity.
14. Targeted recomputation works after a late correction.
15. Source provenance is queryable for every normalized historical fact.
16. Identity auto-match requires both a versioned score threshold and an ambiguity margin.
17. Matcher thresholds are calibrated from a labeled corpus, not hard-coded from unverified examples.
18. One missing dynamic observation cannot tombstone a canonical identity.
19. Matcher v1/v2 can be replayed and diffed without destroying old evidence.
20. Ambiguous identity observations do not silently enter objective-derived analytics.
