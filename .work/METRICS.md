# Foxhole Chronicle — Metric Registry

Status: **Authoritative working specification**

Every derived metric in Chronicle MUST have a stable key, explicit formula, unit, input requirements, aggregation semantics, minimum coverage and algorithm version. Time-indexed metrics additionally bind to [TIME_SEMANTICS.md](./TIME_SEMANTICS.md), `time_semantics_version` and `war_time_revision`.

## 1. Registry contract

Each metric definition contains:

- `metric_key`
- `version`
- `display_name`
- `description`
- `unit`
- `scope`
- `formula`
- `required_inputs`
- `window`
- `aggregation_rule`
- `minimum_coverage`
- `ruleset_policy`
- `algorithm_hash`
- `status`

Metrics MUST NOT be silently redefined in place. A semantic formula change creates a new version.

## 2. Aggregation classes

### Cumulative counters

Example: cumulative casualties.

Bucket aggregation: `last_valid_value`.

Downsampling MUST preserve bucket endpoints and SHOULD preserve extrema when chart shape requires it.

### Delta counters

Example: casualties gained during interval.

For adjacent valid cumulative-counter observations:

`delta(t0,t1) = value(t1) - value(t0)`

A delta MAY contribute to one analytical bucket only when its observation interval is contained within that bucket under the metric's gap policy.

If the interval crosses a bucket boundary, v1 marks the delta boundary-ambiguous and does not linearly/probabilistically split it.

Negative deltas MUST be treated as correction/reset/anomaly according to source reconciliation rules, not blindly summed.

### Rates

Example: casualties per hour.

Preferred derivation:

`rate = valid_delta / covered_elapsed_hours`

Do not average already-averaged rates when the denominator differs. Recompute from numerator and covered duration where possible.

### Counts

Example: observed objective state changes.

Bucket aggregation counts only changes whose polling uncertainty interval can be assigned to one bucket.

Boundary-crossing changes are exposed separately as ambiguous/unallocated counts and MUST NOT be silently attributed to the later observation's bucket.

### Ratios

Ratios SHOULD be recomputed from aggregated numerator/denominator rather than averaged unless the metric definition explicitly specifies weighting.

## 3. Core v1 metrics

### 3.1 total_casualties

`total_casualties = colonial_casualties + warden_casualties`

Unit: casualties.

Source requirement: valid casualty counters for the same scope/time.

Aggregation: cumulative/last.

### 3.2 casualty_delta

`delta(t0,t1) = total_casualties(t1) - total_casualties(t0)`

Negative values are not accepted as ordinary casualties; they trigger correction/reset handling.

Unit: casualties.

### 3.3 casualties_per_hour

`casualty_delta / covered_elapsed_hours`

Unit: casualties/hour.

Coverage requirement: configurable minimum covered duration and valid bracketing observations.

### 3.4 faction_casualty_difference

`colonial_casualties - warden_casualties`

Unit: casualties.

This is descriptive and MUST NOT be presented as advantage, performance or predicted outcome.

### 3.5 faction_casualty_balance

One bounded representation:

`(colonial - warden) / max(colonial + warden, epsilon)`

Range approximately `[-1,1]`.

UI MUST explain sign convention.

### 3.6 objective_change_count

Count of qualifying `observed_changes` affecting canonical objectives in a period.

Unit: observed changes.

This metric measures observed churn, not necessarily every in-game capture/destruction that occurred between polls. Under `chronicle-collection-v1`, dynamic state is normally sampled at 15-minute cadence; transient `A -> B -> A` states wholly between valid polls are not observable.

### 3.7 objective_churn_rate

`objective_change_count / covered_elapsed_hours`

Unit: observed changes/hour.

Minimum coverage MUST account for polling gaps and the expected interval of the active collection profile.

### 3.8 regional_casualties_per_hour

For one region and covered interval:

`regional_casualties_per_hour = valid_region_casualty_delta / covered_elapsed_hours`

Unit: casualties/hour.

Inputs come from the region-scoped warReport casualty counters. Counter decreases follow anomaly/reset handling and MUST NOT become negative activity.

This is the preferred P0 "regional activity" measure when the UI needs a single comparable intensity series, because its meaning/unit is explicit.

### 3.9 regional_casualty_share

For one aligned covered interval:

`regional_casualty_share = valid_region_casualty_delta / sum(valid_region_casualty_delta across eligible regions)`

Range: `[0,1]` when the denominator is positive.

The denominator MUST use an explicitly eligible region set with adequate comparable coverage. If cross-region denominator coverage is insufficient, the share is unavailable rather than silently computed from a biased subset.

### 3.10 regional_casualty_concentration

Recommended P0/P1 descriptive concentration metric:

`HHI = sum(regional_casualty_share_i^2)`

Range: `[1/N,1]` over N eligible regions when all required shares are available.

This metric describes concentration of **observed casualties**, not generic strategic activity.

Chronicle MAY later register other region-activity metrics, but each requires its own key/formula/version. The UI MUST NOT expose an opaque composite `regional_activity` value without such a registry entry.

