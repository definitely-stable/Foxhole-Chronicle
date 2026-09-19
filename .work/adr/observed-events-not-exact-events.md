# ADR: Polling Produces Observed Changes, Not Exact Events

Status: **Accepted**

## Context

The ingestion worker observes source state at discrete times. If state A is seen at t0 and state B at t1, Chronicle only proves that the change became observable in the interval `(t0, t1]` unless the source supplies an explicit event timestamp.

## Decision

The canonical entity is `ObservedChange`, not an exact-timestamp event.

It records:

- previous observation time;
- current observation time;
- detection time;
- previous/current state;
- detector version;
- coverage/quality.

## Consequences

UI and API use wording such as "observed between 14:01–14:03 UTC".

Exact capture timestamps are allowed only when a source explicitly provides documented exact event time.

## Rejected

- midpoint timestamps;
- pretending `current_observed_at` is capture time;
- reconstructing missing transitions from narrative assumptions.
