# Foxhole Chronicle — Objective Identity

Status: **Authoritative working specification — deep research integrated 2026-09-19**

Objective History, recapture analysis, swing analysis, objective churn, War Phases and several historical comparisons depend on stable objective identity.

The official War API does **not** document a stable map-item/objective ID. Chronicle therefore owns identity resolution and MUST keep it deterministic, versioned, replayable, auditable and conservative under ambiguity.

Primary source contract: [WAR_API_SEMANTICS.md](./WAR_API_SEMANTICS.md).  
Research synthesis: [research/OBJECTIVE_IDENTITY_RESEARCH_2026-09-19.md](./research/OBJECTIVE_IDENTITY_RESEARCH_2026-09-19.md).

## 1. Identity layers

Chronicle MUST keep these layers separate.

### 1.1 Source item occurrence and materialized evidence

A **source item occurrence** is one item occurrence in one static/dynamic raw source payload. The complete occurrence is immutable source evidence stored through the archived payload.

A relational `source_item_observation` is a sparse materialization of an occurrence when Chronicle needs it to anchor identity/state history, ambiguity, review or reprocessing output.

The raw payload remains the complete replay source. Relational materialization is evidence/indexing, not canonical identity.

### 1.2 Within-war objective identity

Chronicle's claim that multiple source item observations within one war/map represent the same logical objective.

This is the primary production identity problem and SHOULD be solved before cross-war continuity.

### 1.3 Cross-war canonical objective identity

Chronicle's claim that an objective in war A and an objective in war B represent the same enduring map location/objective.

This claim requires stricter evidence than within-war matching.

### 1.4 Objective revision

A versioned change in canonical metadata for the same accepted canonical identity, for example:

- source taxonomy/icon change;
- name/alias change;
- coordinate adjustment;
- static-map representation change;
- ruleset/map revision.

A revision is not an observed gameplay event.

### 1.5 Alias

A historical/current human-readable name/slug associated with a canonical objective.

Aliases must never be used as the sole identity key.

### 1.6 Objective family

Chronicle-owned versioned taxonomy mapped from raw source icon codes and documented flags.

Family is supporting identity evidence and analytics classification, not an upstream ID.

## 2. Verified upstream constraints

Official map item fields include:

- `teamId`;
- integer `iconType`;
- normalized `x/y`;
- integer `flags`.

Official map text fields include:

- `text`;
- normalized `x/y`;
- `mapMarkerType = Major | Minor`.

Official map envelope includes:

- `regionId`;
- `lastUpdated`;
- `version`.

The official source does **not** document:

- a stable item/objective ID;
- stable array ordering;
- item-level event timestamps;
- cross-war coordinate stability;
- cross-war name stability;
- cross-war `regionId` stability;
- exact one-to-one static-text-to-dynamic-item relationships.

Therefore none of those may be treated as an unqualified natural key.

## 3. Canonical persistence model

### 3.1 objective_identities

Represents the canonical Chronicle objective.

- `id uuid PK`
- `objective_key text UNIQUE NOT NULL`
- `home_region_id uuid NULL FK`
- `canonical_name text NULL`
- `objective_family text NOT NULL`
- `canonical_x numeric NULL`
- `canonical_y numeric NULL`
- `identity_status text NOT NULL`
- `first_seen_war_id uuid NULL FK`
- `last_seen_war_id uuid NULL FK`
- `created_at timestamptz NOT NULL`
- `updated_at timestamptz NOT NULL`

`identity_status` SHOULD support at least:

- `active`
- `historical`
- `unresolved`
- `superseded`

A canonical identity MUST NOT be physically deleted because derived history/permalinks may reference it.

### 3.2 objective_revisions

Represents versioned canonical metadata.

