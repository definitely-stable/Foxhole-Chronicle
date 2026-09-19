# Foxhole Chronicle — Objective Identity

Status: **Authoritative working specification**

Objective history, recapture analysis, swing analysis and phase classification all depend on stable objective identity. Chronicle MUST NOT assume an upstream stable objective identifier unless that guarantee is verified.

## 1. Goal

Map changing static/dynamic source items into a stable Chronicle objective identity across observations and, where defensible, across wars.

Chronicle distinguishes:

- identity: "the same logical objective";
- revision: "the same objective with changed metadata";
- observation: "state observed at a time";
- change: "difference between two observations".

## 2. Canonical entities

### objective_identities

- `id uuid PK`
- `objective_key text UNIQUE NOT NULL`
- `region_id uuid NOT NULL`
- `canonical_name text NULL`
- `objective_family text NOT NULL`
- `canonical_x numeric NOT NULL`
- `canonical_y numeric NOT NULL`
- `first_seen_at timestamptz NULL`
- `last_seen_at timestamptz NULL`
- `identity_status text NOT NULL`
- `created_by_identity_version text NOT NULL`

### objective_revisions

- `id uuid PK`
- `objective_id uuid FK`
- `valid_from_war_id uuid NULL`
- `valid_to_war_id uuid NULL`
- `source_static_fingerprint char(64)`
- `display_name text NULL`
- `source_icon_type integer/text NULL`
- `objective_family text NOT NULL`
- `x numeric NOT NULL`
- `y numeric NOT NULL`
- `metadata jsonb NOT NULL`
- `identity_algorithm_version text NOT NULL`
- `match_method text NOT NULL`
- `match_score numeric NULL`
- `review_status text NOT NULL`

### objective_aliases

- `objective_id uuid`
- `alias text`
- `source_key text NULL`
- `from_war_id uuid NULL`
- `to_war_id uuid NULL`
- `alias_type text`

## 3. Identity algorithm

Until an official stable objective ID is verified, matching MUST use versioned Chronicle logic.

Candidate matching features, in priority order:

1. shard/map/region identity;
2. static-map coordinates within a strict tolerance;
3. source icon/objective family;
4. source/static name if present;
5. stable local neighborhood/context;
6. previous revision relationship.

Names MUST NOT be the primary key because names can be corrected, localized or changed.

Coordinates MUST NOT be used alone without type/context because distinct source items can be spatially close.

## 4. Objective key

Human-readable `objective_key` SHOULD be a Chronicle-owned slug, for example:

`deadlands-callahans-gate-town-base`

The slug is an alias for internal UUID identity. URLs MUST resolve through immutable `id` or a slug registry so later renames do not break old links.

Recommended permalink:

`/objectives/{objectiveKey}`

Old keys SHOULD redirect to the canonical key.

## 5. Families

The identity model MUST use a normalized `objective_family`, separate from raw source icon codes.

Initial families SHOULD be derived only from documented source semantics and may include categories such as town/relic/victory-related/public map objectives when verified.

Raw source `iconType` MUST be preserved independently so a later taxonomy correction does not destroy evidence.

## 6. Revisions

Create a new revision when a stable logical objective appears unchanged in identity but metadata materially changes:

- name;
- coordinates beyond configured metadata tolerance but still reviewable as same identity;
- objective family/type;
- source static representation.

A revision does not imply an in-war capture/destruction event.

## 7. Ambiguity handling

Identity matching MUST be conservative.

If multiple candidates are plausible:

- do not auto-merge;
- create an unresolved identity candidate;
- mark affected objective analytics unavailable/low-confidence;
- expose the conflict in admin/diagnostic tooling;
- require deterministic resolution recorded as an identity override.

Manual overrides MUST be versioned and auditable.

## 8. Dynamic observation matching

For each dynamic map item:

1. select static/objective candidates for the same region;
2. transform/normalize coordinates using the verified source coordinate system;
3. filter by compatible family/icon semantics;
4. score spatial/context match;
5. accept only above a strict threshold and margin over second-best candidate;
6. otherwise quarantine as unmatched.

The algorithm version MUST be written into every objective observation.

## 9. Ownership/state intervals

Chronicle derives state intervals from observations.

`objective_state_intervals`

- `objective_id`
- `war_id`
- `state`
- `first_observed_at`
- `last_observed_at`
- `next_state_first_observed_at NULL`
- `coverage_ratio`
- `identity_algorithm_version`
- `detector_version`

The boundary between states is uncertain within the polling gap.

UI SHOULD say:

"Observed changed between 14:01 and 14:03 UTC"

not:

"Captured at 14:02 UTC"

unless an upstream source supplies and documents an exact event timestamp.

## 10. Objective History feature

Objective History SHOULD expose:

- current known state;
- chronological observed state intervals;
- capture/recapture observations;
- faction ownership duration by elapsed-war time;
- number of observed state changes;
- war-by-war summary;
- coverage gaps;
- identity revision history where relevant;
- links to related region/war/day pages.

For historical imports with only aggregate/final data, Objective History MUST clearly show reduced coverage and MUST NOT synthesize missing event timelines.

## 11. Static data revisions and map changes

A static-map change MAY represent:

- same objective moved/retagged;
- renamed objective;
- objective removed;
- new objective;
- upstream data correction.

Chronicle MUST NOT automatically assume one interpretation.

Cross-war identity matching SHOULD be more conservative than within-war matching. Ruleset/map epochs MAY be used to limit comparisons.

## 12. Test corpus

Before Objective History ships, maintain a golden fixture set covering:

- stable objective across repeated payloads;
- icon/type upgrade without identity change;
- rename;
- coordinate adjustment;
- adjacent objectives;
- removed objective;
- newly added objective;
- neutral/faction state transitions;
- source payload order changes;
- missing static item;
- ambiguous match.

Identity algorithm changes MUST run against the entire corpus and produce a reviewed diff.

## 13. Acceptance criteria

1. Reordered dynamic payloads do not create new identities.
2. A type/icon revision does not automatically create a new identity.
3. Two nearby objectives cannot merge solely because of coordinate proximity.
4. Renames preserve old permalinks.
5. Ambiguous matches are quarantined rather than guessed.
6. Every objective observation records identity algorithm version.
7. Every displayed historical event is traceable to its observation interval and source fetches.
