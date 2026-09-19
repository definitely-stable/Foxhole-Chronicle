# Foxhole Chronicle — Analytical Models

Status: **Authoritative working specification**

This document defines the product-level analytical models that sit above registered metrics.

Every model MUST be deterministic, reproducible, versioned and coverage-aware.

## 1. Day vs Day

Purpose: compare the same elapsed war day across wars.

Canonical route:

`/war/{war}/day/{day}`

Comparison endpoint is defined in PUBLIC_API.md.

Day N is the interval:

`[war_start + (N-1)*24h, war_start + N*24h)`

This is an elapsed-war analytical day, not a UTC calendar day.

For an incomplete current day, comparisons MUST use either:

- like-for-like elapsed fraction; or
- clearly label the current day as partial and compare only the covered interval.

The UI MUST show which mode is used.

Primary comparable outputs:

- casualties during the day;
- cumulative casualties at boundary;
- casualty rate;
- observed objective changes;
- active regions;
- regional concentration.

## 2. War DNA

Purpose: compact multi-dimensional fingerprint of a war.

War DNA MUST NOT collapse to an opaque overall rating.

`war_dna@1` SHOULD return dimensions such as:

- casualty intensity;
- faction casualty balance;
- objective volatility;
- regional concentration;
- recapture churn;
- pace;
- phase variability.

Each dimension includes:

- raw value;
- normalized score;
- percentile within reference cohort;
- coverage;
- source/metric versions.

Active wars use an as-of elapsed-time fingerprint and compare against historical wars at a comparable elapsed point where possible.

Completed-war-only dimensions MUST be omitted from active-war DNA rather than guessed.

## 3. Similar Wars

Purpose: retrieve historically similar wars under a transparent feature model.

Default model:

- feature basis: compatible War DNA dimensions;
- robust normalization;
- weighted Euclidean distance;
- missing dimensions removed from both vectors;
- weights renormalized over shared valid dimensions;
- minimum shared-feature coverage required.

Results include:

- candidate war;
- distance;
- mapped similarity score for display;
- top matching dimensions;
- top differing dimensions;
- shared coverage;
- model/version.

Winner/result MUST NOT be an input for active-war similarity and MUST NOT be used to suggest likely outcome.

## 4. War Phases — P0

Purpose: deterministic segmentation of the observed war timeline.

Phase classification is not the old "Turning Points" feature. It does not identify magical causal moments and does not narrate why a faction succeeds.

Required properties:

- versioned inputs;
- smoothing;
- hysteresis;
- minimum segment duration;
- explicit thresholds/change-point logic;
- stable output under small noisy changes;
- current-war provisional segments;
- golden/backtest corpus.

Candidate signals:

- casualty-rate level/trend;
- objective-change rate;
- state-index velocity;
- recapture churn;
- active-region count;
- regional concentration;
- elapsed war time.

Initial label vocabulary SHOULD prefer measurable labels:

- `opening`
- `contested`
- `high_mobility`
- `late_war`

Marketing labels such as "stalemate", "breakthrough", "endgame" MAY be displayed only when their measurable definition is published and does not imply causality.

### Provisional algorithm shape

1. Resample valid inputs to fixed analysis buckets.
2. Compute rolling robust summaries.
3. Normalize within ruleset/reference constraints.
4. Detect sustained regime changes using threshold + hysteresis or a deterministic change-point method.
5. Enforce minimum phase duration.
6. Merge transient segments below duration threshold.
7. Persist segment inputs/evidence and model version.

Exact thresholds remain **PENDING CALIBRATION** against golden historical datasets.

## 5. Swing Analysis

Preferred product name: **Largest Swings** or **State Reversals**.

Purpose: quantify the largest changes in public observed war state.

It MUST be descriptive.

### State index

Initial concept:

`state_index = (colonial_control_weight - warden_control_weight) / eligible_objective_weight`

The eligible objective set and weights MUST be versioned and based only on public, defensible objective classes.

A swing is a large absolute change in state index within a defined window.

A reversal is a swing whose direction later substantially reverses.

A recovery/comeback label SHOULD be avoided by default because it carries narrative/outcome connotations.

Results MUST include polling coverage and must not pretend objective changes occurred at exact timestamps.

## 6. Objective History

Canonical route:

`/objectives/{objectiveKey}`

Features:

- objective identity/revision metadata;
- war selector;
- ownership/state intervals;
- observed captures/recaptures;
- change counts;
- faction ownership duration;
- source coverage;
- links into region/war/day analytics.

Identity rules are defined in OBJECTIVE_IDENTITY.md.

## 7. Records

Records are metric queries, not hardcoded facts.

Each record definition specifies:

- metric/version;
- cohort;
- completed/current war policy;
- minimum coverage;
- tie behavior;
- historical resolution requirement.

Examples:

- longest/shortest completed war;
- deadliest completed war;
- highest casualty rate;
- most balanced casualty total;
- largest observed casualty difference;
- highest objective churn;
- most active region;
- most observed ownership changes.

UI MUST display "Recorded since …" where coverage is not historical-complete.

## 8. Population Lab

Population Lab remains a distinct historical module where a compatible historical population/play-hour dataset is legitimately available.

It MUST be isolated from War API enlistment semantics. Region enlistment counts MUST NOT be rebranded as faction/global historical player population.

## 9. Analytical model registry

Models such as War DNA, Similar Wars, phases and swings use a model registry parallel to the metric registry.

Each model definition includes:

- model key;
- version;
- input metric versions;
- parameter spec;
- cohort policy;
- minimum coverage;
- algorithm hash;
- release status;
- explanatory text.

## 10. Recalculation

A model recomputes when:

- source facts change;
- input metric version changes;
- objective identity mapping changes;
- ruleset cohort changes;
- model version changes.

Input fingerprints make recomputation targeted.

## 11. UX language

Allowed:

- "Observed"
- "Compared with"
- "Higher/lower than historical median"
- "Largest observed swing"
- "Classified as high-mobility by phase model v1"

Avoid:

- "This caused..."
- "The faction was winning because..."
- "Guaranteed comeback"
- "Turning point that decided the war"
- "Likely winner"

## 12. Acceptance criteria

No analytical feature ships unless:

- model is documented;
- model/version is stored;
- inputs are source-traceable;
- coverage threshold is enforced;
- incomplete data has explicit behavior;
- golden fixtures exist;
- UI explanation is understandable without reading source code.
