# ADR: Chronicle-Owned Objective Identity

Status: **Accepted — upstream schema verified 2026-09-19**

## Context

Objective History, recapture metrics, phases and swings require stable identity across dynamic/static observations.

The official War API map-item schema documents `teamId`, `iconType`, normalized `x/y`, and `flags`, but no stable map-item/objective identifier. Static text labels also have no shared item ID with dynamic objects. Cross-war stability guarantees for coordinates/names/icon codes are not documented.

See [WAR_API_SEMANTICS.md](../WAR_API_SEMANTICS.md).

## Decision

Use internal UUID objective identity plus a stable Chronicle `objective_key`.

Identity is matched through versioned logic using:

- shard + war + region/map scope;
- static reference data;
- normalized coordinates;
- objective family/icon compatibility;
- Major text/name as supporting evidence, not a key;
- prior revision/local context.

Array index/order MUST NOT participate in identity.

No coordinate tolerance is hard-coded as a source fact. It must be calibrated against a real-payload corpus and golden fixtures.

Ambiguous matches are quarantined, not guessed.

Cross-war matching is stricter than within-war matching and may create a new identity/revision instead of forcing continuity.

## Consequences

- source ordering changes do not create new logical objectives;
- icon/type changes are preserved as raw state and do not automatically imply a new objective;
- aliases/renames can preserve permalinks;
- identity algorithm changes are replayable/testable;
- every match retains source map version/payload evidence;
- manual overrides must be audited.

See OBJECTIVE_IDENTITY.md.
