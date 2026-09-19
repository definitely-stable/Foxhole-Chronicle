# Objective Identity — Deep Research Synthesis

Research date: **2026-09-19**  
Status: **Supporting research; authoritative decisions are in OBJECTIVE_IDENTITY.md and ADRs**

## 1. Accepted findings

The research reinforces the existing source constraint: the official War API exposes map items through source fields such as `iconType`, normalized `x/y`, `flags`, `teamId`, map `version`, `lastUpdated`, and `regionId`, but it does not document a durable item/objective identifier.

Therefore Chronicle must own objective identity.

The production model must distinguish:

1. **Source item observation identity** — one raw/normalized item occurrence in one source payload.
2. **Within-war objective identity** — continuity of the same logical objective across repeated observations in one war/map.
3. **Cross-war canonical objective identity** — Chronicle's conservative claim that objectives in different wars represent the same enduring map location.
4. **Objective revision** — a versioned change to canonical metadata without necessarily creating a new canonical objective.
5. **Alias** — a historical/current human-readable label attached to a canonical objective.
6. **Objective family** — Chronicle taxonomy mapped from raw source icon codes/flags by a versioned taxonomy.

Within-war and cross-war matching MUST NOT use the same acceptance policy. Cross-war continuity requires stronger evidence.

## 2. Research findings that are not accepted as source facts

The following suggestions appeared in the research output but are **not** promoted into authoritative design without a measured corpus or primary-source guarantee:

- a fixed coordinate epsilon such as `0.0005` or `0.001`;
- claims such as "95% matches" or "<1% false matches";
- any claim that `regionId` is durable across wars;
- treating `IsVictoryBase` as proof that an item is a generic "town";
- treating `IsTownClaimed` as an exact capture-completion event;
- treating a source payload hash or a hash of `iconType+x+y+flags` as a durable objective ID;
- automatically tombstoning an objective after one missing dynamic observation;
- automatically creating a new canonical objective whenever `iconType` changes;
- resetting all canonical identities whenever map `version` changes;
- treating static `mapTextItems` as direct object IDs/names;
- using array order/index in any identity decision.

These can only become model parameters after corpus calibration and explicit versioning.

## 3. Objective Identity v1 direction

### Candidate generation

Within one war/map, candidate generation is bounded by:

- same Chronicle region/map scope;
- spatial search radius from a calibrated family-specific threshold;
- compatible objective family set;
- prior observation/revision continuity where available.

Cross-war candidate generation additionally requires:

- compatible map/ruleset epoch;
- stronger family compatibility;
- stricter spatial/label/context evidence;
- no unresolved conflicting canonical candidate.

### Matching features

Candidate score must be deterministic and decomposable.

Suggested normalized features:

- `distance_score`
- `family_score`
- `icon_compatibility_score`
- `label_context_score`
- `neighborhood_score`
- `continuity_score`
- `revision_compatibility_score`

The matcher stores the feature vector, final score, candidate rank, threshold version and ambiguity margin.

No feature may silently depend on wall-clock order or array order.

### Acceptance classes

- `accepted_auto`
- `accepted_manual`
- `ambiguous`
- `unmatched`
- `rejected`
- `superseded`

Automatic acceptance requires both:

- score >= configured threshold;
- best_score - second_best_score >= configured ambiguity margin.

Thresholds are versioned per matcher/family/cohort.

## 4. Coordinate calibration

Coordinates are source evidence, not identity by themselves.

Before enabling production auto-match, collect a corpus and measure:

- repeated coordinates for the same apparent item across unchanged payloads;
- coordinate deltas after map/source revisions;
- nearest-neighbor distances between distinct candidates of the same family;
- static-text-to-dynamic-object offsets where a relationship is manually confirmed;
- cross-war coordinate drift for manually confirmed canonical locations.

For each family compute distributions:

- positive-match distance;
- nearest negative/collision distance;
- best-vs-second-best distance margin.

Select thresholds to minimize **false merges first**, even at the cost of more manual review/false splits.

Chronicle should prefer an unresolved candidate over an incorrect merge because a false merge contaminates history across many downstream metrics.

## 5. State vs identity

Do not mix source state with identity.

Identity features should prefer relatively stable evidence.

Dynamic state fields such as:

