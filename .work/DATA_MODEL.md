# Foxhole Chronicle — Data Model

Status: **Authoritative working specification — War API, Objective Identity, Time Semantics, collection/storage and crash-recovery protocol integrated 2026-09-19**

This document defines the logical data model for Foxhole Chronicle. Official runtime source semantics are defined in [WAR_API_SEMANTICS.md](./WAR_API_SEMANTICS.md). Durable payload/archive/recovery semantics are defined in [DATA_LIFECYCLE.md](./DATA_LIFECYCLE.md). Idempotency, transaction and fencing semantics are defined in [IDEMPOTENCY_RECOVERY.md](./IDEMPOTENCY_RECOVERY.md).

## 1. Core principles

The data model MUST preserve:

`source -> fetch -> observation -> normalized fact -> observed change -> derived metric -> analytical model/result -> share/export`

The model MUST distinguish:

- source-provided values from Chronicle-derived values;
- source time from Chronicle ingestion time;
- exact timestamps from polling-bounded observation intervals;
- current state from historical observations;
- facts from metrics and analytical classifications;
- complete data from partial/low-resolution historical data.

Every durable analytical result MUST be reproducible from versioned inputs and a versioned algorithm.

Durability/control relations such as ingestion jobs/attempts, reconciliation operations, endpoint cursors, outbox jobs, payload metadata and archive revisions MUST be ordinary WAL-logged PostgreSQL tables; they MUST NOT be UNLOGGED.

## 2. Identity conventions

Chronicle uses internal immutable identifiers even when an upstream source provides an identifier.

### 2.0 Chronicle UUID generation

Chronicle-owned UUID identifiers SHOULD use UUIDv7 unless a specific identity has a stronger natural/content-derived representation.

Application-generated IDs use .NET 10 Guid.CreateVersion7 through a project-owned ID factory where useful. PostgreSQL 18 uuidv7() MAY be used for rows created wholly inside the database.

Rules:

- an idempotency/operation ID is generated once and reused for the same logical operation;
- retries MUST NOT regenerate identity merely because UUID generation is cheap;
- UUIDv7 ordering MUST NOT be interpreted as authoritative event time;
- source natural IDs, SHA-256 payload identity and semantic fingerprints remain separate from Chronicle UUID identity.

Append-heavy relations such as fetches, attempts, observations, reconciliation operations and outbox jobs are especially suitable for UUIDv7.

### 2.1 War

`wars`

- `id uuid PK`
- `shard text NOT NULL`
- `source_war_id text NULL`
- `war_number integer NULL`
- `conquest_start_at timestamptz NULL`
- `conquest_end_at timestamptz NULL`
- `resistance_start_at timestamptz NULL`
- `scheduled_conquest_end_at timestamptz NULL`
- `winner text NULL`
- `required_victory_towns integer NULL`
- `short_required_victory_towns integer NULL`
- `status text NOT NULL`
- `war_time_revision integer NOT NULL DEFAULT 0`
- `ruleset_epoch_id uuid NULL`
- `created_at timestamptz NOT NULL`
- `updated_at timestamptz NOT NULL`

Canonical identity is internal `id`.

For official runtime wars, the natural source identity is `(shard, source_war_id)`. The official docs call `warId` unique but do not explicitly define cross-shard/global uniqueness, while `warNumber` is explicitly shard-scoped.

Required partial unique index:

```sql
CREATE UNIQUE INDEX ux_wars_shard_source_war_id
ON wars (shard, source_war_id)
WHERE source_war_id IS NOT NULL;
```

`war_number` MUST NOT be the sole relational key.

### 2.2 Region

`regions`

- `id uuid PK`
- `canonical_key text UNIQUE NOT NULL`
- `display_name text NOT NULL`
- `source_map_name text NULL`
- `active_from timestamptz NULL`
- `active_to timestamptz NULL`

Official `regionId` is source metadata and MUST NOT replace Chronicle `regions.id`.

### 2.3 Objective

Objective identity is defined in [OBJECTIVE_IDENTITY.md](./OBJECTIVE_IDENTITY.md).

## 3. Time semantics

Canonical rules are defined in [TIME_SEMANTICS.md](./TIME_SEMANTICS.md).

Chronicle keeps absolute source/observation time separate from derived war-relative time.

### 3.1 Absolute clocks

- `requested_at`: HTTP request start.
- `completed_at`: HTTP request completion.
- `captured_at`: Chronicle observation time used for normalized state.
- `source_timestamp`: source-provided timestamp only when its semantics are known.
- `source_map_last_updated_at`: map-state update metadata; never an item event timestamp.

Official raw Unix values are preserved as `bigint` before conversion to `timestamptz`.

### 3.2 War-relative clock

Chronicle uses:

`time_semantics_version = elapsed-war-clock@1`

For an instant inside conquest:

`elapsed_war_day = floor((t - conquest_start_at) / 86400s) + 1`

Completed conquest uses the half-open interval:

`[conquest_start_at, conquest_end_at)`

and:

`completed_day_count = ceil((conquest_end_at - conquest_start_at) / 86400s)`

for valid positive duration.

### 3.3 Canonical storage rule

Absolute observation timestamps are canonical raw facts.

`war_elapsed_seconds` and `elapsed_war_day` MAY be stored as denormalized/recomputed fields for query performance, but only together with:

- `time_semantics_version`;
- `war_time_revision`.

If the canonical conquest start changes, old absolute observations remain unchanged and all war-relative denormalized values/buckets are recomputed.

UTC calendar date is presentation/secondary indexing only and MUST NOT define analytical day boundaries.

See [adr/elapsed-war-day-vs-game-day.md](./adr/elapsed-war-day-vs-game-day.md).

## 4. Source and provenance model

### 4.1 Sources

`sources`

