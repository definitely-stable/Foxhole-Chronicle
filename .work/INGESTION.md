# Foxhole Chronicle — Ingestion Architecture

Status: **Authoritative working specification — War API, Time Semantics, collection cadence, storage shape and crash-recovery protocol integrated 2026-09-19**

This document defines current/future data collection, historical imports, retries, replay, reconciliation and raw-data retention. Durable archive/backup/recovery rules are defined in [DATA_LIFECYCLE.md](./DATA_LIFECYCLE.md).

Official source semantics are defined in [WAR_API_SEMANTICS.md](./WAR_API_SEMANTICS.md). Canonical analytical clock rules are defined in [TIME_SEMANTICS.md](./TIME_SEMANTICS.md). Durable idempotency/transaction/crash semantics are defined in [IDEMPOTENCY_RECOVERY.md](./IDEMPOTENCY_RECOVERY.md). The worker MUST NOT invent stronger guarantees.

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

Chronicle is a historical analytics product, not a tactical map.

Accepted collection profile:

`collection_profile_version = chronicle-collection-v1`

| Endpoint | Chronicle v1 target | Rule |
|---|---:|---|
| `/worldconquest/war` | **5 min** | one per shard; lifecycle anchor |
| `/worldconquest/warReport/:map` | **15 min** | per active map, conditional GET |
| `/worldconquest/maps/:map/dynamic/public` | **15 min** | per active map, conditional GET |
| `/worldconquest/maps` | **60 min** | plus immediate transition/reconciliation refresh |
| `/worldconquest/maps/:map/static` | **once per (shard, warId, map)** | additional fetch only for explicit recovery/revalidation |

Returned source cache eligibility always takes precedence over Chronicle's target interval.

v1 uses a **fixed cadence** and has no activity-triggered hot mode. Fixed cadence gives stable coverage semantics and a clean corpus for later 15m -> 30m -> 60m downsampling studies. A short `A -> B -> A` state entirely between baseline polls cannot be recovered later and cannot trigger hot mode.

The scheduler SHOULD deterministically stagger per-map work across each 15-minute window to avoid synchronized bursts. Staggering changes request placement, not the target cadence.

### 2.1 Planning baseline

Capacity planning uses **30 active maps per shard** unless measured runtime count differs.

Regular schedule counts, excluding retries/recovery/static:

- `288` war fetches/day;
- `2,880` warReport fetches/day;
- `2,880` dynamic fetches/day;
- `24` maps fetches/day;
- **6,072 regular requests/day/shard**;
- **2,216,280 regular requests/year/shard**.

A 30-day war produces **182,160 regular requests**, plus about 30 baseline static requests under the 30-map assumption.

These are schedule cardinalities, not guaranteed transferred-payload counts. Conditional requests and 304 responses reduce data transfer and normalization work.

No numeric official request-rate limit is documented in the current README, so Chronicle MUST avoid treating "no documented limit" as permission for aggressive polling.

## 3. Pipeline

Canonical pipeline:

`schedule -> fetch -> persist/durably place raw payload -> persist fetch metadata -> normalize -> validate -> semantic fingerprint/diff -> source-anomaly gate -> persist sparse source-item evidence -> identity candidate generation -> identity resolution -> persist canonical state evidence + outbox -> detect observed changes -> aggregate -> derive metrics -> analytical models -> archive replication/sealing -> cache invalidation -> share/export`

Each stage MUST be replayable from a durable predecessor whenever practical.

## 4. Endpoint semantic key

Every official-source task has a semantic key:

`source + shard + endpoint_kind + map_name? + collection_profile_version`

Examples:

- `warapi/live-1/war`
- `warapi/live-1/maps`
- `warapi/live-1/war-report/DeadLandsHex`
- `warapi/live-1/dynamic/DeadLandsHex`
- `warapi/live-1/static/DeadLandsHex`

The endpoint key scopes ETag/cache state. ETags MUST NOT be shared across shards/maps/endpoints.

## 5. Scheduler

