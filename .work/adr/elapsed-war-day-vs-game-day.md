# ADR: Elapsed War Day vs Upstream dayOfWar

Status: **Accepted — deep research integrated 2026-09-19**

## Context

Chronicle needs stable cross-war time semantics for Daily Chronicle, Day-vs-Day, War Pace, phases, swings, records and historical comparison.

The official War API exposes:

- `conquestStartTime` on global war state;
- `conquestEndTime`;
- map-specific `dayOfWar` on war-report responses.

The official documentation calls `dayOfWar` the current day of war but does not define it as a 24-hour interval anchored to `conquestStartTime`. Historical official-repository issue #81 also documents a past per-map desynchronization/reset failure mode. That issue is not evidence of a current bug, but it reinforces that `dayOfWar` is source evidence rather than Chronicle's canonical analytical clock.

Chronicle also needs exact boundary semantics that remain valid across UTC dates, DST, collector outages and source corrections.

See [TIME_SEMANTICS.md](../TIME_SEMANTICS.md) and [WAR_API_SEMANTICS.md](../WAR_API_SEMANTICS.md).

## Decision

Chronicle defines a continuous elapsed conquest clock anchored to validated `conquestStartTime`.

`DAY = 86,400 seconds`

For an instant `t` inside conquest:

`elapsed_war_day(t) = floor((t - conquest_start) / DAY) + 1`

Day N is the half-open interval:

`[conquest_start + (N-1)*DAY, conquest_start + N*DAY)`

When `conquestEndTime` is known, conquest analytics use:

`[conquest_start, conquest_end)`

Therefore an instant exactly at conquest end is not assigned to a conquest day.

### Completed-war day count

The number of elapsed-day buckets intersected by a valid completed conquest is:

`completed_day_count = ceil((conquest_end - conquest_start) / DAY)`

This is intentionally separate from `elapsed_war_day(t)`.

A war ending exactly 48 hours after start contains 2 completed elapsed-day buckets, not an empty third day.

### Upstream dayOfWar

Chronicle stores `dayOfWar` as `day_of_war_raw`.

It MUST NOT:

- assign analytical day buckets;
- override the elapsed clock;
- become a global day by cross-map majority/average;
- shift historical aggregates when it disagrees with Chronicle elapsed time.

It MAY be used for diagnostics/source research.

### Downtime

Elapsed time is wall-clock/POSIX elapsed time.

Maintenance, API outage, collector outage and periods without source changes do not pause the clock. They reduce data coverage.

### Versioning

Chronicle uses:

`time_semantics_version = elapsed-war-clock@1`

Each war also has a `war_time_revision` representing the accepted source-time anchors.

A corrected conquest start creates a new war-time revision and invalidates all war-relative derived buckets without rewriting raw absolute observation timestamps.

## Consequences

- Day-vs-Day is independent of UTC midnight and local timezone.
- DST has no effect on analytics.
- Current/final days can be partial by clock.
- Clock-span fraction and source-data coverage remain separate.
- Exact 24-hour boundaries are deterministic and free from double counting.
- Historical daily aggregates are comparable only when their bucket origin can be aligned defensibly.
- Poll-derived changes crossing day boundaries remain boundary-ambiguous instead of being assigned a fake event day.

## Rejected alternatives

- use raw `dayOfWar` as canonical analytics day;
- use UTC calendar day;
- use local/server-local calendar day;
- pause elapsed time during downtime;
- use inclusive end on both neighboring days;
- compute completed day count as `floor(duration/DAY)+1`;
- assign polling-derived changes to interval midpoint;
- silently remap unknown-origin historical daily aggregates into Chronicle elapsed days.

## Rule

No code may treat `dayOfWar`, UTC calendar date, display-local date and `elapsed_war_day` as interchangeable.

All domain calculations MUST follow TIME_SEMANTICS.md.
