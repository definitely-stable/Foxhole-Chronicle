# Foxhole Chronicle — Data Model

Status: **Authoritative working specification**

This document defines the logical data model for Foxhole Chronicle. Where an upstream guarantee has not yet been verified against the latest official source, the rule is marked **PENDING VERIFICATION**. Implementation MUST NOT strengthen an upstream guarantee beyond what is documented.

## 1. Core principles

The data model MUST preserve the full semantic chain:

`source -> fetch -> observation -> normalized fact -> observed change -> derived metric -> analytical model/result -> share/export`

The model MUST distinguish:

- source-provided values from Chronicle-derived values;
- source time from Chronicle ingestion time;
- exact timestamps from polling-bounded observation intervals;
- current state from historical observations;
- facts from metrics and analytical classifications;
- complete data from partial/low-resolution historical data.

Every durable analytical result MUST be reproducible from versioned inputs and a versioned algorithm.

## 2. Identity conventions

Chronicle uses internal immutable identifiers even when an upstream source provides an identifier.

### 2.1 War

`wars`

- `id uuid PK`
- `shard text NOT NULL`
- `source_war_id text NULL`
- `war_number integer NULL`
- `conquest_start_at timestamptz NULL`
- `conquest_end_at timestamptz NULL`
- `winner text NULL`
- `status text NOT NULL`
- `ruleset_epoch_id uuid NULL`
- `created_at timestamptz NOT NULL`
- `updated_at timestamptz NOT NULL`

Canonical identity MUST be internal `id`. Until official guarantees are re-verified, uniqueness SHOULD be enforced on `(shard, source_war_id)` when `source_war_id` is present. `war_number` is a display/human navigation value and MUST NOT be the sole relational key.

### 2.2 Region

`regions`

- `id uuid PK`
- `canonical_key text UNIQUE NOT NULL`
- `display_name text NOT NULL`
- `source_map_name text NULL`
- `active_from timestamptz NULL`
- `active_to timestamptz NULL`

### 2.3 Objective

Objective identity is defined in [OBJECTIVE_IDENTITY.md](./OBJECTIVE_IDENTITY.md).

## 3. Time semantics

Chronicle MUST keep multiple clocks explicitly.

### 3.1 Ingestion clock

`captured_at`: Chronicle timestamp at which a response/observation was recorded.

### 3.2 Source clock

`source_timestamp`: timestamp supplied by the source when one exists and its semantics are known.

### 3.3 War-relative clock

- `war_elapsed_seconds bigint`
- `elapsed_war_day integer`
- `calendar_date_utc date`

The canonical analytical day is **elapsed war day**, derived from the canonical war start timestamp and elapsed time. It MUST NOT be silently equated with a UTC calendar day or an upstream display field named `dayOfWar`. The relationship with upstream game-day semantics is documented in ADR [elapsed-war-day-vs-game-day.md](./adr/elapsed-war-day-vs-game-day.md).

A daily aggregate MUST include both `elapsed_war_day` and the UTC period boundaries used to produce it.

## 4. Source and provenance model

### 4.1 Sources

`sources`

- `id uuid PK`
- `key text UNIQUE NOT NULL`
- `source_class text NOT NULL` — official, historical-community, chronicle-derived
- `authority_rank integer NOT NULL`
- `homepage_uri text NULL`
- `runtime_dependency boolean NOT NULL`
- `redistribution_policy text NOT NULL`
- `notes text NULL`

### 4.2 Fetch metadata

`source_fetches`

- `id uuid PK`
- `source_id uuid FK`
- `endpoint_key text NOT NULL`
- `request_uri_redacted text NOT NULL`
- `requested_at timestamptz NOT NULL`
- `completed_at timestamptz NULL`
- `http_status integer NULL`
- `etag text NULL`
- `cache_control text NULL`
- `source_last_modified text NULL`
- `source_timestamp timestamptz NULL`
- `content_hash char(64) NULL`
- `payload_id uuid NULL`
- `schema_fingerprint text NULL`
- `attempt integer NOT NULL`
- `outcome text NOT NULL`
- `error_code text NULL`

A fetch is metadata about an HTTP interaction. A `304` MUST NOT create a duplicate normalized observation.

### 4.3 Content-addressed raw payloads

`source_payloads`

- `id uuid PK`
- `source_id uuid FK`
- `content_hash char(64) NOT NULL`
- `encoding text NOT NULL`
- `compression text NULL`
- `payload jsonb/binary reference`
- `first_seen_at timestamptz NOT NULL`
- `last_seen_at timestamptz NOT NULL`
- `size_bytes bigint NOT NULL`

Unique: `(source_id, content_hash)`.

Storage representation (PostgreSQL JSONB vs filesystem/object storage) is selected in INGESTION.md. The logical identity remains content-addressed regardless of physical storage.

## 5. Observations and normalized facts

### 5.1 War observations

`war_observations`

- `id uuid PK`
- `war_id uuid FK`
- `source_fetch_id uuid FK`
- `captured_at timestamptz NOT NULL`
- `source_timestamp timestamptz NULL`
- `war_elapsed_seconds bigint NULL`
- `elapsed_war_day integer NULL`
- source fields required by the official war-state payload
- `normalizer_version text NOT NULL`
- `quality_flags jsonb NOT NULL DEFAULT '{}'`

