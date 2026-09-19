# ADR: Deterministic War Phase Segmentation

Status: **Accepted**

## Context

The product owner requires War Phases as P0. The earlier rejection of "Turning Points" targeted opaque, causal or AI-narrated claims, not transparent timeline classification.

## Decision

Chronicle implements deterministic, versioned phase segmentation.

The model uses documented public signals, smoothing, hysteresis and minimum phase duration. It persists segment evidence and coverage.

Phase classification is separate from point "turning events".

Initial measurable labels SHOULD prefer neutral terminology such as:

- opening;
- contested;
- high-mobility;
- late-war.

More interpretive labels may be shown only with published definitions.

## Consequences

- current phases can be marked provisional;
- small sampling noise does not constantly flip labels;
- backtesting/golden datasets are mandatory;
- no winner prediction or causal narrative is produced.
