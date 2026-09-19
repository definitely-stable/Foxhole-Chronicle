# Foxhole Chronicle — Time Semantics

Status: **Authoritative working specification — deep research integrated 2026-09-19**

This document defines Chronicle's canonical time model: source timestamps, collection timestamps, elapsed-war time, elapsed-war day, analytical bucket boundaries, partial days, coverage, Day-vs-Day alignment and invalidation rules.

Official source-field semantics are defined in [WAR_API_SEMANTICS.md](./WAR_API_SEMANTICS.md). This document defines Chronicle-owned analytical semantics.

Research synthesis: [research/TIME_SEMANTICS_RESEARCH_2026-09-19.md](./research/TIME_SEMANTICS_RESEARCH_2026-09-19.md).

## 1. Design goals

Chronicle time semantics MUST be:

- deterministic;
- independent of local timezone and DST;
- reproducible after source corrections;
- explicit about polling uncertainty;
- compatible with active and completed wars;
- compatible with high-frequency and low-resolution historical data;
- free from hidden interpolation;
- resistant to off-by-one boundary errors.

Chronicle MUST NOT treat these concepts as interchangeable:

- source-provided timestamp;
- map-state `lastUpdated`;
- HTTP request/fetch time;
- Chronicle observation time;
- UTC calendar date;
- upstream `dayOfWar`;
- elapsed war duration;
- elapsed war day;
- analytical bucket time.

## 2. Evidence boundary

### VERIFIED SOURCE FACTS

The official War API documents:

- `conquestStartTime`: Unix timestamp for conquest start, nullable before start;
- `conquestEndTime`: Unix timestamp for conquest end, nullable before end;
- `resistanceStartTime`: Unix timestamp for resistance start, nullable before resistance;
- `scheduledConquestEndTime`: scheduled short-conquest end when applicable;
- map `lastUpdated`: milliseconds from Unix epoch for map-data update time;
- map `version`: map-data revision counter;
- map-specific `dayOfWar`.

Official examples for war timestamps are 13-digit Unix values. Chronicle validates and interprets current War API war timestamps as Unix milliseconds while preserving raw integers.

### UNKNOWN / NOT GUARANTEED

The official source does not define:

- `dayOfWar` as Chronicle-style 24-hour buckets from `conquestStartTime`;
- `dayOfWar` consistency across all maps at every instant;
- `dayOfWar` transition at UTC/server midnight;
- item-level event timestamps for dynamic map state;
- transactional synchronization across war, war-report and map endpoints.

Chronicle MUST NOT promote any of these to source guarantees.

## 3. Canonical clock

Chronicle uses a continuous **elapsed conquest clock** anchored to validated `conquestStartTime`.

Constant:

`DAY = 86_400 seconds = 86_400_000 milliseconds`

The clock is elapsed UTC/POSIX wall time. It is not "active gameplay time".

Maintenance, API outage, collector outage or lack of state changes do not pause the clock. They reduce source/data coverage.

Local timezone and DST have no effect.

### 3.1 UI inspection / replay cursor

Timeline and Replay use an absolute UTC instant as the canonical shareable inspection cursor.

Recommended UI query parameter:

`at=<ISO-8601 UTC instant>`

The UI derives elapsed-war duration/day from the currently accepted conquest-start anchor.

This is deliberate: if a later valid source correction changes `conquest_start_at`, the displayed Day N/time for an old link may change, but the absolute `at` link still points to the same source-evidence instant.

An elapsed-second offset MAY be used internally for rendering/playback math, but it SHOULD NOT be the sole durable/shareable identity of a historical evidence point.

Current War normally uses the latest accepted state and does not need an explicit `at` value.

## 4. Canonical conquest interval

When only start is known:

`conquest interval = [conquest_start, +infinity)`

When end is known:

`conquest interval = [conquest_start, conquest_end)`

The interval is half-open.

Consequences:

- an instant exactly at `conquest_start` belongs to conquest Day 1;
- an instant exactly at a day boundary belongs to the new day;
- an instant exactly at `conquest_end` is outside conquest analytics;
- if conquest ends exactly on a 24-hour boundary, Chronicle MUST NOT create an empty following day.

`resistanceStartTime` is a separate source phase timestamp. Chronicle MUST NOT silently substitute it for `conquestEndTime` unless a future explicitly documented rule says they are equivalent.

