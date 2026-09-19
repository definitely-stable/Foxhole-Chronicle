# ADR: Chronicle-Owned Objective Identity

Status: **Accepted — deep research integrated 2026-09-19**

## Context

Objective History, recapture metrics, War Phases, Swing Analysis and several historical comparisons require stable objective identity.

The official War API map-item schema documents `teamId`, `iconType`, normalized `x/y`, and `flags`, but no stable map-item/objective identifier. Static text labels also have no shared item ID with dynamic objects. Cross-war stability guarantees for coordinates, names, array ordering, icon codes and `regionId` are not documented.

A naive key such as `regionId + iconType + x + y + flags` would mix mutable state with identity and would not be a documented source guarantee.

See [WAR_API_SEMANTICS.md](../WAR_API_SEMANTICS.md) and [OBJECTIVE_IDENTITY.md](../OBJECTIVE_IDENTITY.md).

## Decision

Chronicle owns objective identity.

The model distinguishes:

1. immutable source item observations;
2. within-war identity resolution;
3. cross-war canonical identity;
4. versioned objective revisions;
5. aliases/permalink continuity.

Identity resolution is deterministic, versioned and replayable.

### Candidate evidence

The matcher may use:

- shard + war + region/map scope;
- normalized coordinates;
- Chronicle objective-family/icon compatibility;
- static Major-label context;
- neighborhood context;
- prior accepted continuity;
- prior compatible revision.

Array index/order MUST NOT participate.

Dynamic ownership/state such as `teamId` and mutable flags MUST NOT serve as durable identity keys.

### Acceptance

Automatic matching requires both:

- best candidate score >= versioned acceptance threshold;
- best score minus second-best score >= versioned ambiguity margin.

Otherwise the decision is persisted as `ambiguous`, `unmatched`, or `rejected`.

No coordinate epsilon, matcher weight, threshold, ambiguity margin, or accuracy claim is accepted as a source fact. Production values must be calibrated from a labeled real-payload corpus and frozen into the matcher version.

### Cross-war matching

Cross-war matching is stricter than within-war matching.

When continuity is not sufficiently supported, Chronicle prefers:

- a new canonical identity; or
- an unresolved candidate relation;

over a false merge.

A source map `version` change does not by itself reset canonical identity.

### Reprocessing

Raw source observations are immutable evidence.

A matcher/taxonomy upgrade creates a new identity resolution version. Old candidate/decision sets remain queryable and diffable.

Merge/split/reassignment decisions trigger targeted downstream recomputation.

### Manual review

Manual overrides are append-only, auditable and reversible.

Old objective keys survive rename/merge through aliases/redirects.

## Consequences

Positive:

- source ordering changes do not create new logical objectives;
- matcher behavior is explainable and testable;
- false merges can be recovered without rewriting evidence;
- ambiguous cases do not silently poison analytics;
- permalink continuity survives later reconciliation;
- objective-derived metrics can bind to an explicit identity resolution version.

Costs:

- more persistence tables and audit state;
- a manual-review path is required;
- production auto-match cannot be enabled responsibly before corpus calibration;
- some cases remain unresolved by design.

## Rejected alternatives

- array index/order as identity;
- raw-field hash as canonical objective ID;
- fixed uncalibrated coordinate epsilon;
- auto-merge on coordinate proximity alone;
- using `teamId` or mutable flags as durable identity;
- tombstoning after one missing dynamic sample;
- opaque AI/LLM identity matching as source of truth.
