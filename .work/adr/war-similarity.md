# ADR: Similar Wars Uses Transparent Versioned Feature Distance

Status: **Accepted**

## Context

"Similar Wars" must be reproducible and must work with partial historical coverage without becoming an opaque ML recommendation.

## Decision

Start with a deterministic feature-distance model built primarily from compatible War DNA dimensions.

Baseline:

- robust normalization;
- explicit weights;
- weighted Euclidean distance;
- missing dimensions removed from both vectors;
- weights renormalized over shared dimensions;
- minimum shared-feature coverage required;
- model/version persisted.

Winner/result is not an active-war feature.

## Consequences

No vector database is required for v1; the historical war count is small enough for ordinary PostgreSQL/application computation.

The model can later change only via a new version.