`scheduledConquestEndTime` is scheduling metadata, not the actual analytical end of conquest.

## 5. Elapsed duration

For an instant `t` during conquest:

`elapsed(t) = t - conquest_start`

Validity:

- if start is null -> elapsed is unavailable;
- if `t < conquest_start` -> pre-conquest; elapsed is unavailable;
- if end is known and `t >= conquest_end` -> `t` is not a conquest observation instant.

### Active-war duration

At query time `as_of`:

`active_duration = max(0, as_of - conquest_start)`

Only valid while no conquest end is known.

### Completed-war duration

`completed_duration = conquest_end - conquest_start`

If `conquest_end <= conquest_start`, mark a source-time anomaly and do not compute duration-based analytics.

## 6. Elapsed war day

Chronicle elapsed war day is 1-based.

For an instant `t` inside the conquest interval:

`elapsed_war_day(t) = floor((t - conquest_start) / DAY) + 1`

Day N interval:

`day_start(N) = conquest_start + (N - 1) * DAY`

`day_end_exclusive(N) = conquest_start + N * DAY`

Canonical un-clipped day:

`Day N = [day_start(N), day_end_exclusive(N))`

### Boundary examples

- `t = start` -> Day 1.
- `t = start + 23:59:59.999` -> Day 1.
- `t = start + 24h` -> Day 2.
- `t = start + 48h` -> Day 3 **only if conquest is still active at that instant**.

For a completed conquest whose end is exactly `start + 48h`, the end instant is outside the conquest interval and the completed war contains exactly Days 1 and 2.

## 7. Number of elapsed-day buckets in a completed war

For valid positive completed duration:

`completed_day_count = ceil(completed_duration / DAY)`

Equivalent integer formula:

`completed_day_count = ((duration_ms - 1) / DAY_MS floor) + 1`

Examples:

- 1 ms -> 1 day bucket;
- 23h -> 1;
- exactly 24h -> 1;
- 24h + 1 ms -> 2;
- exactly 48h -> 2;
- 48h + 1 ms -> 3.

This function MUST be separate from `elapsed_war_day(t)`.

## 8. Clipped analytical day interval

For Day N:

`raw_start = day_start(N)`

`raw_end = day_end_exclusive(N)`

For active conquest as of `as_of`:

`effective_end = min(raw_end, as_of)`

For completed conquest:

`effective_end = min(raw_end, conquest_end)`

The day exists only when:

`raw_start < effective_end`

Day status:

- `complete`: full 24-hour interval lies inside known conquest interval;
- `active_partial`: current active day has not reached its 24-hour end;
- `final_partial`: conquest ended inside the day;
- `unavailable`: requested day is outside known conquest interval.

A day that ends exactly at `conquest_end` is `complete`, not `final_partial`.

## 9. Clock fraction vs data coverage

These MUST be separate.

### Day span fraction

For an existing day:

`day_span_fraction = (effective_end - raw_start) / DAY`

It describes how much of the theoretical 24-hour day exists/has elapsed by clock.

### Data coverage ratio

`coverage_ratio` describes how much of the relevant interval is supported by valid source observations/validation.

A day can have:

- `day_span_fraction = 1.0`
- but `coverage_ratio = 0.6`

because the clock continued during a data outage.

Never use one as the other.

## 10. Time semantics versioning

Chronicle defines:

`time_semantics_version = elapsed-war-clock@1`

Each war also has a mutable canonical source-time interpretation represented by `war_time_revision`.

Increment `war_time_revision` when a validated canonical source field materially changes:

- `conquest_start_at`;
- `conquest_end_at`;
- `resistance_start_at`.

`scheduled_conquest_end_at` does not alter elapsed-day mapping by itself, but changes should still be preserved in source observation history.

Derived time-relative aggregates/results MUST include:

- `time_semantics_version`;
- `war_time_revision`;
- source/input fingerprint.

Raw observations are never rewritten to "move them to another day"; buckets are recomputed.

## 10.1 Backend implementation types

Chronicle's .NET implementation SHOULD use NodaTime:

- Instant for absolute source/observation/canonical UTC instants;
- Duration for elapsed durations;
- LocalDate only for date-without-time concepts;
- ZonedDateTime/DateTimeZone only when an explicit display/user timezone is required.

