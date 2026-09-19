# ADR: Historical Sources Are Controlled Bootstrap Inputs

Status: **Accepted**

## Context

Chronicle needs history older than its own collector. FoxholeStats and FoxholeHub may provide useful historical data, but availability, resolution, terms and licensing differ from the official runtime API.

## Decision

FoxholeStats and FoxholeHub are **bootstrap/import candidates**, not runtime dependencies.

Automated import remains disabled until DATA_LICENSING.md records a verified source-use decision.

Historical imports are immutable-manifested, provenance-preserving and coverage-tiered.

## Consequences

- current-war runtime survives community source outages/changes;
- imported history is reproducible;
- lower-resolution history cannot masquerade as Chronicle-native data;
- a source can be removed/taken down through lineage-aware recomputation.

## Rejected

- page-time scraping;
- silent source merging;
- assuming public HTML means redistribution permission.