- `id uuid PK`
- `key text UNIQUE NOT NULL`
- `source_class text NOT NULL`
- `authority_rank integer NOT NULL`
- `homepage_uri text NULL`
- `runtime_dependency boolean NOT NULL`
- `redistribution_policy text NOT NULL`
- `notes text NULL`

### 4.2 Observation batches

`observation_batches`

- `id uuid PK`
- `source_id uuid FK`
- `shard text NOT NULL`
- `war_id uuid NULL FK`
- `started_at timestamptz NOT NULL`
- `completed_at timestamptz NULL`
- `status text NOT NULL`
- `expected_endpoint_count integer NULL`
- `successful_endpoint_count integer NULL`
- `coverage_ratio numeric NULL`

A batch groups collection work but is **not** an atomic world snapshot.

### 4.3 Durable execution control

`ingestion_jobs` represents one logical collection intent, not one worker attempt.

- `id uuid PK`
- `job_key text UNIQUE NOT NULL`
- `source_id uuid NOT NULL FK`
- `shard text NULL`
- `endpoint_key text NOT NULL`
- `collection_profile_version text NOT NULL`
- `scheduled_for timestamptz NULL`
- `trigger_kind text NULL`
- `trigger_key text NULL`
- `state text NOT NULL` — scheduled/leased/retry_wait/completed/quarantined/failed_terminal
- `next_eligible_at timestamptz NOT NULL`
- `lease_owner text NULL`
- `lease_until timestamptz NULL`
- `lease_generation bigint NOT NULL DEFAULT 0`
- `attempt_count integer NOT NULL DEFAULT 0`
- `last_error_class text NULL`
- `created_at timestamptz NOT NULL`
- `updated_at timestamptz NOT NULL`

`ingestion_attempts` records each worker ownership/execution attempt.

- `id uuid PK`
- `ingestion_job_id uuid NOT NULL FK`
- `attempt_no integer NOT NULL`
- `lease_generation bigint NOT NULL`
- `endpoint_fence_token bigint NULL`
- `worker_id text NOT NULL`
- `state text NOT NULL`
- `started_at timestamptz NOT NULL`
- `raw_durable_at timestamptz NULL`
- `completed_at timestamptz NULL`
- `failure_class text NULL`
- `retryable boolean NULL`
- `worker_build text NOT NULL`

Unique: `(ingestion_job_id, attempt_no)`.

`endpoint_fence_token` is populated only after the attempt acquires endpoint ownership. The semantic endpoint row is resolved from the logical job's source/shard/endpoint/profile key; attempts do not hold a reverse FK to `endpoint_poll_state`, avoiding a cyclic FK with `endpoint_poll_state.lease_owner_attempt_id`.

`raw_durable_at` records the durable checkpoint after the raw-capture transaction commits; it MUST NOT be set merely because an HTTP response was received.

`endpoint_poll_state` owns scheduling/cache eligibility and the **endpoint-level execution fence** for one semantic endpoint. Job ownership and endpoint mutation ownership are separate concerns.

- `id uuid PK`
- `source_id uuid NOT NULL FK`
- `shard text NULL`
- `endpoint_key text NOT NULL`
- `collection_profile_version text NOT NULL`
- `target_interval_seconds integer NOT NULL`
- `next_due_at timestamptz NOT NULL`
- `cache_eligible_at timestamptz NULL`
- `etag text NULL`
- `last_attempt_at timestamptz NULL`
- `last_success_at timestamptz NULL`
- `consecutive_failures integer NOT NULL DEFAULT 0`
- `circuit_open_until timestamptz NULL`
- `lease_owner_attempt_id uuid NULL FK`
- `lease_until timestamptz NULL`
- `fence_token bigint NOT NULL DEFAULT 0`
- `updated_at timestamptz NOT NULL`

Required uniqueness:

~~~sql
UNIQUE NULLS NOT DISTINCT
(source_id, shard, endpoint_key, collection_profile_version)
~~~

PostgreSQL's default UNIQUE semantics treat NULL values as distinct; Chronicle MUST use `NULLS NOT DISTINCT` here because duplicate shardless endpoint rows would create duplicate endpoint fences. Official War API runtime rows always carry a shard; nullable shard exists only for source classes whose semantics are legitimately shardless.

Claiming endpoint execution increments `fence_token` atomically and records the owning attempt. An ingestion job's `lease_generation` protects ownership of that logical job only; it MUST NOT be reused as the endpoint mutation fence.

`endpoint_cursors` is the canonical serialization row for accepted state of one semantic endpoint.

- `id uuid PK`
- `source_id uuid NOT NULL FK`
- `shard text NULL`
- `endpoint_key text NOT NULL`
- `collection_profile_version text NOT NULL`
- `accepted_fetch_id uuid NULL`
- `accepted_payload_id uuid NULL`
- `accepted_semantic_fingerprint char(64) NULL`
- `accepted_source_version bigint NULL`
- `accepted_source_last_updated_at timestamptz NULL`
- `canonical_revision bigint NOT NULL DEFAULT 0`
- `last_validated_at timestamptz NULL`
- `last_changed_at timestamptz NULL`
- `updated_at timestamptz NOT NULL`

Required uniqueness:

~~~sql
UNIQUE NULLS NOT DISTINCT
(source_id, shard, endpoint_key, collection_profile_version)
~~~

The endpoint cursor and endpoint poll-state tables MUST use identical semantic-key null treatment.

`reconciliation_operations` is the idempotency ledger for canonical write transactions.