Scheduling/cache eligibility and endpoint execution ownership are persisted in `endpoint_poll_state`, separate from logical `ingestion_jobs` and accepted-state `endpoint_cursors`.

Per endpoint state:

- `source_id`;
- `shard`;
- `endpoint_key`;
- `collection_profile_version`;
- `target_interval_seconds`;
- `next_due_at`;
- `cache_eligible_at`;
- `last_attempt_at`;
- `last_success_at`;
- `etag`;
- `consecutive_failures`;
- `circuit_open_until`;
- `lease_owner_attempt_id`;
- `lease_until`;
- `fence_token`.

The next fetch time SHOULD be:

`max(cache_eligible_at, next_due_at, retry_backoff)`

If cache headers are missing/unparseable, use the active collection profile target and emit an observability flag.

Every fetch MUST retain the collection profile version and target interval that produced it so historical coverage remains interpretable after future cadence changes.

## 6. Conditional requests and deduplication

Official documentation states that API responses include ETags and supports `If-None-Match` / `304 Not Modified`.

On `304 Not Modified`:

- persist fetch metadata;
- update source health/freshness metadata;
- do not create a duplicate payload;
- do not create a duplicate normalized observation;
- do not rerun normalization unless explicit reprocessing requests it;
- link the fetch to the previously accepted representation (`representation_payload_id` or equivalent);
- retain the successful validation instant so coverage logic can extend the validity of that representation without duplicating facts.

On `200`:

1. read response bytes with configured size/time limits;
2. compute SHA-256 over exact raw response bytes;
3. choose payload storage policy (inline or external CAS) without changing payload identity;
4. for external CAS, durably publish the compressed object before PostgreSQL may reference it;
5. execute a short **raw-capture transaction** that persists the stable `source_fetch`, exact inline bytes or external payload reference, representation link, job generation and endpoint fence token;
6. after raw-capture COMMIT, the response has crossed the Chronicle raw-durable boundary;
7. if hash/semantic representation is unchanged for the same semantic endpoint, canonical fact mutation may be skipped while validation/coverage is reconciled;
8. if changed, normalize, validate and execute a separate short canonical reconciliation transaction;
9. write required downstream/outbox jobs in the same PostgreSQL transaction as canonical mutations.

A successful source response MUST NOT depend on a later canonical transaction for its only durable Chronicle copy.

If an external CAS write succeeds but the raw-capture transaction fails, the resulting unreferenced object is harmless and can be garbage-collected after a grace period. The reverse state — committed DB reference to a missing external payload — MUST NOT occur.

If the process crashes after raw-capture COMMIT but before canonical reconciliation, recovery MUST discover the raw-durable fetch and resume/reconcile it rather than refetching merely to reconstruct lost provenance.

ETag is a transport/cache validator. SHA-256 is Chronicle's durable payload identity.

Local `captured_at` MUST NOT be the idempotency key.

v1 MUST NOT use transparent HTTP retries that hide multiple network exchanges behind one provenance record.

The official-source HttpClient SHOULD use Microsoft.Extensions.Http.Resilience through a custom AddResilienceHandler pipeline containing only bounded concurrency/rate limiting, total/per-attempt timeout and circuit breaking. The default standard handler MUST NOT be used unchanged because it contains transparent retry.

Hedging is disabled.

After a failed exchange, retry is represented by a new Chronicle ingestion attempt/fetch scheduled through durable worker state. One audited HTTP exchange remains one source_fetch.

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

## 7.1 War-time anchor reconciliation

War-relative analytics are derived from accepted source-time anchors, not frozen into raw observations.

For each valid war-state observation compare the accepted canonical fields:

- `conquest_start_at`;
- `conquest_end_at`;
- `resistance_start_at`.

If no start exists yet:

- preserve the raw observation;
- mark the war pre-conquest;
- do not assign elapsed-war buckets.

When a valid start first appears:

- set the canonical start;
- increment/create `war_time_revision`;
- classify/recompute eligible observations relative to that anchor;
- initialize war-relative aggregates.

If an accepted start changes:

- persist the new source observation;
- increment `war_time_revision`;
- do not rewrite absolute observation timestamps;
- invalidate every war-relative bucket/model for that war;
- enqueue deterministic recomputation under the new revision.