- `id uuid PK`
- `objective_id uuid NOT NULL FK`
- `revision_no integer NOT NULL`
- `valid_from_war_id uuid NULL FK`
- `valid_to_war_id uuid NULL FK`
- `display_name text NULL`
- `objective_family text NOT NULL`
- `canonical_x numeric NULL`
- `canonical_y numeric NULL`
- `source_icon_type integer NULL`
- `source_flags_reference bigint NULL`
- `source_static_fingerprint char(64) NULL`
- `source_map_version bigint NULL`
- `taxonomy_version text NOT NULL`
- `identity_resolution_version text NOT NULL`
- `revision_reason text NOT NULL`
- `metadata jsonb NOT NULL DEFAULT '{}'`
- `created_at timestamptz NOT NULL`

Unique:

`(objective_id, revision_no)`.

### 3.3 objective_aliases

- `id uuid PK`
- `objective_id uuid NOT NULL FK`
- `alias text NOT NULL`
- `normalized_alias text NOT NULL`
- `alias_type text NOT NULL`
- `source_key text NULL`
- `from_war_id uuid NULL FK`
- `to_war_id uuid NULL FK`
- `is_primary boolean NOT NULL DEFAULT false`

Aliases do not establish identity by themselves.

### 3.4 source_item_observations

`source_item_observations` stores **sparse materialized source-item evidence**, not every unchanged item occurrence from every snapshot.

The complete source occurrence set remains recoverable from the immutable archived raw payload.

Materialize a row when the occurrence is required for:

- first-seen identity establishment;
- material identity/state change;
- reappearance;
- ambiguity/unmatched state;
- manual review;
- persisted matcher/reprocessing evidence.

Fields:

- `id uuid PK`
- `map_observation_id uuid NOT NULL FK`
- `source_payload_id uuid NOT NULL FK`
- `war_id uuid NOT NULL FK`
- `region_id uuid NOT NULL FK`
- `source_map_name text NOT NULL`
- `source_item_kind text NOT NULL`
- `evidence_reason text NOT NULL`
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

`source_array_ordinal` is retained only as forensic source evidence. It MUST NOT be used for matching.

Recommended uniqueness:

`(map_observation_id, raw_item_hash, evidence_reason)`

The raw item hash is an observation-local fingerprint, not a durable objective ID.

An unchanged item in a later valid snapshot does not require another relational row. Continued-state evidence comes from the accepted map representation and its validation/coverage chain.
### 3.5 identity_match_runs

- `id uuid PK`
- `matcher_version text NOT NULL`
- `taxonomy_version text NOT NULL`
- `resolution_scope text NOT NULL` — within_war or cross_war
- `war_id uuid NULL FK`
- `started_at timestamptz NOT NULL`
- `completed_at timestamptz NULL`
- `input_fingerprint char(64) NOT NULL`
- `parameters jsonb NOT NULL`
- `status text NOT NULL`

### 3.6 identity_candidates

Stores every serious candidate considered by the matcher.

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
- `created_at timestamptz NOT NULL`

Unique:

`(match_run_id, source_item_observation_id, candidate_objective_id)`.

### 3.7 identity_match_decisions

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

Decision values:

- `accepted_auto`
- `accepted_manual`
- `ambiguous`
- `unmatched`
- `rejected`
- `superseded`

There MUST be one effective decision per source item observation per active resolution version.

### 3.8 identity_manual_overrides

- `id uuid PK`
- `source_item_observation_id uuid NULL FK`
- `objective_id uuid NULL FK`
- `override_type text NOT NULL`
- `previous_decision_id uuid NULL FK`
- `replacement_objective_id uuid NULL FK`
- `replacement_revision_id uuid NULL FK`
- `reason text NOT NULL`
- `actor text NOT NULL`
- `created_at timestamptz NOT NULL`
- `reverted_by_override_id uuid NULL FK`

Manual decisions are append-only and reversible.

## 4. Objective taxonomy

Raw source values MUST be preserved independently from Chronicle taxonomy.

Taxonomy record:

- `taxonomy_key`
- `taxonomy_version`
- raw `iconType` mappings
- family
- identity compatibility group
- analytical role
- state interpretation rules

