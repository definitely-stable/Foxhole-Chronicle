# ADR: War DNA Is a Multi-Dimensional Fingerprint, Not a Score

Status: **Accepted**

## Context

A single "war score" would hide assumptions and encourage invalid ranking. The desired product feature is a recognizable fingerprint across multiple normalized dimensions.

## Decision

War DNA is a versioned vector of independently documented dimensions.

Initial candidate dimensions:

- casualty intensity;
- casualty balance;
- objective volatility;
- regional concentration;
- recapture churn;
- pace;
- phase variability.

Each dimension carries raw value, normalized value/percentile, cohort and coverage.

## Consequences

- missing dimensions can be omitted rather than imputed dishonestly;
- Similar Wars can reuse the vector;
- UI can explain why wars look similar/different;
- no winner/outcome inference is embedded.