Npgsql.EntityFrameworkCore.PostgreSQL.NodaTime is the PostgreSQL/EF mapping baseline. NodaTime.Serialization.SystemTextJson provides explicit JSON serialization.

System.TimeProvider is the only approved application source of "now". Domain/application services SHOULD NOT call DateTime.UtcNow or DateTimeOffset.UtcNow directly.

TimeProvider is a clock abstraction; NodaTime is the value/domain model. They are complementary.

Public API serialization remains ISO-8601 UTC and MUST preserve the existing API contract regardless of internal CLR type.

## 11. Canonical time fields and naming

### Source/fetch layer

Use explicit names:

- `requested_at`
- `completed_at`
- `captured_at`
- `source_timestamp`
- `source_map_last_updated_at`
- `source_map_last_updated_raw`
- `day_of_war_raw`

Avoid generic `timestamp`, `time`, `day`, or `lastUpdated` in Chronicle-owned models.

### War-relative layer

Use:

- `elapsed_war_seconds`
- `elapsed_war_day`
- `day_start_at`
- `day_end_exclusive_at`
- `day_span_fraction`
- `time_semantics_version`
- `war_time_revision`

### Calendar/display layer

Use:

- `calendar_date_utc` only where a UTC date is explicitly needed;
- localized time only in presentation;
- local/display timezone MUST NOT alter analytics.

## 12. Raw upstream dayOfWar

`dayOfWar` remains source evidence only.

Chronicle stores it as:

`day_of_war_raw`

Rules:

- do not use it to assign analytical day buckets;
- do not reconcile canonical elapsed-day values toward it;
- do not average/majority-vote it across maps to create a global day;
- do not use a decrease/jump to rewrite elapsed time.

It MAY be used for:

- source diagnostics;
- anomaly monitoring;
- future source-semantics research;
- explicit raw-source display if clearly labeled.

### dayOfWar anomaly signals

Record diagnostics for:

- regression within the same map;
- jump greater than expected between successive valid reports;
- disagreement among maps beyond a configured diagnostic threshold.

Such anomalies do not alter Chronicle's elapsed clock.

## 13. Point observation assignment

For a point observation at `observed_at = t`:

1. require valid conquest start;
2. require `t >= start`;
3. if end is known require `t < end`;
4. assign `elapsed_war_day(t)`;
5. derive fixed-duration analytical buckets relative to the same war anchor.

An observation exactly on a bucket boundary belongs to the new bucket.

## 14. Observed-change interval assignment

A polling-derived change is known only in:

`(previous_observed_at, current_observed_at]`

Chronicle MUST NOT use midpoint allocation.

For an analytical bucket/day:

- if the entire uncertainty interval can belong to only one bucket -> `bucket_assignment = exact_single_bucket`;
- if the uncertainty interval spans a boundary -> `bucket_assignment = boundary_ambiguous`;
- if it spans multiple boundaries -> preserve the candidate bucket/day range.

For elapsed days store:

- `earliest_possible_elapsed_day`;
- `latest_possible_elapsed_day`;
- `bucket_assignment_status`.

Daily objective-change counts MUST exclude boundary-ambiguous changes from the exact daily count by default and expose them separately as ambiguous/unallocated changes.

War-level counts may include the change once because its existence is observed even when exact daily attribution is unknown.

## 15. Counter deltas and bucket boundaries

For cumulative counters such as casualties, a delta between observations at `t0` and `t1` is known for the whole interval, not at exact intermediate instants.

v1 MUST NOT linearly or probabilistically split a counter delta across bucket boundaries.

For adjacent valid samples:

`delta = value(t1) - value(t0)`

If:

- delta < 0 -> correction/reset anomaly;
- interval gap exceeds the metric's maximum contiguous gap -> low-coverage/unusable pair;
- `t0` and `t1` are within one analytical bucket -> delta may contribute to that bucket;
- the interval crosses a bucket boundary -> mark the delta `boundary_ambiguous` for per-bucket allocation.

This makes daily totals conservative and reproducible.

A future interpolation/estimation model would require a separate metric version.

## 16. Coverage from observations and 304 validation

A `304 Not Modified` creates no duplicate payload or normalized fact.

However, a successful conditional validation is evidence that the previously cached representation remained current at the validation instant.

Coverage logic MAY therefore use:

