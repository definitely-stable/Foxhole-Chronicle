# ADR: Immutable Metric Semantics Through Versioning

Status: **Accepted**

## Context

Derived metrics will evolve. Silent formula changes would make historical charts, records and shared links non-reproducible.

## Decision

Every derived metric has:

- stable metric key;
- integer/version identifier;
- formula spec;
- required inputs;
- aggregation rule;
- minimum coverage;
- algorithm hash.

A semantic change creates a new version.

## Consequences

- old outputs remain explainable;
- share snapshots can pin versions;
- records can be recalculated deliberately;
- golden datasets test exact behavior.

Cosmetic display changes do not require a metric version change.
