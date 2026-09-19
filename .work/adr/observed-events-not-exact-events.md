# ADR: Polling Produces Observed Changes, Not Exact Events

Status: **Accepted — source semantics verified 2026-09-19**

## Context

The official War API dynamic/public map endpoint exposes state snapshots. The documented map envelope includes `lastUpdated` and `version`, but no item-level event timestamp and no stable item/event ID.

`lastUpdated` is documented as the time the **map data** was last updated. It is not documented as a capture/destruction/ownership-change timestamp for an individual map item.

Therefore, if state A is valid at t0 and state B is valid at t1, Chronicle only proves that the change became observable in `(t0, t1]`.

See [WAR_API_SEMANTICS.md](../WAR_API_SEMANTICS.md).

## Decision

The canonical entity is `ObservedChange`, not an exact-timestamp event.

It records:

- previous valid observation time;
- current valid observation time;
- detection time;
- previous/current state;
- source fetch/payload identity;
- source map `version` and `lastUpdated` when present;
- detector version;
- coverage/quality/anomaly flags.

A malformed/quarantined observation MUST NOT bound an event interval as if it were valid source state.

## Consequences

UI and API use wording such as "observed between 14:01–14:03 UTC".

Exact event timestamps are allowed only if a future source explicitly provides a documented item/event timestamp with suitable semantics.

## Rejected

- midpoint timestamps;
- pretending `current_observed_at` is capture time;
- treating map `lastUpdated` as item event time;
- treating map `version` as time;
- reconstructing missing transitions from narrative assumptions;
- treating disappearance from one dynamic payload as proof of destruction.