- changed-response observation times;
- successful 304 validation times referencing the prior accepted representation.

This permits state coverage to extend through unchanged periods without duplicating source facts.

Coverage derivation MUST still account for:

- collector outages;
- failed requests;
- quarantined source observations;
- excessive gaps beyond expected cadence.

## 17. Coverage intervals

For a scope/metric define expected observation cadence `C` and maximum contiguous gap `G`.

Build valid coverage from adjacent valid/validated points.

For each pair:

- if gap <= `G`, the interval can contribute to covered duration;
- if gap > `G`, the excess is a coverage gap according to the metric policy.

Then:

`coverage_ratio = covered_duration / bucket_clock_span`

Coverage policy is metric/source-specific and versioned.

Do not infer full coverage merely because the bucket exists by clock.

## 18. Aggregation semantics

### Cumulative values

Bucket cumulative value:

- use the latest valid observation inside the bucket;
- expose its `observed_at`;
- do not claim it represents the exact bucket end unless observed at that instant.

### Delta counters

Sum only valid within-bucket adjacent deltas according to the metric version.

Expose:

- `observed_delta`;
- `covered_duration`;
- `boundary_ambiguous_delta_count` or amount where tracked;
- coverage ratio.

### Rates

`rate = observed_delta / covered_elapsed_hours`

Never divide by full bucket duration when data coverage is smaller.

### Objective changes

Count exact-single-bucket observed changes separately from boundary-ambiguous changes.

### Ownership/state duration

Exact duration cannot be known at a polling-derived state transition.

v1 SHOULD expose observed/derived state intervals with uncertainty boundaries. Any scalar ownership-duration metric MUST document how transition uncertainty is handled and be separately versioned.

## 19. 5m / 1h / 1d bucket alignment

All Chronicle analytical buckets are war-anchor-relative unless explicitly documented otherwise.

For width `W`:

`bucket_index(t,W) = floor((t - conquest_start) / W)`

`bucket_start(i,W) = conquest_start + i*W`

`bucket_end(i,W) = conquest_start + (i+1)*W`

For `1d`, display day number is `bucket_index + 1`.

A `1d` bucket is not UTC-midnight-to-midnight unless the war happened to start at UTC midnight.

## 20. Day vs Day

Canonical comparison is:

`Day N of war A vs Day N of war B`

where both use Chronicle elapsed-war-day semantics.

### Completed days

Compare full day interval only when both wars contain that day and metric coverage requirements pass.

### Active partial current day

Two supported modes:

1. **partial-as-is**
   - show current day to current `as_of`;
   - label partial;
   - do not compare raw full-day totals as like-for-like.

2. **like-for-like elapsed fraction**
   - let active fraction be `f`;
   - compare each historical Day N only over its first `f * 24h`;
   - requires source resolution capable of that cut;
   - lower-resolution historical daily aggregates are ineligible.

The response/UI MUST state the mode.

### Cumulative at boundary

If an exact sample at the boundary is unavailable, return nearest supported observed value with:

- `observedAt`;
- `boundaryAgeSeconds`;
- quality/coverage.

Do not silently interpolate.

## 21. Historical daily alignment

Historical imports must declare `time_alignment_class`.

Recommended values:

- `chronicle_exact` — raw timestamps allow exact Chronicle war-relative rebucketing;
- `source_day_exact_origin` — source daily buckets have a known origin exactly equivalent to Chronicle war start;
- `source_day_known_different_origin` — bucket origin known but differs from Chronicle day boundaries;
- `source_day_unknown_origin` — daily index exists but exact boundaries are unknown;
- `final_aggregate_only`.

Rules:

- only `chronicle_exact` and `source_day_exact_origin` may be called exact Day-vs-Day alignment;
- known-different-origin data may be used only by a metric/model explicitly designed for that source bucket system;
- unknown-origin daily data MUST NOT be remapped into Chronicle elapsed days with synthetic precision.

Preserve:

- source day index;
- source bucket start/end if known;
- source timezone/basis if known;
- alignment class;
- resolution class.

## 22. War duration and records

### Active war

`duration = as_of - conquest_start`

### Completed war

`duration = conquest_end - conquest_start`

Longest/shortest-war records use exact elapsed duration, not rounded day count.

Display MAY show:

- days;
- hours;
- minutes;

but sorting/ranking uses exact duration.