Examples of source categories currently documented include Town Base, Relic Base, Special Base/Keep, Fort and numerous non-objective map entities.

Chronicle MUST NOT automatically treat every public map item as an "objective".

Initial analytical objective families SHOULD be limited to classes for which Chronicle can defend useful historical state continuity. Other items remain generic map entities until explicitly promoted by a taxonomy version.

Documented flag bits such as `IsVictoryBase`, `IsBuildSite`, `IsScorched`, and `IsTownClaimed` are raw state evidence. They MUST NOT be used as standalone canonical IDs or exact event markers.

Unknown icon codes and unknown flag bits MUST survive ingestion losslessly.

## 5. Stable vs mutable matching evidence

### 5.1 Identity evidence

Preferred evidence:

- same war/map scope;
- spatial proximity;
- objective-family compatibility;
- known icon compatibility;
- prior accepted continuity;
- nearby static Major-label context;
- local neighborhood structure;
- compatible prior revision.

### 5.2 State evidence

These are primarily dynamic state, not durable identity:

- `teamId`;
- scorched/build/claimed flags;
- other mutable flags;
- temporary presence/absence.

State fields MAY be used as anomaly/context signals but SHOULD NOT materially increase a candidate identity score.

## 6. Candidate generation

### 6.1 Within-war

For a source item observation `s`:

1. scope to same shard + war + Chronicle region/source map;
2. filter to compatible taxonomy families;
3. spatially query candidate objective revisions within family-specific candidate radius;
4. include the previous accepted identity for the source track when one exists, even if near the edge of the radius;
5. optionally add candidates linked through static Major-label/neighborhood context;
6. compute deterministic features for all candidates.

No array index/order participates.

### 6.2 Cross-war

Cross-war candidate generation is stricter:

1. same canonical region/map lineage;
2. compatible map/ruleset epoch;
3. compatible family/revision lineage;
4. stricter spatial/context filter;
5. supporting label/neighborhood evidence where available;
6. reject auto-linking if multiple plausible canonical candidates remain.

A cross-war matcher MUST prefer false split/manual review over false merge.

## 7. Deterministic scoring model

Identity v1 MUST use an explicit weighted score, not opaque ML/LLM matching.

For candidate `c` and source item `s`:

```text
score(s,c) =
    w_distance    * distance_score
  + w_family      * family_score
  + w_icon        * icon_compatibility_score
  + w_label       * label_context_score
  + w_neighbor    * neighborhood_score
  + w_continuity  * continuity_score
  + w_revision    * revision_compatibility_score
```

All component scores are bounded to `[0,1]`.

The exact weights and thresholds are configuration owned by `matcher_version`.

### 7.1 Distance score

Let normalized Euclidean distance be:

`d = sqrt((x_s-x_c)^2 + (y_s-y_c)^2)`

For family `f`, candidate generation uses calibrated radius `R_f`.

One acceptable deterministic transform:

`distance_score = max(0, 1 - d / R_f)`

This formula is a design choice; `R_f` MUST be calibrated from corpus data.

### 7.2 Family score

Suggested v1:

- exact same normalized family: `1.0`;
- explicitly compatible family transition: configured value in `(0,1)`;
- incompatible family: candidate rejected before scoring.

Compatibility is taxonomy-versioned.

### 7.3 Icon score

Raw icon equality may contribute, but icon changes within the same versioned family are not automatic identity breaks.

### 7.4 Label context score

A nearby Major text label MAY provide supporting evidence.

It MUST NOT be required because map text is not documented as a direct object name/ID.

### 7.5 Neighborhood score

Represent local context using the k nearest stable neighboring reference entities/families, normalized by relative distance/order.

Neighborhood context is especially useful when multiple same-family candidates are spatially close.

### 7.6 Continuity score

Within one war, a prior accepted identity for the same source track may receive a continuity bonus if the current observation remains spatially/taxonomically plausible.

Continuity MUST NOT override an incompatible family or a severe displacement.

