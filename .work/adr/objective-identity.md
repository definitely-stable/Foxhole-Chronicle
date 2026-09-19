# ADR: Chronicle-Owned Objective Identity

Status: **Accepted pending upstream re-verification**

## Context

Objective History, recapture metrics, phases and swings require stable identity across dynamic/static observations. Chronicle cannot depend on an upstream ID unless the source guarantees one suitable for this purpose.

## Decision

Use internal UUID objective identity plus a stable Chronicle `objective_key`.

Identity is matched through versioned logic using:

- region/map;
- static coordinates;
- objective family/icon semantics;
- name as supporting evidence;
- prior revision/context.

Ambiguous matches are quarantined, not guessed.

## Consequences

- source ordering/type changes do not automatically create new logical objectives;
- aliases/renames can preserve permalinks;
- identity algorithm changes are replayable/testable;
- manual overrides must be audited.

See OBJECTIVE_IDENTITY.md.
