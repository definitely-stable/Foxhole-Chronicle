# Foxhole Chronicle — Objective Identity

Status: **Authoritative working specification — War API semantics verified 2026-09-19**

Objective history, recapture analysis, swing analysis and phase classification all depend on stable objective identity.

The official War API does **not** document a stable map-item/objective ID. Chronicle therefore owns objective identity and MUST keep matching conservative and versioned.

Source contract: [WAR_API_SEMANTICS.md](./WAR_API_SEMANTICS.md).

## 1. Goal

Map changing static/dynamic source items into a stable Chronicle objective identity across observations and, where defensible, across wars.

Chronicle distinguishes:

- identity: "the same logical objective";
- revision: "the same objective with changed metadata";
- observation: "state observed at a time";
- change: "difference between two valid observations".

## 2. Verified upstream constraints

The official map-item schema provides:

- `teamId`;
- integer `iconType`;
- normalized `x/y`;
- integer `flags`.

The official static text schema provides:

- `text`;
- normalized `x/y`;
- `mapMarkerType = Major | Minor`.

The official map envelope provides:

- `regionId`;
- `lastUpdated` in epoch milliseconds;
- `version`, incremented when that map data changes.

It does **not** document:

- a stable item/objective ID;
- stable array ordering;
- an item-level event timestamp;
- cross-war coordinate stability;
- cross-war name stability;
- cross-war `regionId` stability;
- exact static-text-to-dynamic-object coordinate equivalence.

Therefore none of those may be used as an unqualified natural key.

## 3. Canonical entities

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
- `source_icon_type integer NULL`
- `objective_family text NOT NULL`
- `x numeric NOT NULL`
- `y numeric NOT NULL`
- `source_map_version bigint NULL`
- `source_map_last_updated_at timestamptz NULL`
- `metadata jsonb NOT NULL`
- `identity_algorithm_version text NOT NULL`
- `match_method text NOT NULL`
- `match_score numeric NULL`
- `ambiguity_margin numeric NULL`
- `review_status text NOT NULL`

### objective_aliases

- `objective_id uuid`
- `alias text`
- `source_key text NULL`
- `from_war_id uuid NULL`
- `to_war_id uuid NULL`
- `alias_type text`

## 4. Identity scope

Within-war matching is scoped by:

`shard + war + source map name`

Cross-war identity is a Chronicle analytical continuity claim and is not inherited automatically from source coordinates or names.

The official `regionId` is preserved as source metadata but is not the Chronicle region PK.

## 5. Identity algorithm v1

Until a future official stable objective ID is documented, matching MUST use versioned Chronicle logic.

Candidate matching evidence, in priority order:

1. shard + war + region/map scope;
2. static reference candidate where applicable;
3. normalized coordinates;
4. compatible objective family/raw icon semantics;
5. Major static label/name as supporting evidence;
6. stable local neighborhood/context;
7. previous revision relationship.

Names MUST NOT be the primary key.

Coordinates MUST NOT be used alone because distinct source items may be spatially close.

Array position/order MUST NEVER be used.

### 5.1 Coordinate tolerance

No numeric tolerance is currently an official fact.

Before production auto-matching is enabled:

1. capture a representative corpus across multiple maps and source versions;
2. measure static-label-to-dynamic-object and repeated-dynamic coordinate deltas;
3. identify nearest-neighbor collision distributions;
4. choose family-specific acceptance thresholds;
5. define a minimum margin over the second-best candidate;
6. freeze those values in `objective_identity@1`;
7. validate against golden fixtures.

A later tolerance change creates a new identity algorithm version.

## 6. Objective key

Human-readable `objective_key` SHOULD be a Chronicle-owned slug, for example:

`deadlands-callahans-gate-town-base`

The slug is an alias for internal UUID identity. URLs MUST resolve through immutable `id` or a slug registry so later renames do not break old links.

Recommended permalink:

`/objectives/{objectiveKey}`

Old keys SHOULD redirect to the canonical key.

## 7. Families and raw source values

The identity model MUST use a normalized `objective_family`, separate from raw source icon codes.

Raw `iconType` and the complete raw `flags` integer MUST always be preserved.

Known official flag bits may be decoded:

- `0x01 IsVictoryBase`
- `0x02 IsHomeBase` — historical/removed
- `0x04 IsBuildSite`
- `0x10 IsScorched`
- `0x20 IsTownClaimed`