- `operation_id uuid PK` — physical UUIDv7 row identity
- `operation_key text UNIQUE NOT NULL` — deterministic idempotency identity
- `operation_kind text NOT NULL` — `canonical_ingest` in v1
- `input_fingerprint char(64) NOT NULL`
- `ingestion_attempt_id uuid NOT NULL FK`
- `endpoint_cursor_id uuid NOT NULL FK`
- `fetch_id uuid NULL`
- `job_lease_generation bigint NOT NULL`
- `endpoint_fence_token bigint NOT NULL`
- `outcome text NOT NULL`
- `canonical_revision bigint NULL`
- `postgres_xid xid8 NULL` — optional diagnostic only; concrete mapping may use a supported representation
- `created_at timestamptz NOT NULL`
- `committed_at timestamptz NULL`

For v1 canonical ingestion:

`operation_key = "canonical_ingest:" + fetch_id`

The deterministic `operation_key`, endpoint cursor fence and unique constraints are authoritative for retry/restart reconciliation. Lease/fence values are provenance/authorization checks, not part of operation identity. `input_fingerprint` records the interpretation/version set that actually committed. `operation_id` is physical identity and MUST NOT be the only way to rediscover the same intended operation after process loss. PostgreSQL transaction ID/status is supplemental evidence, not the sole idempotency mechanism.

### 4.4 Fetch metadata

`source_fetches`

- `id uuid PK`
- `batch_id uuid NULL FK`
- `ingestion_attempt_id uuid NOT NULL FK`
- `source_id uuid FK`
- `shard text NULL`
- `endpoint_key text NOT NULL`
- `map_name text NULL`
- `collection_profile_version text NOT NULL`
- `target_interval_seconds integer NULL`
- `scheduled_for timestamptz NULL`
- `request_uri_redacted text NOT NULL`
- `requested_at timestamptz NOT NULL`
- `completed_at timestamptz NULL`
- `http_status integer NULL`
- `etag text NULL`
- `cache_control text NULL`
- `source_last_modified text NULL`
- `source_timestamp timestamptz NULL`
- `content_hash char(64) NULL`
- `payload_id uuid NULL` — physical payload received on this fetch; null for 304
- `representation_payload_id uuid NULL` — payload representation validated by this fetch; points to prior payload on 304
- `schema_fingerprint text NULL`
- `job_lease_generation bigint NOT NULL`
- `endpoint_fence_token bigint NOT NULL`
- `transport_attempt_no integer NOT NULL DEFAULT 1`
- `outcome text NOT NULL`
- `error_code text NULL`

A fetch is one HTTP interaction. v1 enforces `UNIQUE (ingestion_attempt_id)`: one ingestion attempt performs at most one audited HTTP exchange. A source retry creates a new attempt/fetch under the same logical job.

A `304` MUST NOT create a duplicate normalized observation, but SHOULD reference the previously accepted representation through `representation_payload_id` so coverage can use the validation instant. Request/capture timestamps are evidence, not idempotency keys.

A successful HTTP response that Chronicle intends to preserve crosses the **raw-durable boundary** when its `source_fetches` evidence and exact `source_payloads` reference/bytes have committed in a short raw-capture transaction. Canonical normalization/reconciliation happens in a later short transaction. This prevents a Worker crash after receiving a transient response from erasing the only Chronicle copy of that source state.

The relationship is one-way: a fetch has at most one v1 `canonical_ingest` reconciliation operation, enforced by deterministic `operation_key`. Later explicit reprocessing may reference the same fetch through its own versioned run/evidence records. `reconciliation_operations.fetch_id` owns the canonical-ingest linkage; `source_fetches` MUST NOT hold a back-reference to one reconciliation operation.

### 4.5 Raw payloads

`source_payloads` is one logical exact-payload abstraction with hybrid physical storage.

- `id uuid PK`
- `source_id uuid FK`
- `content_hash char(64) NOT NULL`
- `encoding text NOT NULL`
- `storage_kind text NOT NULL` — `inline` or `external_cas`
- `inline_bytes bytea NULL` — exact original response bytes
- `compression text NULL` — external storage compression, normally `zstd`
- `storage_ref text NULL`
- `size_bytes bigint NOT NULL` — original bytes
- `stored_size_bytes bigint NULL`
- `first_seen_at timestamptz NOT NULL`
- `last_seen_at timestamptz NOT NULL`

Unique: `(source_id, content_hash)`.

Constraints:

- `storage_kind=inline` -> `inline_bytes IS NOT NULL` and `storage_ref IS NULL`;
- `storage_kind=external_cas` -> `storage_ref IS NOT NULL` and `inline_bytes IS NULL`.

`content_hash` is SHA-256 of the exact original response bytes before compression.

Storage kind is an implementation concern and MUST NOT change payload identity.

Default v1 policy is measurement-driven: small war/maps/warReport responses are candidates for inline storage; dynamic/static and oversized responses are candidates for external CAS.

ETag is metadata/transport validation, not payload identity. Replay-critical unique payloads are retained long-term.

## 5. Official source observations

### 5.1 War observations

`war_observations`

- `id uuid PK`
- `war_id uuid FK`
- `source_fetch_id uuid FK`
- `captured_at timestamptz NOT NULL`
- `source_war_id_raw text NOT NULL`
- `war_number_raw integer NOT NULL`
- `winner_raw text NOT NULL`
- `conquest_start_time_raw bigint NULL`
- `conquest_end_time_raw bigint NULL`
- `resistance_start_time_raw bigint NULL`
- `scheduled_conquest_end_time_raw bigint NULL`
- `required_victory_towns_raw integer NULL`
- `short_required_victory_towns_raw integer NULL`
- `war_elapsed_seconds bigint NULL` — denormalized/recomputable
- `elapsed_war_day integer NULL` — denormalized/recomputable
- `time_semantics_version text NULL`
- `war_time_revision integer NULL`
- `normalizer_version text NOT NULL`
- `quality_flags jsonb NOT NULL DEFAULT '{}'`

War timestamps are converted only after millisecond-range validation.

