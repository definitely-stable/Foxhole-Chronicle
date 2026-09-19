# ADR: Elapsed War Day vs Upstream Game Day

Status: **Accepted — source semantics verified 2026-09-19**

## Context

Chronicle needs stable cross-war "Day N" analytics. UTC calendar dates do not align with war start.

The official War API exposes `dayOfWar` on the **map-specific war-report endpoint**, not on global war state. The official documentation calls it the current day of war but does not define it as a 24-hour elapsed bucket. Historical official-repository issue #81 also documented that per-map values could become reset/desynchronized; that issue was later marked fixed, but it reinforces that Chronicle must not use the field as its canonical cross-war clock.

The official war-state endpoint provides `conquestStartTime`, which is the defensible anchor for Chronicle elapsed-time analytics.

See [WAR_API_SEMANTICS.md](../WAR_API_SEMANTICS.md).

## Decision

Chronicle defines its analytical day as **elapsed war day**:

`day N = [war_start + (N-1)*24h, war_start + N*24h)`

where `war_start` is the validated official `conquestStartTime`.

The model stores separately:

- upstream raw `dayOfWar` per region/map;
- `war_elapsed_seconds`;
- `elapsed_war_day`;
- UTC calendar date/boundaries.

If `conquestStartTime` is null or invalid, Chronicle MUST NOT fabricate an elapsed war day.

## Consequences

- Day vs Day is reproducible across regions and wars.
- Daily Chronicle is not tied to UTC midnight.
- A current first/last day may be partial.
- Maintenance/downtime does not pause elapsed analytical time; coverage records show missing observations instead.
- Upstream `dayOfWar` remains available for diagnostics/source display without corrupting analytical semantics.
- If source war-start semantics are corrected, affected aggregates can be recomputed.

## Rule

No code may treat `dayOfWar`, UTC date and `elapsed_war_day` as interchangeable.