Unknown flag bits MUST be retained without invented meaning.

Town-base icon tiers `56/57/58` and relic-base historical tiers `45/46/47` demonstrate why raw icon changes cannot automatically mean new identity. The family taxonomy is versioned independently from the source integer.

## 8. Revisions

Create a new revision when a stable logical objective appears unchanged in identity but metadata materially changes:

- name;
- coordinates beyond ordinary observation stability but still defensibly the same objective;
- objective family/type;
- source static representation;
- map/ruleset revision metadata.

A revision does not imply an in-war capture/destruction event.

## 9. Ambiguity handling

Identity matching MUST be conservative.

If multiple candidates are plausible:

- do not auto-merge;
- create an unresolved identity candidate;
- mark affected objective analytics unavailable/low-confidence;
- expose the conflict in admin/diagnostic tooling;
- require deterministic resolution recorded as an identity override.

Manual overrides MUST be versioned and auditable.

## 10. Dynamic observation matching

For each dynamic map item:

1. validate the map envelope and reject/quarantine source anomalies first;
2. select candidates for the same shard/war/region;
3. compare normalized coordinates;
4. filter by compatible family/icon semantics;
5. add supporting static Major label/local-context evidence where available;
6. score the match;
7. accept only above the versioned threshold and required second-best margin;
8. otherwise quarantine as unmatched.

Every accepted observation records:

- `identity_algorithm_version`;
- `match_method`;
- `match_score`;
- `ambiguity_margin`;
- source payload hash;
- source map `version`;
- source map `lastUpdated`.

## 11. Dynamic disappearance and neutral state

A dynamic item disappearing from one payload is **not** by itself a documented destruction event.

`teamId=NONE` is a source state, but Chronicle MUST NOT infer its gameplay cause unless documented by the source/type semantics.

Before emitting an objective disappearance/state-collapse change, the worker MUST apply source-anomaly checks. Historical official issue #92 showed a server-restart failure mode that once returned partial dynamic data and many neutral items; although that issue was marked fixed, it is a required defensive fixture.

A mass disappearance/neutralization payload SHOULD be quarantined until a subsequent valid sample confirms or rejects it.

## 12. Ownership/state intervals

Chronicle derives state intervals from valid observations.

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

Map `lastUpdated` MUST NOT be substituted for an item-level capture timestamp.

## 13. Objective History feature

Objective History SHOULD expose:

- current known state;
- chronological observed state intervals;
- capture/recapture observations only where the state transition supports that wording;
- faction ownership duration by elapsed-war time;
- number of observed state changes;
- war-by-war summary;
- coverage gaps;
- identity revision history where relevant;
- links to related region/war/day pages;
- source/identity algorithm version.

For historical imports with only aggregate/final data, Objective History MUST clearly show reduced coverage and MUST NOT synthesize missing event timelines.

## 14. Cross-war matching

Cross-war identity matching SHOULD be stricter than within-war matching.

A static-map change may represent:

- same objective moved/retagged;
- renamed objective;
- objective removed;
- new objective;
- upstream data correction.

Chronicle MUST NOT automatically choose one interpretation.

Ruleset/map epochs MAY constrain candidate continuity. If continuity is ambiguous, create a new identity/revision and preserve a reviewable candidate link instead of merging.

## 15. Test corpus

Before Objective History ships, maintain golden fixtures covering:

- stable objective across repeated payloads;
- array reordering;
- icon/type tier change without identity change;
- rename;
- coordinate adjustment;
- adjacent objectives;
- removed objective;
- newly added objective;
- neutral/faction transitions;
- unknown icon code;
- unknown flag bit;
- missing static item;
- ambiguous match;
- mass disappearance/neutralization anomaly;
- source map version regression;
- cross-war map revision.

Identity algorithm changes MUST run against the entire corpus and produce a reviewed diff.

## 16. Acceptance criteria

1. Reordered dynamic payloads do not create new identities.
2. A type/icon revision does not automatically create a new identity.
3. Two nearby objectives cannot merge solely because of coordinate proximity.
4. Renames preserve old permalinks.
5. Ambiguous matches are quarantined rather than guessed.
6. Every objective observation records identity algorithm version and source map revision metadata.
7. Every displayed historical change is traceable to its observation interval and source fetches.
8. One malformed/partial dynamic payload cannot create mass false objective changes.
9. No implementation depends on an upstream stable objective ID that the official schema does not provide.
