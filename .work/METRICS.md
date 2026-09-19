# Foxhole Chronicle — Metric Registry

Status: **Authoritative working specification**

Every derived metric in Chronicle MUST have a stable key, explicit formula, unit, input requirements, aggregation semantics, minimum coverage and algorithm version.

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

Bucket aggregation: `sum(valid_deltas)`.

Negative deltas MUST be treated as correction/reset/anomaly according to source reconciliation rules, not blindly summed.

### Rates

Example: casualties per hour.

Preferred derivation:

`rate = valid_delta / covered_elapsed_hours`

Do not average already-averaged rates when the denominator differs. Recompute from numerator and covered duration where possible.

### Counts

Example: observed objective state changes.

Bucket aggregation: count of qualifying observed changes, with coverage attached.

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

This metric measures observed churn, not necessarily every in-game capture/destruction that occurred between polls.

### 3.7 objective_churn_rate

`objective_change_count / covered_elapsed_hours`

Unit: observed changes/hour.

Minimum coverage MUST account for polling gaps.

### 3.8 regional_activity_share

For a chosen base activity measure:

`region_activity / sum(activity across eligible regions)`

The base activity measure MUST be explicit in the metric version. There is no universal "activity" without a formula.

### 3.9 regional_concentration

Recommended v1 implementation: Herfindahl-Hirschman-style concentration over region activity shares:

`HHI = sum(share_i^2)`

Range: `[1/N,1]` over N eligible regions.

Only compare cohorts using the same region eligibility and base activity definition.

## 3.10 War API source constraints

Metrics derived from the official War API MUST follow [WAR_API_SEMANTICS.md](./WAR_API_SEMANTICS.md).

- `totalEnlistments` is map/region scoped. Chronicle MUST NOT sum it across regions and label the result global unique players or faction population.
- `dayOfWar` is retained as a raw source field and MUST NOT define Day-vs-Day buckets.
- map `lastUpdated` MUST NOT be used as an objective event timestamp.
- casualty counter decreases are anomaly/reset/correction inputs, not ordinary negative casualty deltas.
- objective-change metrics count Chronicle **observed changes** from valid observations; quarantined source anomalies do not count.
- map/source `version` values are revision metadata, not elapsed time.

## 4. Day vs Day metrics

Day-vs-Day uses elapsed war day.

For day N:

- start = `conquest_start + (N-1)*24h`
- end = `conquest_start + N*24h`

Partial current days MUST be labeled partial.

Comparison metrics SHOULD include:

- cumulative casualties at elapsed boundary;
- casualties during day;
- casualty rate during day;
- observed objective changes during day;
- active-region count;
- optional region concentration.

Each value includes coverage.

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
- coverage;
- metric/model versions.

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
- whether record is all-time historical or "recorded since WC…".

A record MUST NOT compare incompatible resolution tiers without an explicit policy.

## 10. Coverage and confidence

Every metric API value SHOULD include:

- `coverage_ratio`
- `sample_count`
- `resolution_class`
- `quality_class`
- `data_as_of`
- `metric_version`

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