### 5.2 Region observations

`region_observations`

- `id uuid PK`
- `war_id uuid FK`
- `region_id uuid FK`
- `source_fetch_id uuid FK`
- `captured_at timestamptz NOT NULL`
- `source_timestamp timestamptz NULL`
- `war_elapsed_seconds bigint NULL`
- `elapsed_war_day integer NULL`
- `warden_casualties bigint NULL`
- `colonial_casualties bigint NULL`
- `region_enlistments bigint NULL`
- `day_of_war_raw integer NULL`
- `normalizer_version text NOT NULL`
- `quality_flags jsonb NOT NULL DEFAULT '{}'`

`region_enlistments` MUST be modeled as a region/map-scoped source measure. It MUST NOT be exposed as a globally unique player count by summing regions unless an official guarantee explicitly makes that valid.

Recommended uniqueness for normalized observations is source-semantic, not local-time-only. The final unique key MUST be chosen per endpoint using the strongest verified combination of upstream identity/timestamp/content hash.

## 6. Objective state and change history

### 6.1 Objective identities

`objective_identities` and `objective_revisions` are defined in OBJECTIVE_IDENTITY.md.

### 6.2 Objective observations

`objective_observations`

- `id uuid PK`
- `war_id uuid FK`
- `objective_id uuid FK`
- `objective_revision_id uuid FK`
- `source_fetch_id uuid FK`
- `observed_at timestamptz NOT NULL`
- `team_state text NULL`
- `icon_type integer/text NULL`
- `flags bigint NULL`
- `raw_state_hash char(64) NOT NULL`
- `identity_algorithm_version text NOT NULL`
- `quality_flags jsonb NOT NULL DEFAULT '{}'`

### 6.3 Observed changes

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
- `detector_version text NOT NULL`
- `coverage_ratio numeric NULL`
- `confidence_class text NOT NULL`
- `quality_flags jsonb NOT NULL DEFAULT '{}'`

Chronicle MUST NOT assign an exact in-game event timestamp when the source only proves that a change occurred in `(previous_observed_at, current_observed_at]`.

## 7. Coverage

`coverage_segments`

- `id uuid PK`
- `scope_type text NOT NULL` — war, region, objective, metric
- `scope_id uuid NOT NULL`
- `source_id uuid NULL`
- `metric_key text NULL`
- `from_at timestamptz NOT NULL`
- `to_at timestamptz NOT NULL`
- `expected_samples bigint NULL`
- `actual_samples bigint NULL`
- `coverage_ratio numeric NULL`
- `resolution_class text NOT NULL`
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
- `bucket_start`
- `bucket_width`
- `elapsed_war_day`
- casualty cumulative values
- casualty deltas
- casualty rates
- objective change counts
- active-region counts
- coverage metrics
- `aggregate_version`

Unique: `(war_id, bucket_start, bucket_width, aggregate_version)`.

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
- `snapshot_mode text` — live or immutable
- `algorithm_versions jsonb`
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

## 13. Index strategy

v1 MUST start without table partitioning unless measured evidence justifies it.

Initial B-tree indexes SHOULD cover:

- `war_observations (war_id, captured_at)`
- `region_observations (war_id, region_id, captured_at)`
- `objective_observations (war_id, objective_id, observed_at)`
- `observed_changes (war_id, current_observed_at)`
- `observed_changes (objective_id, current_observed_at)`
- `war_time_buckets (war_id, bucket_width, bucket_start)`
- `region_time_buckets (war_id, region_id, bucket_width, bucket_start)`

BRIN MAY be added for very large append-mostly timestamp columns after measured benefit.

A partitioning ADR MUST be created only when at least one of these is demonstrated:

- retention operations cause unacceptable locking/write amplification;
- index/table size materially degrades target queries;
- vacuum/maintenance becomes a measured bottleneck;
- row counts and query plans show partition pruning will materially improve cost.

No arbitrary row threshold is authoritative without benchmark evidence.

## 14. Retention

Normalized facts, aggregates, provenance and analytical outputs SHOULD be retained indefinitely unless legal/source policy requires otherwise.

Raw source payload retention is source-specific and defined in INGESTION.md and DATA_LICENSING.md. High-frequency raw payloads MUST NOT be assumed to be permanent.

## 15. Migration rules

EF Core migrations SHOULD own application relational schema.

Hand-written SQL migrations MAY be used for indexes, generated columns, specialized constraints and performance structures that are clearer outside EF abstractions.

Every migration MUST be tested against a production-like PostgreSQL container and MUST have a documented rollback/forward-fix strategy.

## 16. Non-negotiable invariants

1. No exact event timestamp may be invented from polling.
2. No global unique-player count may be produced from region-scoped enlistment values without verified source semantics.
3. No derived value may exist without an algorithm/version identity.
4. No analytical result may hide inadequate source coverage.
5. No historical import may erase its original source/provenance.
6. No share/export may silently change semantics after an algorithm version change.