If end first appears or changes:

- increment `war_time_revision`;
- finalize/recompute conquest duration;
- recompute final-day status and tail buckets;
- update completed-war eligibility and dependent records/models.

A change to `scheduledConquestEndTime` is preserved as source state but does not change elapsed-day mapping by itself.

`dayOfWar` disagreement, jump or regression is diagnostic only and MUST NOT alter canonical war-time anchors.

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

## 9. Durable job / attempt state machine

The normative worker state machine is defined in [IDEMPOTENCY_RECOVERY.md](./IDEMPOTENCY_RECOVERY.md).

Chronicle MUST distinguish:

- one logical collection job from its execution attempts;
- one ingestion attempt from one HTTP fetch/exchange;
- fetch evidence from canonical reconciliation;
- external raw durability from PostgreSQL canonical reconciliation;
- job ownership from endpoint execution/canonical-state fencing.

`ingestion_jobs.lease_generation` protects ownership of one logical job. `endpoint_poll_state.fence_token` protects the right to affect one semantic endpoint. They MUST NOT be treated as the same token.

Logical job states are intentionally small:

- `scheduled`;
- `leased`;
- `retry_wait`;
- `completed`;
- `quarantined`;
- `failed_terminal`.

Claiming a job atomically increments `lease_generation`. That generation fences only the logical job. A worker whose lease generation is no longer current may retain immutable fetch/payload evidence but MUST NOT mutate canonical current state.

Retries create a new `ingestion_attempt` linked to the same logical job. The logical job/reconciliation identity remains stable across retries.

## 10. Transaction boundaries and retry policy

HTTP fetches, compression, external CAS writes/uploads and heavy derivation MUST run outside PostgreSQL transactions.

The normal ingestion path is the same five-phase protocol defined normatively in IDEMPOTENCY_RECOVERY.md:

1. **logical-job claim transaction** — lease the logical job, increment `lease_generation`, create the attempt, commit;
2. **endpoint-ownership transaction** — lock `endpoint_poll_state`, acquire/steal the endpoint lease, increment `fence_token`, bind owner attempt, commit;
3. **HTTP/raw preparation outside PostgreSQL** — perform exactly one audited HTTP exchange for the attempt, read/hash bytes, and durably publish external CAS when used;
4. **raw-capture transaction** — persist/reconcile `source_fetch`, payload metadata/bytes or durable CAS reference, representation link and raw-durable checkpoint, then commit;
5. **canonical reconciliation transaction** — lock `endpoint_poll_state` first and `endpoint_cursors` second, verify both job generation and endpoint fence/owner, load already raw-durable evidence, apply accepted canonical mutation/coverage/state intervals/changes, insert outbox work and the reconciliation-operation ledger, finalize scheduling/outcome, then commit.

The raw-capture and canonical reconciliation transactions are deliberately separate. Canonical reconciliation MUST NOT be the first/only durable Chronicle copy of a successfully received 200 response.

The reconciliation transaction MUST NOT reinsert or recreate fetch/payload evidence that should already be raw-durable; it references/reconciles the committed raw-capture rows.

Default isolation is `READ COMMITTED` with explicit row locking/unique constraints. `SERIALIZABLE` is reserved for rare cross-row invariants that justify it.

Retry the complete transaction for classified transient failures such as PostgreSQL `40001` serialization failures and `40P01` deadlocks. A unique violation is retryable only when the specific constraint is an intentional idempotency arbiter.

A connection loss during `COMMIT` is an **unknown outcome**. For raw capture, reconcile by stable `source_fetch.id` plus payload uniqueness. For canonical reconciliation, reconcile by the deterministic `operation_key` in the reconciliation ledger (and its existing physical operation_id when present). The worker MUST NOT assume rollback and blindly create a new logical identity. PostgreSQL `pg_xact_status(xid8)` MAY supplement this recovery when the transaction XID is available.

Initial worker write transactions SHOULD use `SET LOCAL` timeouts as defined in IDEMPOTENCY_RECOVERY.md and calibrate them under load.

