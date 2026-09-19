# ADR: Public API Exposes Normalized/Derived Data, Not an Upstream Raw Mirror

Status: **Accepted**

## Context

Chronicle is intended to become a public data source, but upstream sources may have distinct licensing/redistribution conditions.

## Decision

The public API and CSV exports default to:

- Chronicle-normalized facts where source policy permits;
- Chronicle-derived metrics/models;
- explicit provenance, coverage and version metadata.

Raw upstream payload mirroring is disabled unless a source policy explicitly permits redistribution.

Community historical-source bulk export is disabled while rights are unclear.

## Consequences

- Public Data API can launch without becoming an uncontrolled proxy.
- Source obligations remain visible in exports.
- Takedown/source-policy changes can be handled through lineage.
- API schema/versioning is Chronicle-owned even when facts originate upstream.