## 8. Acceptance rule

Let:

- `S1` = highest candidate score;
- `S2` = second-highest candidate score;
- `T_f` = minimum acceptance score for family/scope;
- `M_f` = required ambiguity margin.

Auto-accept only when:

```text
S1 >= T_f
AND
(S1 - S2) >= M_f
AND
hard compatibility checks pass
```

If no candidate reaches `T_f` -> `unmatched`.

If the best candidate reaches threshold but margin is insufficient -> `ambiguous`.

If a hard contradiction exists -> `rejected`.

There is no authoritative numeric `T_f`, `M_f`, or coordinate epsilon yet.

## 9. Coordinate calibration

No fixed epsilon is source truth.

Before production auto-match:

1. collect real static/dynamic payload corpus across active maps;
2. manually establish a high-confidence labeled subset;
3. measure repeated-observation coordinate deltas;
4. measure static-context to dynamic-item offsets;
5. measure nearest negative candidate distances;
6. measure best-vs-second-best margins;
7. calculate per-family precision/recall;
8. choose thresholds that minimize false merges first;
9. freeze thresholds into `matcher_version`;
10. rerun full golden corpus.

Required distributions:

- positive-match distance;
- nearest-negative distance;
- same-family nearest-neighbor distance;
- cross-war manually confirmed drift;
- ambiguous-candidate score margin.

Chronicle SHOULD intentionally accept more unresolved/false-split cases rather than contaminate history with false merges.

## 10. Static ↔ dynamic reconciliation

Static and dynamic data do not share a documented ID.

Rules:

- static data is contextual/reference evidence;
- dynamic data is observed public state;
- Major `mapTextItems` are label/context candidates, not object IDs;
- Minor labels are weaker context;
- exact coordinate equality MUST NOT be required unless corpus evidence proves it for a specific relationship;
- a static/dynamic association is itself versioned inferred evidence.

Not every static entity needs a dynamic counterpart.

Not every dynamic map item belongs in Objective History.

## 11. Within-war continuity

A source item may continue as the same objective when:

- coordinates remain within calibrated family range;
- family remains compatible;
- continuity/neighborhood evidence remains plausible;
- no competing candidate is comparably plausible.

A change in:

- `teamId`;
- mutable flags;
- compatible icon tier;

normally changes state/revision evidence rather than identity by itself.

## 12. Missing/disappearing items

A single missing dynamic observation MUST NOT:

- delete the canonical objective;
- tombstone it;
- prove destruction;
- create a new identity when it reappears.

Missing item handling:

1. mark source presence as missing for that observation;
2. check source-level anomaly indicators;
3. wait for subsequent valid observation(s);
4. if it returns compatibly, continue the same identity;
5. if it stays absent across confirmed valid observations, close source-presence interval but preserve canonical identity;
6. classify gameplay meaning only when the transition semantics are defensible.

Mass disappearance/`NONE` transitions trigger source-level quarantine before item matching.

## 13. Raw state vs normalized state

Each objective observation MUST retain:

- raw `teamId`;
- raw `iconType`;
- raw `flags`;
- raw coordinates;
- taxonomy version;
- normalized family;
- normalized ownership/state classification;
- source map version;
- source payload identity.

Normalized state SHOULD distinguish at least:

- known faction owner;
- `NONE`;
- present but state unknown/unsupported;
- missing-from-valid-payload;
- source-observation quarantined.

"Destroyed", "captured", "rebuilt", or "recaptured" are higher-level transition classifications and MUST NOT be inferred solely from one raw flag or disappearance unless rules are explicitly supported.

## 14. Capture/recapture classification

Safe terminology:

- `ownership_change_observed`
- `state_change_observed`
- `presence_change_observed`
- `scorched_flag_change_observed`

A transition may be labeled `capture_observed` only when:

- the same accepted objective identity exists on both valid observations;
- owner changes from one known faction to the other under the relevant taxonomy rule;
- the observation interval is known;
- no source anomaly is active.