Source/HTTP retries remain bounded exponential backoff with jitter and preserve the same logical job identity. A retry creates a new ingestion attempt and therefore a new audited HTTP exchange/fetch; it does not hide transport retries inside one attempt.

## 11. Concurrency and stale completion

Correctness MUST NOT depend on a single worker process.

Use `ingestion_jobs` leases for logical-job ownership, `endpoint_poll_state` for endpoint execution ownership/fencing, and `endpoint_cursors` only for accepted canonical state.

The reconciliation transaction locks `endpoint_poll_state` first and `endpoint_cursors` second, then verifies both current `job_lease_generation` and the endpoint `fence_token`/owner attempt.

Before HTTP execution, the attempt must also acquire the semantic endpoint lease in `endpoint_poll_state`; acquisition/steal increments the endpoint `fence_token`. Renewal/release requires the same owner attempt and token.

If a slow request completes after its job lease or endpoint fence became stale:

- retain safe immutable evidence;
- classify the attempt `stale_fenced`;
- do not roll canonical state backward;
- do not emit normal current-state changes from that stale completion.

Transaction-level advisory locks MAY be used for coarse resources without a natural row, such as sealing/version activation. Session-level advisory locks are not the durable worker-ownership mechanism.

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

## 14. Raw payload retention and storage shape

v1 separates durable replay evidence from query-oriented relational history. Canonical lifecycle rules are in DATA_LIFECYCLE.md.

### 14.1 Fetch metadata

Fetch/validation metadata is stored in PostgreSQL and retained long-term in v1.

At the 30-map baseline Chronicle schedules about 2.216 million regular fetch interactions/year/shard. This cardinality alone does not justify a compaction subsystem before real table/index growth is measured.

A future compaction policy MAY be added only if measured storage/maintenance cost warrants it and coverage/audit semantics remain reproducible.

### 14.2 Raw payload archive

Unique changed official payloads required to replay Chronicle-collected history SHOULD be retained long-term.

One logical payload abstraction supports two storage kinds:

- **inline** — small exact response bytes in PostgreSQL `bytea`;
- **external_cas** — larger payloads compressed with Zstandard and referenced from PostgreSQL.

Likely v1 defaults are small war/maps/warReport payloads inline and dynamic/static payloads external, but the threshold is implementation/configuration policy calibrated from real payload measurements.

For every storage kind:

- `content_hash` is SHA-256 of exact original response bytes before compression;
- 304 responses create metadata only and reference the previously accepted representation;
- byte-identical 200 responses reuse the existing payload identity;
- moving/recompressing external payloads does not change source identity.

Replay-critical raw payloads may move to colder/offsite storage later, but content identity and replayability MUST survive.

### 14.3 Sparse relational history

PostgreSQL MUST NOT durably expand every unchanged map item occurrence from every changed snapshot merely for replayability.

Relational history SHOULD store:

- map observation/provenance;
- current/canonical state;
- first-seen/material-change/reappearance evidence;
- ambiguous/unmatched/manual-review evidence;
- state intervals;
- observed changes;
- counter observations;
- coverage;
- aggregates/models.

The immutable raw payload archive remains the complete source snapshot evidence.

### 14.4 Raw vs semantic fingerprints

Chronicle keeps:

- `content_hash` — exact response bytes;
- `semantic_fingerprint` — versioned canonical parser-level representation, insensitive to irrelevant ordering/serialization differences.

If exact bytes change but the semantic fingerprint does not, Chronicle may retain provenance/raw evidence while skipping item-level relational mutation.

Semantic fingerprinting MUST NOT depend on canonical objective identity; it is a source-payload normalization concept.

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

## 16.4 Time/bucket reconciliation

All analytical bucket assignment follows TIME_SEMANTICS.md.

### Point observations

A point observation belongs to a conquest bucket only when:

- canonical conquest start exists;
- `observed_at >= conquest_start_at`;
- if conquest end exists, `observed_at < conquest_end_at`.

An instant exactly on a bucket boundary belongs to the new bucket.