### 5.2 Region war-report observations

`region_observations`

- `id uuid PK`
- `war_id uuid FK`
- `region_id uuid FK`
- `source_fetch_id uuid FK`
- `captured_at timestamptz NOT NULL`
- `war_elapsed_seconds bigint NULL` — denormalized/recomputable
- `elapsed_war_day integer NULL` — denormalized/recomputable
- `time_semantics_version text NULL`
- `war_time_revision integer NULL`
- `warden_casualties bigint NULL`
- `colonial_casualties bigint NULL`
- `region_enlistments bigint NULL`
- `day_of_war_raw integer NULL`
- `normalizer_version text NOT NULL`
- `quality_flags jsonb NOT NULL DEFAULT '{}'`

`region_enlistments` is map/region scoped. It MUST NOT be exposed as globally unique player count by summing regions.

The official README does not document casualty/enlistment monotonicity guarantees; decreases are reconciliation anomalies until classified.

### 5.3 Map payload observations

`map_observations`

- `id uuid PK`
- `war_id uuid FK`
- `region_id uuid FK`
- `source_fetch_id uuid FK`
- `map_kind text NOT NULL` — static or dynamic_public
- `captured_at timestamptz NOT NULL`
- `source_region_id integer NULL`
- `source_map_version bigint NULL`
- `source_map_last_updated_raw bigint NULL`
- `source_map_last_updated_at timestamptz NULL`
- `scorched_victory_towns integer NULL`
- `content_hash char(64) NOT NULL`
- `semantic_fingerprint char(64) NOT NULL`
- `semantic_fingerprint_version text NOT NULL`
- `normalizer_version text NOT NULL`
- `validation_state text NOT NULL`
- `quality_flags jsonb NOT NULL DEFAULT '{}'`

Recommended uniqueness:

`(source_fetch_id, normalizer_version, semantic_fingerprint_version)`

`content_hash` identifies exact payload bytes, not a temporal observation. A repeated state sequence such as `A -> B -> A` MUST create three temporal observations even though the first and third observations may reference the same deduplicated payload/hash. Sequential unchanged validations such as `A -> A` do not require a duplicate normalized observation.

A source map `version` is preserved but is not assumed globally unique across wars/maps.

### 5.4 Payload replicas

`payload_replicas` tracks independent copies of replay-critical external payloads.

- `id uuid PK`
- `source_payload_id uuid NOT NULL FK`
- `replica_kind text NOT NULL` — local/offsite
- `storage_ref text NOT NULL`
- `state text NOT NULL` — pending/uploaded/verified/failed/evicted
- `uploaded_at timestamptz NULL`
- `verified_at timestamptz NULL`
- `last_error_code text NULL`
- `created_at timestamptz NOT NULL`
- `updated_at timestamptz NOT NULL`

Unique SHOULD prevent duplicate active replica identities for the same payload/destination.

Offsite verification MUST validate the original uncompressed `content_hash`.

## 6. Objective state and change history

### 6.1 Objective identities and revisions

`objective_identities`, `objective_revisions`, and `objective_aliases` are defined in OBJECTIVE_IDENTITY.md.

Canonical identity rows are durable. Matcher upgrades MUST NOT rewrite raw evidence or physically delete superseded canonical identities.

### 6.2 Source item evidence

`source_item_observations` is retained as the table name for compatibility, but it is a **sparse materialized evidence index**, not a complete expansion of every item occurrence in every snapshot.

The complete immutable occurrence evidence is the archived raw payload referenced by `map_observations`.

Persist a relational row when an item occurrence is needed to anchor:

- first-seen state;
- material semantic state/identity change;
- reappearance;
- ambiguity/unmatched resolution;
- manual review;
- matcher/reprocessing decision evidence.

Fields:

- `id uuid PK`
- `map_observation_id uuid NOT NULL FK`
- `source_payload_id uuid NOT NULL FK`
- `war_id uuid NOT NULL FK`
- `region_id uuid NOT NULL FK`
- `source_map_name text NOT NULL`
- `source_item_kind text NOT NULL`
- `evidence_reason text NOT NULL`
- `source_occurrence_no integer NOT NULL` — Chronicle-assigned 0-based occurrence number within one payload/source_item_kind
- `source_array_ordinal integer NULL` — optional raw/original array position evidence
- `icon_type_raw integer NULL`
- `team_id_raw text NULL`
- `flags_raw bigint NULL`
- `x numeric NOT NULL`
- `y numeric NOT NULL`
- `text_raw text NULL`
- `map_marker_type_raw text NULL`
- `raw_item_hash char(64) NOT NULL`
- `taxonomy_version text NOT NULL`
- `normalized_family text NULL`
- `created_at timestamptz NOT NULL`

Required uniqueness:

`(map_observation_id, source_item_kind, source_occurrence_no, evidence_reason)`

The parser MUST deterministically assign `source_occurrence_no` while traversing the immutable payload. It is deliberately payload-local and may change between two source payloads because upstream array ordering is not a stable cross-observation identity.

`source_array_ordinal`, when retained, is raw/original payload evidence only. Neither ordinal participates in canonical objective matching across observations. Two byte/field-identical occurrences in one payload remain distinct because they have different `source_occurrence_no` values.

Source occurrence identity and canonical objective identity are separate concepts.

An unchanged item present in another valid snapshot MUST NOT create a new row solely because another poll occurred. Its continued state/coverage is represented through valid map snapshot/304 coverage evidence.

Full matcher replay reconstructs item occurrences from archived raw payloads.

### 6.3 Identity match runs, candidates and decisions

`identity_match_runs`