## 3.11 War API source constraints

Metrics derived from the official War API MUST follow [WAR_API_SEMANTICS.md](./WAR_API_SEMANTICS.md).

- `totalEnlistments` is map/region scoped. Chronicle MUST NOT sum it across regions and label the result global unique players or faction population.
- `dayOfWar` is retained as a raw source field and MUST NOT define Day-vs-Day buckets.
- map `lastUpdated` MUST NOT be used as an objective event timestamp.
- casualty counter decreases are anomaly/reset/correction inputs, not ordinary negative casualty deltas.
- objective-change metrics count Chronicle **observed changes** from valid observations; quarantined source anomalies do not count.
- map/source `version` values are revision metadata, not elapsed time.

## 3.12 Objective identity quality

Every metric that depends on canonical objectives MUST bind to an `identity_resolution_version`.

Define:

`identity_coverage = resolved_eligible_objective_observations / eligible_objective_observations`

The exact denominator is metric-specific and MUST exclude source observations already quarantined for source-level anomalies.

Objective-dependent metric results SHOULD expose:

- `identity_resolution_version`
- `identity_coverage`
- `ambiguous_observation_count`
- `unmatched_observation_count`
- `manual_override_count` where relevant
- `identity_quality_class`

Suggested quality classes are policy labels, not probabilities:

- `complete` — all required objective observations resolved under the active identity version;
- `degraded` — unresolved identity exists but remains below the metric's documented tolerance;
- `insufficient` — ambiguity/unmatched evidence exceeds the metric's allowed threshold;
- `reprocessing` — a new identity resolution is being evaluated and the previous result remains active.

Metrics MUST define their own minimum identity coverage; there is no universal threshold.

### Hard-block examples

The following MUST NOT be computed as authoritative when material identity ambiguity remains:

- per-objective recapture records;
- objective ownership-duration records;
- objective-specific state-reversal records.

### Degrade examples

The following MAY compute with reduced quality when their versioned definition allows it:

- regional objective churn;
- Daily Chronicle objective-change count;
- War Phases inputs;
- Swing Analysis state index;
- War DNA objective-volatility dimensions;
- Similar Wars features derived from objective behavior.

A matcher-version change that reassigns objective observations MUST invalidate only the affected objective-derived metric/model ranges through input fingerprints.

## 4. Day vs Day metrics

Day-vs-Day uses Chronicle elapsed war day from TIME_SEMANTICS.md.

For day N:

- `start = conquest_start + (N-1)*24h`
- `end_exclusive = conquest_start + N*24h`

The interval is half-open.

A completed war ending exactly at `end_exclusive` has a complete Day N and does not create Day N+1.

### 4.1 Partial-day modes

For an active current day:

- `partial_as_is`: return the observed current interval and label it partial;
- `like_for_like_fraction`: compare historical Day N only through the same elapsed fraction of that day.

Like-for-like mode requires historical resolution capable of cutting at that elapsed instant. Daily-only source aggregates are not eligible.

### 4.2 Daily counters

Casualty delta/rate uses only valid covered counter intervals according to the metric version.

A cumulative value "at boundary" MUST expose the actual supporting observation time and boundary age when no exact-boundary sample exists. No silent interpolation.

### 4.3 Daily observed changes

- uncertainty interval fully inside Day N -> exact Day N count;
- uncertainty interval crosses Day N boundary -> boundary-ambiguous and excluded from exact Day N count by default.

Comparison metrics SHOULD include:

- cumulative casualties near elapsed boundary with supporting timestamp;
- observed casualties during covered interval;
- casualty rate over covered elapsed time;
- exact-bucket observed objective changes;
- boundary-ambiguous objective changes;
- active-region count;
- optional region concentration.

Each value includes:

- source coverage;
- `dayStatus`;
- `daySpanFraction`;
- `timeSemanticsVersion`;
- `warTimeRevision`;
- identity coverage/version when objective-derived.

## 5. War DNA dimensions

War DNA is a versioned analytical model built from registered metrics, not an unversioned score.

Candidate dimensions for `war_dna@1`:

1. **casualty_intensity** — robust percentile of casualties/hour over comparable covered period;
2. **casualty_balance** — normalized absolute faction casualty balance;
3. **objective_volatility** — observed objective churn normalized by eligible objectives and covered time;
4. **regional_concentration** — normalized regional activity concentration;
5. **recapture_churn** — repeated state reversals per eligible objective/time;
6. **pace** — elapsed duration behavior relative to cohort only for completed wars, or as-of-day comparison for active wars;
7. **phase_variability** — distribution/transition characteristics from phase model where coverage permits.

Population/play-hour dimensions MAY be separate optional dimensions only for cohorts with compatible source coverage.

Each dimension returns:

- raw value;
- normalized value;
- cohort percentile;
- source coverage;
- identity coverage when the dimension depends on objectives;
- metric/model versions;
- identity resolution version when applicable.