### Observed changes

For a change known only in:

`(previous_observed_at, current_observed_at]`

the worker computes:

- earliest possible elapsed day;
- latest possible elapsed day;
- `bucket_assignment_status`.

If the uncertainty interval spans an elapsed-day or other analytical-bucket boundary, the change is `boundary_ambiguous`.

It MUST NOT be assigned to the midpoint or silently attributed to `current_observed_at`'s day as an exact event.

### Cumulative counter deltas

For adjacent valid counter observations:

- non-negative delta within one bucket MAY contribute to that bucket;
- a pair spanning a bucket boundary is marked boundary-ambiguous for per-bucket allocation;
- v1 MUST NOT linearly split the delta across buckets;
- excessive gaps reduce coverage or invalidate the pair according to metric policy.

## 17. Objective identity pipeline

Identity resolution is a first-class ingestion stage defined by [OBJECTIVE_IDENTITY.md](./OBJECTIVE_IDENTITY.md).

For each valid semantically changed static/dynamic payload:

1. persist/retain the immutable raw payload and map observation;
2. materialize only source-item evidence required for first-seen/material-change/reappearance/ambiguity/unmatched/review semantics; unchanged item occurrences need no duplicate relational row;
3. classify current raw items through the current taxonomy version;
4. run source-level anomaly checks before item-level state mutation;
5. generate within-war identity candidates for items requiring resolution/change processing;
6. calculate deterministic feature vectors/scores;
7. persist all serious candidates for material decisions;
8. auto-accept only when score threshold **and** best-vs-second-best ambiguity margin pass;
9. persist ambiguous/unmatched decisions without guessing;
10. materialize canonical state evidence only when needed to establish/alter history;
11. extend unchanged-state coverage from valid snapshot/304 validation rather than duplicate item rows;
12. derive state intervals and ObservedChanges from accepted valid evidence.

`teamId`, mutable flags and one-sample presence/absence MUST NOT serve as durable identity keys.

A single missing dynamic item does not tombstone or delete a canonical objective.

### 17.1 Matcher reprocessing

Matcher/taxonomy upgrades MUST be able to replay preserved raw payload snapshots for the selected war/map/time range and produce a new `identity_resolution_version`. Sparse relational source-item evidence is an optimization/audit index, not the only replay source.

Reprocessing MUST:

- preserve old candidates/decisions;
- generate a diff of reassigned/newly-resolved/newly-ambiguous items;
- identify splits/merges;
- queue targeted recomputation for objective history and dependent metrics;
- preserve canonical permalink continuity through aliases/superseded identities.

### 17.2 Manual review

Ambiguous cases are reviewable without editing raw evidence.

Manual actions are append-only and reversible. Merge/split/reassignment MUST enqueue downstream invalidation/recomputation.

## 17.3 Transactional outbox and downstream work

Chronicle v1 uses PostgreSQL transactional outbox semantics rather than a separate broker.

When normalization/reconciliation commits a canonical mutation, every required downstream job MUST commit in the same PostgreSQL transaction.

Typical jobs include:

- identity/coverage recomputation;
- 15m/1h/1d aggregation;
- analytical model invalidation/recompute;
- external raw-payload replication verification;
- war sealing/export.

Workers claim eligible rows in a **short** transaction using `FOR UPDATE SKIP LOCKED`, set a lease owner/expiry and increment `lease_generation`, then commit before executing the effect.

Outbox delivery is **at-least-once**. If an effect succeeds and the worker crashes before marking the job complete, the same job may run again. Every handler therefore MUST have a deterministic dedup key, naturally idempotent target, conditional create or equivalent effect ledger.

Completion MUST verify the same outbox lease generation so a stale worker cannot acknowledge work after lease steal.

`LISTEN/NOTIFY` MAY be used only as a wake-up optimization; polling the durable table on startup and periodically remains required.

Global ordering is not promised. Revision/input fingerprints make stale derived jobs no-op; any future strict per-scope ordering MUST be explicit rather than inferred from `created_at`.

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

## 18.1 War close and sealing

War transition handling and historical archival are separate states.