- `id uuid PK`
- `matcher_version text NOT NULL`
- `taxonomy_version text NOT NULL`
- `resolution_scope text NOT NULL`
- `war_id uuid NULL FK`
- `input_fingerprint char(64) NOT NULL`
- `parameters jsonb NOT NULL`
- `status text NOT NULL`
- `started_at timestamptz NOT NULL`
- `completed_at timestamptz NULL`

`identity_candidates`

- `id uuid PK`
- `match_run_id uuid NOT NULL FK`
- `source_item_observation_id uuid NOT NULL FK`
- `candidate_objective_id uuid NOT NULL FK`
- `candidate_revision_id uuid NULL FK`
- `rank integer NOT NULL`
- `distance numeric NULL`
- `feature_vector jsonb NOT NULL`
- `score numeric NOT NULL`
- `family_compatible boolean NOT NULL`
- `within_acceptance_radius boolean NOT NULL`

Unique:

`(match_run_id, source_item_observation_id, candidate_objective_id)`

`identity_match_decisions`

- `id uuid PK`
- `match_run_id uuid NOT NULL FK`
- `source_item_observation_id uuid NOT NULL FK`
- `resolved_objective_id uuid NULL FK`
- `resolved_revision_id uuid NULL FK`
- `decision text NOT NULL`
- `best_score numeric NULL`
- `second_best_score numeric NULL`
- `ambiguity_margin numeric NULL`
- `decision_reason jsonb NOT NULL`
- `effective_resolution_version text NOT NULL`
- `created_at timestamptz NOT NULL`

Decision values include `accepted_auto`, `accepted_manual`, `ambiguous`, `unmatched`, `rejected`, and `superseded`.

`identity_manual_overrides` is append-only and stores reversible reviewer decisions, previous decision linkage, replacement objective/revision, actor, reason and timestamps.

### 6.4 Objective observations

`objective_observations`

- `id uuid PK`
- `war_id uuid FK`
- `objective_id uuid FK`
- `objective_revision_id uuid FK`
- `source_fetch_id uuid FK`
- `map_observation_id uuid FK`
- `source_item_observation_id uuid NOT NULL FK`
- `identity_match_decision_id uuid NOT NULL FK`
- `identity_resolution_version text NOT NULL`
- `observed_at timestamptz NOT NULL`
- `team_state_raw text NULL`
- `team_state_normalized text NULL`
- `icon_type_raw integer NOT NULL`
- `flags_raw bigint NOT NULL`
- `known_flags jsonb NOT NULL`
- `x numeric NOT NULL`
- `y numeric NOT NULL`
- `raw_state_hash char(64) NOT NULL`
- `identity_algorithm_version text NOT NULL`
- `match_method text NOT NULL`
- `match_score numeric NULL`
- `ambiguity_margin numeric NULL`
- `quality_flags jsonb NOT NULL DEFAULT '{}'`

Unknown icon codes and flag bits MUST survive losslessly.

`objective_observations` is also sparse canonical evidence: it is not required on every poll when the accepted objective state is unchanged. State continuity/coverage may be extended by valid snapshot/304 evidence.

### 6.5 Objective state intervals

`objective_state_intervals`

- `id uuid PK`
- `objective_id uuid NOT NULL FK`
- `war_id uuid NOT NULL FK`
- `identity_resolution_version text NOT NULL`
- `state_version text NOT NULL`
- `owner_state text NULL`
- `state_payload jsonb NOT NULL`
- `first_observed_at timestamptz NOT NULL`
- `last_observed_at timestamptz NOT NULL`
- `next_state_first_observed_at timestamptz NULL`
- `sequence_range tstzrange GENERATED ALWAYS AS (tstzrange(first_observed_at, next_state_first_observed_at, '[)')) STORED`
- `coverage_ratio numeric NULL`
- `quality_class text NOT NULL`
- `created_at timestamptz NOT NULL`

Required checks:

~~~text
first_observed_at <= last_observed_at
next_state_first_observed_at IS NULL
  OR last_observed_at < next_state_first_observed_at
~~~

`sequence_range` is a **structural chronology range**, not a claim that the owner/state was continuously known throughout that entire range. The uncertain tail between `last_observed_at` and a different next state remains governed by replay/change uncertainty semantics.

PostgreSQL 18 migration baseline:

~~~sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

UNIQUE (
    objective_id,
    war_id,
    identity_resolution_version,
    state_version,
    sequence_range WITHOUT OVERLAPS
)
~~~

This enforces non-overlapping accepted interval chronology for one objective/version, including at most one open-ended interval. It does not convert polling gaps into confirmed truth.

### 6.6 Observed changes

`observed_changes`

- `id uuid PK`
- `war_id uuid FK`
- `region_id uuid FK`
- `objective_id uuid NULL FK`
- `change_type text NOT NULL`
- `previous_observed_at timestamptz NOT NULL`
- `current_observed_at timestamptz NOT NULL`
- `detected_at timestamptz NOT NULL`
- `previous_state jsonb NULL`
- `current_state jsonb NULL`
- `previous_map_observation_id uuid NULL FK`
- `current_map_observation_id uuid NULL FK`
- `detector_version text NOT NULL`
- `identity_resolution_version text NULL`
- `time_semantics_version text NOT NULL`
- `war_time_revision integer NOT NULL`
- `earliest_possible_elapsed_day integer NULL`
- `latest_possible_elapsed_day integer NULL`
- `bucket_assignment_status text NOT NULL`
- `coverage_ratio numeric NULL`
- `confidence_class text NOT NULL`
- `quality_flags jsonb NOT NULL DEFAULT '{}'`

Chronicle MUST NOT assign an exact in-game event timestamp when the source only proves a change in `(previous_observed_at, current_observed_at]`.

Quarantined map observations MUST NOT be used as normal event bounds.

### 6.7 Replay read model

War Replay is a read projection over existing canonical history. v1 MUST NOT introduce a second replay truth store.

