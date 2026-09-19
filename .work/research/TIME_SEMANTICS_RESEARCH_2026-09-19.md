# Time Semantics / Elapsed War Day — Deep Research Synthesis

Research date: **2026-09-19**  
Status: **Supporting research; authoritative decisions are in TIME_SEMANTICS.md and the elapsed-war-day ADR**

## Accepted findings

- The official War API exposes `conquestStartTime`, `conquestEndTime`, `resistanceStartTime`, `scheduledConquestEndTime`, map `lastUpdated`, and map-specific `dayOfWar`.
- Official war examples use 13-digit Unix timestamps; map `lastUpdated` is explicitly documented as milliseconds from epoch.
- `dayOfWar` is map-report data and is not formally defined by the official documentation as Chronicle's desired 24-hour war-relative analytical bucket.
- Historical official issue evidence exists for `dayOfWar` desynchronization/reset behavior; it is not evidence of a current bug.
- Chronicle should use a continuous UTC/POSIX elapsed clock anchored to validated `conquestStartTime`.
- Maintenance/API downtime does not pause elapsed time; missing observations reduce coverage instead.
- Local timezone and DST must never affect analytical bucket assignment.
- Poll-derived state changes remain uncertainty intervals and must not be assigned a fake exact timestamp.

## Corrections to the raw research report

The research report contains several recommendations that are **not** accepted as authoritative:

1. A completed war ending exactly at a 24-hour boundary must not create a new empty final day.
   - For `duration = 48h`, the completed war contains 2 elapsed-day buckets, not 3.
   - `day_at_instant(t)` applies only to instants inside the conquest interval.
   - Final day count is `ceil(duration / 24h)` for a valid positive duration.

2. The report's 2026 leap-year example is invalid because 2026 is not a leap year.

3. The report states that `dayOfWar` changes at server/UTC midnight. The official README does not document this guarantee. Chronicle must not encode it.

4. `(war_id, captured_at)` is not the source/fetch idempotency key. Existing Chronicle ingestion correctly separates fetch identity, content identity and normalized facts.

5. Partitioning/BRIN are not accepted merely because data is time-series. Existing measured-need policy remains.

6. `If-Modified-Since`/history-fetch behavior is not assumed where the official API only documents ETag/`If-None-Match`.

7. Daily aggregates must not be generated at UTC midnight. Chronicle elapsed-day boundaries are relative to `conquestStartTime`.

## Final design direction

Chronicle should adopt:

- `time_semantics_version = elapsed-war-clock@1`;
- half-open conquest interval `[conquestStart, conquestEnd)` when end is known;
- elapsed day N = `[start + (N-1)*24h, start + N*24h)`;
- raw `dayOfWar` as diagnostics/source evidence only;
- separate absolute timestamps and derived war-relative time;
- explicit `war_time_revision`/anchor fingerprint so a source correction can invalidate derived buckets without rewriting raw observations;
- boundary-ambiguous classification for poll-derived changes whose uncertainty interval crosses analytical bucket boundaries;
- no linear/probabilistic allocation of counter deltas across a bucket boundary in v1;
- distinct clock-span fraction vs data-coverage ratio;
- historical daily buckets aligned to Chronicle elapsed days only when their source origin is actually known.

## Important ingestion implication

A successful `304 Not Modified` creates no duplicate fact/payload, but it is still evidence that the cached source representation remained current at that fetch instant. Coverage logic may use such validation fetches to extend known-state validation without inserting duplicate normalized observations.

## Implementation order

1. Add authoritative TIME_SEMANTICS.md.
2. Finalize elapsed-war-day ADR.
3. Add war time revision/version fields to the logical data model.
4. Make bucket assignment a pure domain function.
5. Add boundary-ambiguity fields for observed changes/counter deltas.
6. Make coverage aware of successful 304 validation points.
7. Update metric aggregation rules.
8. Update Day-vs-Day and duration semantics.
9. Add API names that distinguish source time, capture time and elapsed-war time.
10. Add boundary/gap/start-correction golden tests.