When a valid conquest end is first observed, Chronicle marks the war `soft_closed` rather than immediately considering the archive immutable.

After terminal/source transition reconciliation, enqueue a sealing run.

Sealing MUST verify/finalize:

- source coverage/fetch accounting;
- final objective/state intervals;
- final native/15m, 1h and 1d aggregates;
- required metric/model outputs;
- existence/integrity of referenced raw payloads;
- required offsite raw replicas;
- archive artifacts;
- versioned archive manifest.

A successful run creates `sealed` archive revision N.

A later accepted source/time/identity correction creates archive revision N+1; it MUST NOT mutate manifest N in place.

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

Freshness is not the elapsed-war clock. During collector/API downtime the elapsed clock continues while freshness/coverage deteriorate.

## 21. Observability

Worker MUST emit:

- fetch attempts by source/shard/endpoint/status;
- 200/304 ratio;
- changed-payload ratio;
- semantic-changed-payload ratio;
- collection profile version and scheduler lag;
- bytes fetched/stored;
- compressed raw archive bytes/day;
- inline raw payload bytes/day;
- offsite raw-replication lag and verification failures;
- raw payload item-count distribution;
- source-item evidence rows/day;
- PostgreSQL table/index growth by relation;
- WAL bytes/day;
- last successful fetch;
- source cache wait;
- ingestion lag;
- map version regressions;
- mass-collapse quarantines;
- normalization failures;
- schema-drift quarantines;
- outbox depth/oldest age;
- derived-job lag;
- reconciliation anomalies;
- retry/circuit state;
- historical import counts;
- canonical `war_time_revision` changes;
- `dayOfWar` regressions/cross-map disagreement diagnostics;
- boundary-ambiguous observed-change counts;
- boundary-ambiguous counter-delta counts;
- time-bucket recomputation lag.

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
21. A 304 extends validation/coverage evidence without duplicating normalized facts.
22. `dayOfWar` cannot change Chronicle elapsed-day assignment.
23. Exact conquest-end boundaries do not create empty following elapsed days.
24. A conquest-start correction increments `war_time_revision` and triggers war-relative recomputation without rewriting raw timestamps.
25. Boundary-crossing observed changes remain boundary-ambiguous.
26. Counter deltas are not silently interpolated across analytical bucket boundaries.
27. The active collection profile is `chronicle-collection-v1`: war 5m, warReport 15m, dynamic 15m, maps 60m, static once per war/map.
28. Every fetch records collection profile/version and target interval.
29. Scheduler staggers per-map work instead of bursting all 30 maps at the same instant.
30. Replay-critical unique raw payloads remain available long-term.
31. A raw-byte-only change with identical semantic fingerprint does not force item-level mutation.
32. Unchanged map items do not create duplicate relational item rows solely because another snapshot was collected.
33. Identity reprocessing can reconstruct full occurrences from the raw payload archive.
34. Small and large raw payloads share one content-identity contract across inline/external storage.
35. An external payload is durable before its PostgreSQL reference commits.
36. Downstream work required by a canonical mutation is persisted through the transactional outbox in the same transaction.
37. Outbox handlers are idempotent under at-least-once execution.
38. Completed wars pass soft-close/sealing before a sealed archive revision is published.
39. Sealing verifies referenced raw payloads and offsite replicas.
40. A late correction creates a new archive revision rather than rewriting a sealed manifest.
41. Logical job identity is stable across retries; request/capture timestamps are not idempotency keys.
42. Lease generation fences a stale/expired worker from canonical current-state mutation.
43. HTTP/CAS work is outside PostgreSQL transactions; reconciliation is a short explicit transaction.
44. Unknown COMMIT outcome is reconciled by stable operation ID before any retry.
45. Outbox claim transactions do not remain open while handlers execute.
46. A crash after outbox effect success and before completion is safe under handler dedup/idempotency.
47. LISTEN/NOTIFY is never the only durable work signal.
48. Fault-injection tests cover kill -9, connection loss around COMMIT, ENOSPC, stale lease completion and PITR+CAS restore integrity.