Replay uses:

- objective identities/revisions for canonical identity/static context;
- objective_observations for accepted observed states/positions;
- objective_state_intervals for sparse state continuity;
- observed_changes for bounded transition intervals;
- coverage_segments for confidence/availability;
- war/map observations and raw evidence for traceability/reprocessing.

Replay returns an observed state value separately from an evidence class.

Baseline `replayEvidenceClass` values for selected instant `at`:

- `observed_exact` — `at` is an accepted observation/representation-validation checkpoint for that state;
- `supported_continuity` — valid bracketing evidence supports the same accepted state and the coverage policy considers the interval usable, while transient unobserved changes still cannot be ruled out;
- `transition_uncertain` — valid bounding evidence has different states and `previous_observed_at < at < current_observed_at`;
- `last_known` — there is no later valid bound yet, but a previous accepted state remains within the endpoint's documented freshness horizon;
- `no_coverage` — Chronicle lacks sufficient accepted evidence for the selected instant.

At exactly `previous_observed_at`, the previous state is `observed_exact`. At exactly `current_observed_at`, the current state is `observed_exact`. The open interior between different-state endpoints is `transition_uncertain`.

`supported_continuity` means "the accepted representation/state was consistently supported by Chronicle's samples", not "Chronicle proved nothing changed between samples". A hidden A -> B -> A transition may exist entirely between same-state polls.

`last_known` MUST carry age/freshness metadata and MUST become `no_coverage` after the configured evidence horizon. These classes express Chronicle's observed-history model, not omniscient game truth.

The replay API SHOULD compute baseline state from canonical intervals/changes first.

Chronicle MUST NOT pre-materialize a full map snapshot for every poll solely for Replay. If profiling later shows replay-state seeks are too expensive, a sparse checkpoint/read-model table MAY be added by ADR. Any checkpoint remains rebuildable from canonical observations/state intervals/changes and MUST carry source/data/identity/time revision metadata.

Recommended additional replay-query indexes SHOULD be validated by EXPLAIN/pg_stat_statements before adoption. Likely candidates include:

- `objective_state_intervals (war_id, first_observed_at, next_state_first_observed_at)`;
- `observed_changes (war_id, previous_observed_at, current_observed_at)`;
- `objective_observations (war_id, observed_at, objective_id)`.

Replay data semantics are defined in [CORE_WAR_EXPERIENCE.md](./CORE_WAR_EXPERIENCE.md).

## 7. Coverage

`coverage_segments`

- `id uuid PK`
- `scope_type text NOT NULL`
- `scope_id uuid NOT NULL`
- `source_id uuid NULL`
- `metric_key text NULL`
- `from_at timestamptz NOT NULL`
- `to_at timestamptz NOT NULL`
- `expected_samples bigint NULL`
- `actual_samples bigint NULL`
- `coverage_ratio numeric NULL`
- `resolution_class text NOT NULL`
- `collection_profile_version text NULL`
- `expected_interval_seconds integer NULL`
- `time_alignment_class text NULL`
- `quality_class text NOT NULL`
- `recorded_since_label text NULL`

Recommended resolution classes:

- `chronicle_high_frequency`
- `imported_time_series`
- `daily_aggregate`
- `final_aggregate`
- `unknown`

Coverage MUST be returned by analytical APIs when it materially affects interpretation.

## 8. Aggregate tables

Chronicle SHOULD use explicit aggregate tables rather than hiding core analytics in opaque materialized views.

### 8.1 War buckets

`war_time_buckets`

- `war_id`
- `bucket_start timestamptz`
- `bucket_end_exclusive timestamptz`
- `bucket_width`
- `elapsed_war_day integer NULL`
- `day_status text NULL`
- `day_span_fraction numeric NULL`
- casualty cumulative values
- observed casualty deltas
- boundary-ambiguous delta metadata
- casualty rates
- exact-bucket objective change counts
- boundary-ambiguous objective change counts
- active-region counts
- coverage metrics
- `time_semantics_version text NOT NULL`
- `war_time_revision integer NOT NULL`
- `aggregate_version`
- `input_fingerprint char(64)`

Unique SHOULD include the time revision:

`(war_id, bucket_start, bucket_width, time_semantics_version, war_time_revision, aggregate_version)`.

### 8.2 Region buckets

`region_time_buckets`

Same pattern with `region_id`.

Aggregation rules are metric-specific and defined in METRICS.md.

## 9. Metric registry

`metric_definitions`

- `id uuid PK`
- `metric_key text NOT NULL`
- `version integer NOT NULL`
- `unit text NOT NULL`
- `scope text NOT NULL`
- `description text NOT NULL`
- `formula_spec jsonb NOT NULL`
- `required_inputs jsonb NOT NULL`
- `aggregation_rule text NOT NULL`
- `minimum_coverage numeric NOT NULL`
- `algorithm_hash char(64) NOT NULL`
- `status text NOT NULL`

Unique: `(metric_key, version)`.

`metric_values`

- `metric_definition_id uuid FK`
- scope identifiers
- period boundaries
- `value numeric/jsonb`
- `sample_count bigint`
- `coverage_ratio numeric`
- `quality_class text`
- `computed_at timestamptz`
- `input_fingerprint char(64)`

## 10. Analytical models

### 10.1 War feature vectors

`war_feature_vectors`

- `war_id uuid`
- `model_key text`
- `model_version integer`
- `reference_cohort_key text`
- `as_of_elapsed_seconds bigint NULL`
- `features jsonb NOT NULL`
- `normalized_features jsonb NOT NULL`
- `coverage jsonb NOT NULL`
- `input_fingerprint char(64)`
- `computed_at timestamptz`

### 10.2 Similarity

`similarity_models`

