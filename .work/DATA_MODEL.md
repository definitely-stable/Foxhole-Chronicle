# Foxhole Chronicle — Data Model

Status: **Authoritative working specification — War API, Objective Identity and Time Semantics integrated 2026-09-19**

This document defines the logical data model for Foxhole Chronicle. Official runtime source semantics are defined in [WAR_API_SEMANTICS.md](./WAR_API_SEMANTICS.md).

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

### 4.3 Fetch metadata

`source_fetches`

- `id uuid PK`
- `batch_id uuid NULL FK`
- `source_id uuid FK`
- `shard text NULL`
- `endpoint_key text NOT NULL`
- `map_name text NULL`
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
- `attempt integer NOT NULL`
- `outcome text NOT NULL`
- `error_code text NULL`

A fetch is one HTTP interaction. A `304` MUST NOT create a duplicate normalized observation, but SHOULD reference the previously accepted representation through `representation_payload_id` so coverage can use the validation instant.

### 4.4 Content-addressed raw payloads

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

ETag is metadata/transport validation, not payload identity.

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
- `normalizer_version text NOT NULL`
- `validation_state text NOT NULL`
- `quality_flags jsonb NOT NULL DEFAULT '{}'`

Recommended uniqueness:

`(war_id, region_id, map_kind, content_hash, normalizer_version)`

A source map `version` is preserved but is not assumed globally unique across wars/maps.

## 6. Objective state and change history

### 6.1 Objective identities and revisions

`objective_identities`, `objective_revisions`, and `objective_aliases` are defined in OBJECTIVE_IDENTITY.md.

Canonical identity rows are durable. Matcher upgrades MUST NOT rewrite raw evidence or physically delete superseded canonical identities.

### 6.2 Source item observations

`source_item_observations` stores one raw/normalized source item occurrence before canonical resolution:

- `id uuid PK`
- `map_observation_id uuid NOT NULL FK`
- `war_id uuid NOT NULL FK`
- `region_id uuid NOT NULL FK`
- `source_map_name text NOT NULL`
- `source_item_kind text NOT NULL`
- `source_array_ordinal integer NULL`
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

Unique:

`(map_observation_id, raw_item_hash)`

`source_array_ordinal` is forensic evidence only and MUST NOT participate in identity.

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
- `coverage_ratio numeric NULL`
- `quality_class text NOT NULL`
- `created_at timestamptz NOT NULL`

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

## 13. Index strategy

v1 starts without table partitioning unless measured evidence justifies it.

Initial B-tree indexes SHOULD cover:

- `war_observations (war_id, captured_at)`
- `region_observations (war_id, region_id, captured_at)`
- `map_observations (war_id, region_id, map_kind, captured_at)`
- `source_item_observations (war_id, region_id, normalized_family)`
- `source_item_observations (map_observation_id, raw_item_hash)`
- `identity_candidates (source_item_observation_id, score DESC)`
- `identity_match_decisions (source_item_observation_id, effective_resolution_version)`
- `identity_manual_overrides (objective_id, created_at DESC)`
- `objective_observations (war_id, objective_id, observed_at)`
- `objective_state_intervals (objective_id, war_id, first_observed_at)`
- `observed_changes (war_id, current_observed_at)`
- `observed_changes (objective_id, current_observed_at)`
- `war_time_buckets (war_id, bucket_width, bucket_start)`
- `region_time_buckets (war_id, region_id, bucket_width, bucket_start)`
- `source_fetches (source_id, shard, endpoint_key, requested_at DESC)`

BRIN MAY be added for very large append-mostly timestamp columns after measured benefit.

## 14. Retention

Normalized facts, aggregates, provenance and analytical outputs SHOULD be retained indefinitely unless legal/source policy requires otherwise.

Raw source payload retention is source-specific and defined in INGESTION.md and DATA_LICENSING.md.

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