A `recapture_observed` requires prior accepted historical ownership by the new faction within the same war and the same canonical objective.

UI still reports an interval, not an exact event time.

## 15. Source anomaly protection

Before identity/state reconciliation, evaluate map-level health.

Signals:

- item-count collapse;
- mass transition to `NONE`;
- map version regression;
- region/source-map mismatch;
- empty/near-empty dynamic payload after stable population;
- schema drift;
- impossible source timestamp regression;
- suspicious simultaneous changes across a large share of objectives.

The thresholds for "mass" or "collapse" are versioned detector parameters and MUST be calibrated; no fixed percentage is authoritative yet.

Quarantine flow:

1. persist payload/evidence;
2. mark map observation `quarantined_source_anomaly`;
3. do not mutate current accepted objective state;
4. do not create ObservedChanges from it;
5. fetch normally according to scheduler/cache rules;
6. compare next valid observations;
7. resolve as transient anomaly or confirmed source-state change;
8. record diagnostic outcome.

## 16. Cross-war canonical identity

Cross-war matching is deliberately conservative.

Possible results:

- same canonical objective + new revision;
- new canonical objective;
- unresolved candidate link;
- manual continuity decision.

Automatic cross-war acceptance SHOULD require stronger threshold and ambiguity margin than within-war matching.

Cross-war matching MUST consider:

- map/ruleset epoch compatibility;
- family compatibility;
- coordinate drift;
- aliases/static label context;
- neighborhood topology;
- historical revisions.

A new war does **not** automatically reset all canonical identities.

A changed source map `version` does **not** automatically create new canonical identities.

If evidence is ambiguous, keep identities separate and create candidate relations for review.

## 17. Split and merge semantics

### False merge recovery

If one canonical objective was incorrectly assigned observations from two real objectives:

- create a new resolution version;
- split assignments by decision set;
- preserve old canonical IDs as audit history;
- choose permalink redirect/alias policy explicitly;
- recompute affected state intervals and analytics.

### False split recovery

If two Chronicle identities are later confirmed to represent one canonical objective:

- create a merge decision;
- select surviving canonical identity;
- mark old identity `superseded`;
- preserve old objective_key as alias/redirect;
- recompute downstream results.

Never rewrite old evidence rows.

## 18. Reprocessing and matcher versions

Immutable evidence:

- source fetch;
- exact raw payload/content hash;
- map observation;
- sparse materialized source-item evidence where persisted;
- raw coordinates/icon/flags/team reconstructed from archived payload when needed;
- parser/semantic-fingerprint version.

The archived raw payload sequence is the complete replay basis. A matcher version MUST NOT depend on the historical presence of a duplicated relational row for every unchanged occurrence.

Versioned inference:

- taxonomy;
- candidate generator;
- score feature schema;
- matcher weights;
- thresholds;
- candidate scores;
- decisions;
- manual overrides.

A matcher upgrade produces a new `identity_match_run` and a new `identity_resolution_version`.

Reprocessing MAY reconstruct ephemeral full item-occurrence streams from archived payloads and persist only material decision/evidence rows. This keeps replayability independent from polling-frequency relational duplication.

v1 and v2 results MUST be diffable by:

- source observation reassigned;
- newly resolved;
- newly ambiguous;
- split;
- merge;
- canonical revision change.

Downstream results include the active identity resolution version in their input fingerprint.

## 19. Manual review workflow

Minimal internal UI:

- source item and payload evidence;
- war/shard/map/region;
- x/y;
- raw icon/team/flags;
- taxonomy family;
- nearby Major/Minor text;
- previous/next valid observations;
- top candidates;
- score breakdown;
- spatial distance;
- ambiguity margin;
- current canonical history.

Reviewer actions:

- accept candidate;
- create new identity;
- create revision;
- add/replace alias;
- split identity;
- merge identities;
- keep unresolved;
- revert previous manual override.