- `model_key`
- `version`
- `feature_schema jsonb`
- `normalization_spec jsonb`
- `distance_spec jsonb`
- `weights jsonb`
- `minimum_coverage`
- `algorithm_hash`

`war_similarity_results`

- `subject_war_id`
- `candidate_war_id`
- `model_key`
- `model_version`
- `as_of_elapsed_seconds`
- `distance numeric`
- `similarity_score numeric`
- `coverage_ratio numeric`
- `explanation jsonb`
- `input_fingerprint`

### 10.3 War DNA

`war_dna_results`

- `war_id`
- `dna_version`
- `reference_cohort_key`
- `as_of_elapsed_seconds NULL`
- `dimensions jsonb`
- `percentiles jsonb`
- `coverage jsonb`
- `input_fingerprint`

### 10.4 Phases

`war_phase_segments`

- `war_id`
- `phase_model_version`
- `phase_key`
- `from_elapsed_seconds`
- `to_elapsed_seconds NULL`
- `label`
- `input_signals jsonb`
- `classification_evidence jsonb`
- `coverage_ratio`
- `input_fingerprint`

### 10.5 Swing windows

`war_swing_windows`

- `war_id`
- `swing_model_version`
- `from_elapsed_seconds`
- `to_elapsed_seconds`
- `start_state_index`
- `end_state_index`
- `magnitude`
- `direction`
- `recovered_previous_range boolean`
- `coverage_ratio`
- `evidence jsonb`

These entities are specified in ANALYTICS.md.

## 10.6 Transactional outbox

`outbox_jobs`

- `id uuid PK`
- `job_kind text NOT NULL`
- `dedup_key text NOT NULL`
- `ordering_key text NULL`
- `aggregate_type text NULL`
- `aggregate_id uuid NULL`
- `input_fingerprint char(64) NULL`
- `payload jsonb NOT NULL`
- `state text NOT NULL` — pending/processing/retry/completed/dead
- `priority integer NOT NULL DEFAULT 0`
- `available_at timestamptz NOT NULL`
- `lease_owner text NULL`
- `lease_until timestamptz NULL`
- `lease_generation bigint NOT NULL DEFAULT 0`
- `attempt_count integer NOT NULL DEFAULT 0`
- `max_attempts integer NOT NULL`
- `last_error_class text NULL`
- `created_at timestamptz NOT NULL`
- `updated_at timestamptz NOT NULL`
- `completed_at timestamptz NULL`

Unique: `(job_kind, dedup_key)`.

Outbox rows required by a canonical state mutation MUST be inserted in the same PostgreSQL transaction as that mutation.

Claim transactions use row locking/`FOR UPDATE SKIP LOCKED`, set a lease and increment `lease_generation`, then commit before the handler executes. Completion requires the same generation.

Outbox execution is at-least-once. External effects therefore require deterministic deduplication/natural idempotency. `LISTEN/NOTIFY` is wake-up only.

### 10.7 Reprocessing runs

`reprocessing_runs`

- `id uuid PK`
- `scope_type text NOT NULL`
- `scope_id uuid NOT NULL`
- `input_fingerprint char(64) NOT NULL`
- `version_set jsonb NOT NULL`
- `run_key text UNIQUE NOT NULL`
- `state text NOT NULL` — pending/running/completed/failed/superseded
- `lease_generation bigint NOT NULL DEFAULT 0`
- `started_at timestamptz NULL`
- `completed_at timestamptz NULL`
- `created_at timestamptz NOT NULL`

A completed reprocessing output is activated separately in one short fenced transaction. Old versioned outputs remain reproducible.

## 11. Ruleset epochs

`ruleset_epochs`

- `id uuid PK`
- `key text UNIQUE`
- `from_war_number integer NULL`
- `to_war_number integer NULL`
- `from_at timestamptz NULL`
- `to_at timestamptz NULL`
- `evidence jsonb`
- `notes text`

Historical comparison SHOULD avoid normalizing across materially incompatible rulesets without an explicit model policy.

## 12. Share and export model

### 12.1 Share snapshots

`share_snapshots`

- `id uuid PK`
- `share_kind text`
- `canonical_route text`
- `canonical_state jsonb`
- `snapshot_mode text`
- `algorithm_versions jsonb`
- `time_semantics_version text NULL`
- `war_time_revisions jsonb NULL`
- `input_fingerprint char(64) NULL`
- `created_at timestamptz`
- `expires_at timestamptz NULL`

### 12.2 Export manifests

`export_manifests`

- `id uuid PK`
- `dataset_key text`
- `schema_version integer`
- `format text`
- `filters jsonb`
- `source_policy_version text`
- `generated_at timestamptz`
- `row_count bigint`
- `content_hash char(64)`
- `storage_ref text NULL`
- `license_notice text`

### 12.3 War archive revisions

`war_archive_revisions`

- `id uuid PK`
- `war_id uuid NOT NULL FK`
- `revision integer NOT NULL`
- `state text NOT NULL` — sealing/sealed/failed/superseded
- `collection_profile_version text NOT NULL`
- `time_semantics_version text NOT NULL`
- `war_time_revision integer NOT NULL`
- `identity_resolution_version text NULL`
- `sealing_run_id uuid NOT NULL`
- `lease_generation bigint NOT NULL DEFAULT 0`
- `input_fingerprint char(64) NOT NULL`
- `manifest_hash char(64) NULL`
- `manifest_payload jsonb NULL`
- `started_at timestamptz NOT NULL`
- `sealed_at timestamptz NULL`

Unique: `(war_id, revision)`.

Only one active sealing run may own a war/revision fence. A sealed manifest is immutable. Accepted late corrections create a new archive revision.

### 12.4 Archive artifacts

`archive_artifacts`