- `teamId`;
- mutable flags;
- scorched/build/claimed bits;

belong primarily to observation/state classification and must not be used as durable identity keys.

Raw `iconType` may contribute to family compatibility but must not by itself define identity because source icon taxonomy can change.

## 6. Disappearance semantics

One missing item in one dynamic payload is not enough to:

- delete a canonical identity;
- create a tombstone;
- classify destruction;
- split history.

A missing source item becomes a **missing observation candidate**.

Confirmation requires one or more of:

- subsequent valid payloads;
- static-map evidence;
- war/map transition;
- source revision/context evidence.

Mass missing/neutral transitions trigger source-anomaly quarantine before item-level reconciliation.

## 7. Cross-war continuity

Cross-war matching is conservative.

Possible outcomes:

- same canonical objective, new revision;
- new canonical objective;
- unresolved candidate link;
- manual continuity override.

A canonical identity must never be rewritten destructively when matcher v2/v3 changes.

Instead, new matcher runs produce new decisions. The active resolution layer chooses which decision set is current. Old decisions remain auditable.

## 8. Reprocessing model

Immutable evidence:

- source fetch;
- raw payload hash;
- map observation;
- raw item observation;
- source coordinates/icon/flags/team;
- parser version.

Versioned inference:

- taxonomy version;
- matcher version;
- candidate feature vector;
- score;
- decision;
- manual override.

Derived outputs such as Objective History, churn, War Phases, Swing Analysis and War DNA depend on an `identity_resolution_version` or equivalent input fingerprint.

Reprocessing must be able to compare v1 vs v2:

- changed assignments;
- newly resolved ambiguity;
- new splits;
- new merges;
- downstream invalidation scope.

## 9. Manual review minimum workflow

For each ambiguous source item show:

- current source observation;
- map/war/region;
- coordinates;
- raw icon/flags/team;
- static text context;
- top candidate identities;
- spatial distance;
- family/icon compatibility;
- previous/next observations;
- candidate score breakdown;
- existing historical assignments.

Reviewer actions:

- accept candidate;
- create new identity;
- create revision;
- alias/rename;
- split incorrect identity;
- merge identities;
- mark unresolved;
- revert previous manual decision.

Every action records actor, timestamp, reason, previous decision and replacement decision.

Any merge/split/reassignment must queue targeted downstream recomputation.

## 10. Test strategy

Golden fixtures must cover:

- source array reorder;
- exact repeated item;
- small coordinate drift;
- adjacent same-family candidates;
- icon tier/type change;
- unknown icon code;
- unknown flag bit;
- label rename;
- dynamic disappearance;
- temporary `NONE`;
- mass-collapse anomaly;
- source map version regression;
- new/removed objective;
- ambiguous cross-war match;
- manual override;
- matcher v1 -> v2 reprocessing;
- merge/split recovery.

Property tests should enforce:

- permutation invariance;
- idempotency;
- deterministic score for identical inputs;
- no auto-match below threshold;
- no auto-match without ambiguity margin;
- unknown source values preserved;
- manual override wins over automatic inference for the selected resolution version.

## 11. Immediate corpus to collect

Start collecting now:

- static payload for every active map at war initialization;
- dynamic/public payloads under normal Chronicle polling;
- payload SHA-256;
- ETag;
- map `version`;
- `lastUpdated`;
- shard/war/map;
- retrieval timestamps;
- parser/schema version.

Create fixture manifests with:

- endpoint semantic key;
- shard;
- war ID;
- source map name;
- retrieval timestamp;
- payload SHA-256;
- ETag;
- map version/lastUpdated when present;
- parser version;
- fixture purpose;
- sanitization note.

The corpus should deliberately preserve changed payloads around map revisions and ambiguous/adjacent objectives.

## 12. Implementation order

1. Raw item observation persistence.
2. Versioned objective-family taxonomy.
3. Within-war candidate generator.
4. Feature extraction and deterministic scorer.
5. Candidate/decision persistence.
6. Ambiguity handling.
7. Manual review/audit model.
8. Objective state interval derivation.
9. Cross-war matcher.
10. Reprocessing/diff engine.
11. Downstream analytics invalidation/recompute.
12. Public Objective History/API.

No downstream objective-based metric should ship before identity ambiguity and version provenance are propagated.