If end is missing/invalid, the war is not eligible for completed-duration records.

Resistance time is not included in conquest duration unless a separate explicitly named metric requests a wider lifecycle duration.

## 23. Canonical PostgreSQL model

Absolute source/observation times use `timestamptz`.

Raw Unix values use `bigint`.

### wars

Keep:

- `conquest_start_at timestamptz NULL`
- `conquest_end_at timestamptz NULL`
- `resistance_start_at timestamptz NULL`
- `scheduled_conquest_end_at timestamptz NULL`
- `war_time_revision integer NOT NULL DEFAULT 0`

### raw observations

Raw observation tables SHOULD primarily store absolute timestamps, not rely on persisted elapsed day as canonical truth.

`elapsed_war_day` / `elapsed_war_seconds` MAY be denormalized for performance only when paired with:

- `time_semantics_version`;
- `war_time_revision`;

and MUST be recomputable.

### aggregate buckets

`war_time_buckets` and `region_time_buckets` SHOULD include:

- `bucket_start timestamptz`
- `bucket_end_exclusive timestamptz`
- `bucket_width`
- `elapsed_war_day integer NULL`
- `day_status text NULL`
- `day_span_fraction numeric NULL`
- `coverage_ratio numeric NULL`
- `time_semantics_version text NOT NULL`
- `war_time_revision integer NOT NULL`
- `input_fingerprint char(64) NOT NULL`

No partitioning is required by time semantics alone.

## 24. .NET implementation

v1 SHOULD use built-in .NET time types; NodaTime is not required for these UTC-instant semantics.

Use:

- `DateTimeOffset` for source/canonical instants;
- `TimeSpan` for durations;
- `long` for raw Unix milliseconds and exact elapsed millisecond arithmetic where useful.

Rules:

- parse source integers with checked conversion;
- convert from Unix milliseconds explicitly;
- require/normalize offset zero for persisted canonical instants;
- never use `DateTime.Now`;
- never use unspecified/local `DateTime` in domain calculations;
- make bucket/day calculations pure functions.

Suggested domain functions:

```csharp
int GetElapsedWarDay(DateTimeOffset start, DateTimeOffset t);
(int Day, DateTimeOffset Start, DateTimeOffset EndExclusive) GetDayWindow(...);
int GetCompletedDayCount(DateTimeOffset start, DateTimeOffset end);
TimeSpan GetConquestDuration(...);
BucketAssignment ClassifyObservedInterval(...);
```

All functions MUST have exact boundary tests.

## 25. Public API naming

Prefer explicit fields:

- `conquestStartAt`
- `conquestEndAt`
- `resistanceStartAt`
- `scheduledConquestEndAt`
- `dataAsOf`
- `capturedAt`
- `sourceLastUpdatedAt`
- `elapsedWarSeconds`
- `elapsedWarDay`
- `dayStartAt`
- `dayEndExclusiveAt`
- `dayStatus`
- `daySpanFraction`
- `coverageRatio`
- `timeSemanticsVersion`
- `warTimeRevision`
- `dayOfWarRaw` only on diagnostic/source-detail surfaces.

Avoid ambiguous public fields:

- `warDay` without definition;
- `day`;
- `timestamp`;
- `lastUpdated` without source/domain qualifier;
- `elapsedDays` floating-point without a precise contract.

## 26. Routes

`GET /api/app/wars/{chronicleWarId}/days/{day}`

`day` is Chronicle 1-based elapsed war day.

The response MUST identify:

- requested day;
- effective interval;
- day status;
- clock-span fraction;
- data coverage;
- time semantics version;
- war time revision.

`GET /api/app/compare/days?day=N&wars=...`

uses the same semantics and supports an explicit partial comparison mode.

## 27. Invalidation

### Start changes from null to value

- create/increment canonical war time revision;
- classify prior observations relative to new start;
- compute war-relative buckets;
- do not mutate absolute raw timestamps.

### conquestStartTime changes

This changes every war-relative boundary.

Invalidate/recompute:

- all 5m/1h/1d war-relative aggregates;
- Daily Chronicle;
- Day-vs-Day;
- phase segmentation;
- time-indexed swings;
- War DNA/Similarity features depending on elapsed time;
- duration/pace records;
- share snapshots only if they are live; immutable snapshots remain pinned to their original revision.

