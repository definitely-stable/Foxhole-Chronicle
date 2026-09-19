# ADR: Ruleset Epochs for Cross-War Comparability

Status: **Accepted**

## Context

Game mechanics, layouts and objective sets may change over time. Comparing all wars under one statistical baseline can produce misleading percentiles/similarity.

## Decision

Chronicle may assign wars to versioned `ruleset_epochs` backed by documented evidence.

Analytical models declare whether they:

- require the same epoch;
- support cross-epoch normalization;
- exclude incompatible dimensions.

Epochs are not inferred merely from statistical differences.

## Consequences

War DNA, Similar Wars, records and percentiles gain explicit cohort semantics.

The model remains usable if an epoch boundary is corrected: derived outputs can be recomputed.
