# ADR: Elapsed War Day vs Upstream Game Day

Status: **Accepted**

## Context

Chronicle needs stable cross-war "Day N" analytics. UTC calendar dates do not align with war start, while an upstream field named `dayOfWar` may represent game/source semantics that must not be assumed identical to 24-hour elapsed-day buckets.

## Decision

Chronicle defines its analytical day as **elapsed war day**:

`day N = [war_start + (N-1)*24h, war_start + N*24h)`

The model stores separately:

- upstream raw `dayOfWar` when provided;
- `war_elapsed_seconds`;
- `elapsed_war_day`;
- UTC calendar date/boundaries.

## Consequences

- Day vs Day is reproducible.
- Daily Chronicle is not tied to UTC midnight.
- Upstream game-day displays remain available without corrupting analytical semantics.
- If war-start semantics are corrected, affected aggregates can be recomputed.

## Rule

No code may treat `dayOfWar`, UTC date and `elapsed_war_day` as interchangeable.