No single "overall war score" is required.

## 6. Similar Wars features

Similarity MUST operate on an explicit feature schema. Initial candidate feature set SHOULD reuse War DNA dimensions to avoid hidden duplicate formulas.

Recommended preprocessing:

- build comparable as-of feature vectors;
- use reference cohort restricted by ruleset/coverage policy;
- robust-scale continuous features using median and MAD or percentile transform;
- omit unsupported features rather than impute arbitrary zero;
- renormalize weights over valid shared dimensions;
- reject comparison below minimum shared-feature coverage.

Recommended initial distance:

weighted Euclidean distance over bounded/robust-normalized dimensions.

`d(A,B)=sqrt(sum(w_i * (a_i-b_i)^2) / sum(valid w_i))`

A display similarity can be monotonically mapped from distance, but the raw distance and model version MUST remain available.

Similarity MUST NOT use winner/result as an input feature for an in-progress war and MUST NOT be presented as outcome prediction.

## 7. Swing metrics

A swing model requires a transparent public-state index. It MUST be versioned separately from base metrics.

The first model SHOULD prefer an objective/VP ownership share derived from a fixed eligible objective set and explicit weights.

Conceptually:

`state_index = (colonial_weight - warden_weight) / total_eligible_weight`

Neutral weight contributes to denominator but not either faction numerator unless the model specifies otherwise.

A swing window is a large absolute change in the state index over a configured elapsed interval with adequate observation coverage.

UI SHOULD prefer labels such as **Largest Swings** or **State Reversals**. "Comeback" implies a narrative about recovery/outcome and SHOULD only be used if the exact descriptive criterion is explicitly met and explained.

## 8. War Phases

War phases are classifications, not causes and not winner predictions.

Phase model inputs MAY include:

- elapsed fraction/time;
- casualty-rate trend;
- objective-change rate;
- state-index velocity;
- regional concentration;
- active-region count;
- recapture/churn rate.

The phase model MUST define:

- smoothing windows;
- thresholds/change-point method;
- hysteresis;
- minimum phase duration;
- allowed phase transitions;
- treatment of current/incomplete war;
- ruleset/cohort policy.

Initial labels may be:

- `opening`
- `contested` / `stalemate`
- `high_mobility` / `breakthrough`
- `late_war` / `endgame`

Final labels MUST be validated against measurable definitions. "Breakthrough" MUST NOT imply causality or strategic success if the algorithm only detects rapid state movement.

## 9. Records

Records MUST specify:

- metric key/version;
- cohort;
- time period;
- minimum coverage;
- applicable time semantics/version;
- whether record is all-time historical or "recorded since WC…".

Longest/shortest-war records MUST sort by exact completed conquest duration, not rounded elapsed-day count.

A record MUST NOT compare incompatible resolution tiers without an explicit policy.

## 10. Coverage and confidence

Every metric API value SHOULD include:

- `coverage_ratio`
- `sample_count`
- `resolution_class`
- `collection_profile_version` when Chronicle-collected cadence affects interpretation
- `quality_class`
- `data_as_of`
- `metric_version`
- `time_semantics_version` when time-indexed
- `war_time_revision` when war-relative
- `identity_resolution_version` when objective-derived
- `identity_coverage` when objective-derived

"Confidence" MUST not be a decorative percentage. Use categorical quality/confidence only when derived from a documented rule.

## 11. Golden datasets

For each nontrivial metric/model, maintain fixtures covering:

- complete regular sampling;
- missing intervals;
- duplicate payloads;
- late corrections;
- source reset;
- partial war day;
- war transition;
- objective identity ambiguity;
- low-resolution historical import.

Metric tests MUST compare exact expected outputs and version changes MUST intentionally update golden expectations.

## 12. Prohibited metrics

v1 MUST NOT provide:

- predicted winner probability;
- "faction skill" scores;
- hidden/private intelligence estimates;
- causal claims such as "event X caused collapse";
- exact event timing inferred solely from polling;
- a generic `activity_index` without a published formula/version.

## 13. Acceptance criteria

A metric is shippable only when:

1. formula is documented;
2. required inputs are identified;
3. aggregation/downsampling semantics are defined;
4. minimum coverage is defined;
5. algorithm/version is persisted;
6. golden tests exist;
7. API includes provenance/coverage;
8. UI wording does not overstate what the metric proves.
9. Objective-derived metrics declare identity-resolution dependencies and minimum identity coverage.
10. Matcher reprocessing invalidates affected derived results deterministically.
11. Time-indexed metrics bind to `time_semantics_version` and `war_time_revision`.
12. Boundary-crossing poll intervals are not silently assigned to a day/bucket.
13. Rates divide by covered elapsed time, not theoretical bucket duration when coverage is incomplete.
14. Completed duration records use exact elapsed duration rather than rounded day count.
15. Objective-change/churn metrics identify the collection profile/resolution that bounds what transitions could have been observed.
16. A cadence change does not silently redefine historical coverage; it creates a new collection profile version.