- `id uuid PK`
- `war_archive_revision_id uuid NOT NULL FK`
- `artifact_kind text NOT NULL` — parquet/csv/manifest/other
- `schema_version integer NULL`
- `content_hash char(64) NOT NULL`
- `storage_ref text NOT NULL`
- `size_bytes bigint NOT NULL`
- `compression text NULL`
- `created_at timestamptz NOT NULL`

Recommended uniqueness: `(war_archive_revision_id, artifact_kind, content_hash)`.

Parquet artifacts are analytical projections and MUST NOT replace raw payload evidence.

## 13. Index strategy

v1 starts without table partitioning unless measured evidence justifies it.

Initial B-tree indexes SHOULD cover:

- `war_observations (war_id, captured_at)`
- `region_observations (war_id, region_id, captured_at)`
- `map_observations (war_id, region_id, map_kind, captured_at)`
- `source_item_observations (war_id, region_id, normalized_family)`
- `source_item_observations (source_payload_id, evidence_reason)`
- `source_item_observations (map_observation_id, raw_item_hash)`
- `identity_candidates (source_item_observation_id, score DESC)`
- `identity_match_decisions (source_item_observation_id, effective_resolution_version)`
- `identity_manual_overrides (objective_id, created_at DESC)`
- `objective_observations (war_id, objective_id, observed_at)`
- `objective_state_intervals (objective_id, war_id, first_observed_at)`
- `observed_changes (war_id, current_observed_at)`
- `observed_changes (objective_id, current_observed_at)`
- replay-specific interval indexes only after measured query plans justify them
- `war_time_buckets (war_id, bucket_width, bucket_start)`
- `region_time_buckets (war_id, region_id, bucket_width, bucket_start)`
- `source_fetches (source_id, shard, endpoint_key, requested_at DESC)`
- `ingestion_jobs (state, next_eligible_at)`
- `ingestion_jobs (source_id, shard, endpoint_key, scheduled_for)`
- `ingestion_attempts (ingestion_job_id, attempt_no)`
- `endpoint_poll_state (source_id, shard, endpoint_key, collection_profile_version)`
- `endpoint_poll_state (next_due_at)`
- `endpoint_cursors (source_id, shard, endpoint_key, collection_profile_version)`
- `reconciliation_operations (fetch_id, created_at DESC)`
- `reconciliation_operations (ingestion_attempt_id, created_at DESC)`
- `outbox_jobs (state, available_at, priority DESC)`
- `outbox_jobs (job_kind, dedup_key)`
- `payload_replicas (state, updated_at)`
- `war_archive_revisions (war_id, revision DESC)`

BRIN MAY be added for very large append-mostly timestamp columns after measured benefit.

## 14. Retention

Normalized facts, aggregates, provenance and analytical outputs SHOULD be retained indefinitely unless legal/source policy requires otherwise.

Replay-critical unique raw source payloads are retained long-term according to DATA_LIFECYCLE.md. Small payloads may remain inline; external payloads may move between local/offsite tiers without changing content identity.

## 15. Migration rules

EF Core migrations SHOULD own application relational schema.

Hand-written SQL migrations MAY be used for indexes, generated columns, specialized constraints and performance structures clearer outside EF abstractions.

Every migration MUST be tested against a production-like PostgreSQL container and have a documented rollback/forward-fix strategy.

## 16. Non-negotiable invariants

1. No exact event timestamp may be invented from polling.
2. Map `lastUpdated` is not an item event timestamp.
3. No global unique-player count may be produced from region-scoped enlistment values by summation.
4. `warNumber` is not a canonical war key.
5. Official facts are always shard-scoped.
6. No objective identity may depend on upstream array order.
7. A hash of mutable source fields is not a canonical objective ID.
8. Identity candidates, decisions and manual overrides are versioned/auditable.
9. Matcher reprocessing MUST preserve immutable source evidence and previous resolution history.
10. Unknown icon/enum/flag values are preserved losslessly.
11. Quarantined or ambiguous source observations do not become normal canonical state without an accepted resolution.
12. No derived value exists without algorithm/version identity.
13. No local timezone, UTC calendar midnight or raw `dayOfWar` may define Chronicle elapsed-day buckets.
14. Conquest end is exclusive for conquest-day assignment; an exact 24-hour end boundary does not create an empty next day.
15. War-relative denormalized values are invalid without matching `time_semantics_version` and `war_time_revision`.
16. No analytical result hides inadequate source or identity coverage.
17. No historical import erases original provenance.
18. No share/export silently changes semantics after an algorithm/version or war-time-revision change.
19. Collection profile/version is persisted with fetch/coverage evidence.
20. Raw `content_hash` and semantic snapshot fingerprint are distinct identities.
21. Full raw snapshot evidence is replayable without requiring one PostgreSQL row per unchanged source item occurrence.
22. Relational source-item/objective observations are sparse semantic evidence, not polling-frequency duplicates.
23. Payload storage kind cannot change source content identity.
24. External payload DB references require a durable payload object before commit.
25. Outbox work required by a canonical mutation commits atomically with that mutation.
26. A sealed archive manifest is immutable within its archive revision.
27. Disaster recovery is incomplete when restored PostgreSQL references missing external replay payloads.
28. Logical job, attempt, fetch and reconciliation operation are distinct identities.
29. Request/capture timestamps are not idempotency keys.
30. Canonical endpoint mutation is fenced by the current lease generation.
31. Unknown COMMIT recovery is keyed by stable reconciliation operation identity.
32. Outbox execution is at-least-once and completion is fenced by lease generation.
33. A successful external effect without outbox completion is recoverable by repeating the same deduplicated effect.
34. Reprocessing activation and war sealing are versioned/fenced operations, not in-place rewrites.
35. Durable control/provenance/outbox/archive relations are WAL-logged; UNLOGGED tables are not permitted for these invariants.