Every action MUST be auditable and reversible.

Merge/split/reassignment triggers targeted downstream invalidation/recompute.

## 20. Objective state intervals

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

State boundaries are polling-bounded observations, not exact event timestamps.

## 21. Objective History contract

Objective History SHOULD expose:

- immutable canonical objective ID;
- current canonical key and aliases;
- revision history;
- per-war state/ownership intervals;
- observed ownership/state changes;
- recapture count where defensible;
- coverage and gaps;
- source resolution;
- identity resolution version;
- taxonomy/state model version;
- uncertainty intervals;
- links to war/day/region analytics.

Canonical route:

`/objectives/{objectiveKey}`

Old aliases SHOULD redirect to the surviving canonical route after rename/merge.

Public API SHOULD provide:

- `GET /api/v1/objectives/{objective}`
- `GET /api/v1/objectives/{objective}/history`
- CSV equivalent for historical intervals/changes.

API must never serialize polling-bounded changes as exact capture timestamps.

## 22. Downstream analytics contract

Objective-derived analytics MUST depend on resolved identity quality.

### Hard block when ambiguous/unresolved identity is material

- objective recapture records;
- objective ownership-duration records;
- canonical Objective History;
- objective-specific swing attribution.

### Degrade coverage/confidence when limited ambiguity exists

- region objective churn;
- War Phases;
- Swing Analysis;
- Daily Chronicle objective counts;
- War DNA objective-volatility dimensions;
- Similar Wars features that depend on objective behavior.

Every affected metric/model input fingerprint includes identity resolution version and identity coverage.

## 23. Corpus collection

Chronicle SHOULD begin collecting immediately:

- static payload for every active map at war initialization;
- changed dynamic/public payloads under normal polling;
- payload SHA-256;
- ETag;
- map `version`;
- map `lastUpdated`;
- shard;
- war ID;
- source map name;
- retrieval timestamps;
- parser/schema version.

Fixture manifest:

- `endpoint_key`
- `shard`
- `source_war_id`
- `source_map_name`
- `retrieved_at`
- `payload_sha256`
- `etag`
- `map_version`
- `map_last_updated`
- `parser_version`
- `fixture_purpose`
- `sanitization_note`

Changed payloads around map revisions and ambiguous/adjacent objective cases are especially valuable.

## 24. Testing

### Golden tests

Required cases:

- repeated identical object;
- array reordering;
- coordinate drift;
- adjacent same-family objectives;
- icon tier/type change;
- unknown icon;
- unknown flag bit;
- label rename;
- item removal/addition;
- temporary disappearance;
- `NONE` transition;
- mass-collapse anomaly;
- map version regression;
- ambiguous candidate;
- cross-war map revision;
- manual override;
- false merge recovery;
- false split recovery;
- matcher v1 -> v2 reprocessing.

### Property tests

Must prove:

- permutation invariance;
- deterministic scoring;
- idempotent reprocessing;
- no acceptance below threshold;
- no auto-acceptance without ambiguity margin;
- unknown raw values preserved;
- source state changes do not mutate canonical identity without resolution logic;
- active manual override dominates automatic inference for the selected resolution version.

### Integration tests

Use PostgreSQL/Testcontainers and test:

- candidate/decision unique constraints;
- concurrent matcher runs;
- replay;
- manual override + recomputation queue;
- permalink continuity through merge/rename;
- downstream invalidation.

## 25. Threat/failure model

### False merge

Impact: poisons objective history and every downstream metric across multiple wars.

Detection:

- low ambiguity margin;
- impossible alternating locations;
- contradictory neighborhood/family evidence;
- manual/golden corpus review.

Mitigation:

- conservative thresholds;
- stronger cross-war policy;
- manual review.

Recovery:

- new resolution version + split + targeted recompute.

### False split

Impact: fragmented history and inflated objective counts.

Detection:

- near-identical candidates across revisions;
- aliases/neighborhood continuity;
- manual review.

Recovery:

- merge decision + alias preservation + recompute.

### Identity churn

Impact: same source objective receives repeated new IDs.

Detection:

- high unmatched/new-identity rate;
- reappearance near prior identity;
- version-to-version assignment instability.

Mitigation:

- continuity feature;
- calibrated family radii;
- review.

### Source schema drift

Impact: matcher feature corruption.

Mitigation:

- raw preservation;
- schema fingerprinting;
- quarantine unknown incompatible changes.

### Manual-review error

Impact: authoritative bad link.

Mitigation:

- append-only reversible overrides;
- reviewer reason;
- evidence snapshot;
- diff before downstream recomputation.

## 26. Metrics for the matcher itself

Track:

- `auto_match_rate`
- `ambiguous_rate`
- `unmatched_rate`
- `new_identity_rate`
- `manual_override_rate`
- `reassignment_rate_between_versions`
- `false_merge_rate` on labeled corpus
- `false_split_rate` on labeled corpus
- per-family precision/recall
- score-margin distributions
- coordinate-distance distributions

No production matcher threshold is accepted without labeled-corpus metrics.

## 27. Implementation order

1. Persist raw source item observations.
2. Implement versioned objective-family taxonomy.
3. Implement within-war candidate generator.
4. Implement deterministic feature extraction/scoring.
5. Persist candidate lists and decisions.
6. Implement ambiguity/unmatched handling.
7. Implement source anomaly gate.
8. Implement manual review/audit model.
9. Derive state intervals/ObservedChanges.
10. Calibrate matcher on real corpus.
11. Enable within-war automatic matching.
12. Implement conservative cross-war matcher.
13. Implement matcher-version diff/reprocessing.
14. Wire downstream invalidation/recompute.
15. Expose Objective History/API.

Cross-war auto-matching SHOULD NOT block initial collector development.

## 27.1 Collection/storage interaction

Objective Identity MUST remain correct under the accepted collection/storage profile:

- dynamic collection baseline is 15 minutes in `chronicle-collection-v1`;
- a transient `A -> B -> A` state wholly between polls is unobservable and MUST NOT be synthesized;
- unchanged item occurrences across snapshots do not require duplicate relational evidence rows;
- valid snapshot/304 validation can extend state coverage without fabricating a new item event;
- full matcher replay reads the archived raw snapshot sequence;
- raw payload content identity and semantic snapshot fingerprint remain distinct from objective identity.
## 28. Production acceptance gate

Objective Identity v1 is ready for production only when:

1. Raw source observations are lossless and replayable.
2. Taxonomy and matcher have explicit versions.
3. Candidate generation ignores array order.
4. Coordinate thresholds are calibrated from a labeled real corpus.
5. Per-family precision/recall is measured.
6. False-merge behavior is explicitly tested.
7. Best-vs-second-best ambiguity margin is enforced.
8. Ambiguous cases remain unresolved rather than guessed.
9. One missing observation does not tombstone an identity.
10. Source anomaly quarantine prevents mass false events.
11. Manual overrides are reversible/audited.
12. Matcher v1/v2 results are diffable.
13. Permalinks survive rename/merge.
14. Downstream metrics propagate identity resolution version and coverage.
15. No gameplay event is assigned an exact timestamp solely from polling.

## 29. Explicitly rejected shortcuts

Chronicle MUST NOT:

- use `regionId + iconType + x + y + flags` as a permanent canonical ID;
- use a hash of mutable source fields as canonical identity;
- hard-code `epsilon = 0.0005` or any other tolerance without corpus calibration;
- claim unmeasured matcher precision/recall;
- use `teamId` as an identity feature;
- use mutable flags as durable identity keys;
- assume `IsVictoryBase` alone defines a generic "town";
- assume `IsTownClaimed` gives an exact capture timestamp;
- tombstone on one missing dynamic sample;
- rebuild all identities because source map `version` changed;
- use array index/order;
- let an opaque AI/LLM matcher become source of truth.