### conquestEndTime appears/changes

Recompute:

- duration;
- final-day status/fraction;
- completed-war eligibility;
- tail buckets;
- duration/pace records;
- models depending on completion.

### resistanceStartTime changes

Recompute only features that explicitly use resistance/lifecycle phase boundaries.

## 28. Historical/share reproducibility

Immutable analytical/share outputs SHOULD pin:

- `time_semantics_version`;
- `war_time_revision`;
- input fingerprint.

Current canonical pages use the latest accepted war-time revision.

## 29. Failure modes explicitly prohibited

- `dayOfWar == elapsedWarDay`;
- UTC calendar date == elapsed war day;
- using local timezone for bucket assignment;
- using inclusive end on both neighboring buckets;
- applying `floor(duration/day)+1` to completed duration and creating an empty day at exact boundary;
- pausing elapsed clock during API/collector downtime;
- dividing a rate by uncovered wall time;
- assigning poll-derived change to midpoint;
- assigning boundary-crossing change to `current_observed_at` day as if exact;
- linearly splitting casualty deltas across day boundaries without a versioned estimation model;
- using map `lastUpdated` as item event time;
- overwriting raw observation timestamps after a corrected start time;
- converting low-resolution historical source days to Chronicle elapsed days when bucket origin is unknown.

## 30. Golden test matrix

Required deterministic tests:

1. start null -> no elapsed day.
2. `t < start` -> pre-conquest/unavailable.
3. `t == start` -> Day 1.
4. `t == start + DAY - 1ms` -> Day 1.
5. `t == start + DAY` -> Day 2.
6. arbitrary N exact boundary -> Day N+1 while active.
7. end inside Day 1 -> completed day count 1; final_partial.
8. end exactly at 24h -> day count 1; Day 1 complete.
9. end at 24h + 1ms -> day count 2; Day 2 final_partial.
10. end exactly at 48h -> day count 2.
11. end <= start -> anomaly.
12. current active day -> active_partial.
13. DST transition in a display timezone -> no analytical effect.
14. leap-day UTC date -> no analytical effect beyond normal elapsed seconds.
15. `dayOfWar` disagreement between maps -> diagnostic only.
16. `dayOfWar` regression -> diagnostic only.
17. observed-change interval entirely inside one day -> exact_single_bucket.
18. observed-change interval crossing one day boundary -> boundary_ambiguous.
19. interval crossing multiple days -> candidate range preserved.
20. counter delta inside one bucket -> allocatable.
21. counter delta crossing boundary -> not split in v1.
22. successful 304 after unchanged state -> extends validation coverage without duplicate fact.
23. collector outage -> elapsed day advances while coverage falls.
24. start-time correction -> raw timestamps unchanged; all war-relative buckets recomputed under new revision.
25. end-time correction -> final-day/duration recomputed.
26. historical daily aggregate with unknown origin -> no exact elapsed-day alignment.
27. duplicate payload -> no duplicate fact.
28. exact bucket boundary point -> new bucket.
29. observation exactly at conquest end -> excluded from conquest bucket.
30. completed duration sorting uses exact duration, not rounded days.

Property-based invariants:

- for any valid in-conquest `t`, exactly one elapsed day contains `t`;
- adjacent day intervals never overlap and have no gaps;
- elapsed day is monotonic for increasing in-conquest instants;
- completed day count is `ceil(duration/DAY)`;
- changing display timezone never changes bucket assignment;
- recomputation with identical anchor/version is idempotent.

## 31. Production acceptance gate

Time semantics are implementation-ready only when:

1. elapsed-war functions are pure and boundary-tested;
2. completed-day count is separate from day-at-instant;
3. all canonical calculations use UTC/POSIX instants;
4. `dayOfWar` cannot enter analytical bucket assignment;
5. conquest end is exclusive for conquest analytics;
6. start/end corrections create a new war time revision and invalidate derived data;
7. 304 validation is represented in coverage without duplicate source facts;
8. observed changes crossing boundaries remain ambiguous;
9. counter deltas are not silently interpolated across boundaries;
10. day span and data coverage are separate;
11. historical imports declare time alignment class;
12. Day-vs-Day partial mode is explicit;
13. duration records use exact elapsed duration;
14. API/OpenAPI uses unambiguous time field names;
15. golden/property tests cover all listed boundary cases.
