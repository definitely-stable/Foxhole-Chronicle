# Collection Cadence and Storage Analysis — 2026-09-19

Status: **Supporting analysis; accepted decisions are in INGESTION.md, DATA_MODEL.md, OBJECTIVE_IDENTITY.md and adr/collection-cadence-and-storage.md**

## 1. Question

Chronicle must choose a collection cadence that preserves useful historical information without behaving like a tactical live-map collector, and it must do so without creating an avoidable relational-storage explosion.

The selected planning baseline is **30 active maps per shard**.

## 2. Accepted collection profile

Collection profile:

`chronicle-collection-v1`

- `/worldconquest/war`: every **5 minutes**
- `/worldconquest/warReport/:map`: every **15 minutes per active map**
- `/worldconquest/maps/:map/dynamic/public`: every **15 minutes per active map**
- `/worldconquest/maps`: every **60 minutes**, plus immediate refresh on war transition and map-specific discovery/reconciliation triggers
- `/worldconquest/maps/:map/static`: **once per (shard, warId, map)** unless an explicit revalidation/recovery workflow requires another request
- all requests remain subordinate to upstream cache eligibility and use ETag/`If-None-Match`

v1 deliberately has **no adaptive hot mode**. A fixed cadence gives simpler scheduling, comparable coverage and a clean corpus for later downsampling studies.

## 3. Why different endpoints use different cadence

### War state — 5 minutes

War state is a single request per shard, not one request per map.

Frequent collection is useful because the endpoint is the lifecycle anchor for:

- `warId`;
- conquest start/end;
- resistance start;
- scheduled short-conquest end;
- winner/result state.

A delayed fetch can widen uncertainty around when Chronicle first learned a lifecycle transition. Five minutes costs little and sharply limits normal detection delay.

### War report — 15 minutes

Casualty/enlistment counters are cumulative snapshots. Less frequent polling does not normally lose the final cumulative value, but it does reduce temporal resolution for:

- casualty-rate curves;
- regional intensity;
- phase-model inputs;
- outage resilience and gap width.

Four samples/hour is a good historical-resolution baseline without approaching tactical polling.

### Dynamic public map — 15 minutes

Dynamic map data is **state**, not a historical event stream.

If Chronicle samples:

`A at 12:00 -> A at 12:15`

the source may still have passed through:

`A -> B -> A`

inside that interval. That intermediate state is unrecoverable later.

Therefore dynamic cadence is chosen primarily to reduce irreversible information loss, not to make the UI update every 15 minutes.

The public UI may aggregate/display at 1h or 1d while collection remains 15m.

### Maps — 60 minutes

The map set is discovery/configuration data, not a high-frequency analytical signal. Refresh immediately on war transition or a map-specific inconsistency/404 before classifying the map as retired/invalid.

### Static — once

Static data is reference data. Fetch once for each active map in each war unless recovery/revalidation is explicitly needed.

## 4. Exact request-volume model for 30 maps

Per shard, excluding retries and one-time static fetches:

### Per day

- war: `24 * 60 / 5 = 288`
- warReport: `30 * 24 * 60 / 15 = 2,880`
- dynamic: `30 * 24 * 60 / 15 = 2,880`
- maps: `24`

Total:

`288 + 2,880 + 2,880 + 24 = 6,072 requests/day`

Average:

- `253 requests/hour`
- `4.2167 requests/minute`
- `0.0703 requests/second`

### Per 30-day war

Regular requests:

`6,072 * 30 = 182,160`

Static baseline:

`30`

Total planning count:

`182,190 requests`

excluding retries/recovery requests.

### Per 365-day year

Regular requests:

`6,072 * 365 = 2,216,280 requests/year`

Breakdown:

- war: `105,120/year`
- warReport: `1,051,200/year`
- dynamic: `1,051,200/year`
- maps: `8,760/year`

These are exact schedule counts for the stated assumptions, not measured HTTP traffic.

## 5. Temporal-information consequences

### Normal uncertainty width

With healthy regular collection:

- war lifecycle first-observation delay: up to about 5 minutes plus source/cache/network effects;
- warReport interval width: about 15 minutes;
- dynamic state-change observation interval: about 15 minutes.

Failures/cache restrictions widen those intervals and are represented through coverage/freshness metadata.

### Irrecoverable snapshot loss

A short-lived state entirely contained between two dynamic polls can be missed.

For a state lasting `d` minutes under a periodic cadence `T`, if its start is treated as uniformly distributed relative to the poll schedule, the simple intersection probability is approximately:

`min(1, d/T)`

This is a mathematical polling model, not measured Foxhole behavior.

It explains why 15m preserves substantially more transient states than 30m/60m and why downsampling can be done later while missing history cannot be reconstructed.

## 6. Calibration/downsampling plan

After a representative corpus is available, simulate coarser schedules from the 15m dataset:

- 15m -> 30m;
- 15m -> 60m.

Measure:

1. observed transition retention;
2. short excursion loss (`A -> B -> A`);
3. objective ownership-duration drift;
4. objective churn/recapture drift;
5. War Phase boundary/label stability;
6. Swing Analysis drift;
7. War DNA/Similar Wars feature drift;
8. request count and source 200/304 ratio;
9. transferred/stored bytes;
10. PostgreSQL growth by table/index.

Cadence MUST NOT be relaxed merely because the site UI does not need 15-minute refreshes.

## 7. The relational-storage trap

Dynamic polling count at 30 maps/15m is:

`1,051,200 dynamic polls/year`

A naive schema that writes every map item as a relational row on every changed snapshot can dominate the database.

Illustrative upper model if every dynamic poll produces a changed payload:

| Average public items/map snapshot | item occurrence rows/year |
|---:|---:|
| 50 | 52,560,000 |
| 100 | 105,120,000 |
| 200 | 210,240,000 |

At 50% changed-payload ratio these values halve.

The row counts are exact arithmetic under the stated assumptions; the physical GB cost is **UNKNOWN until PostgreSQL row/index size and real payload behavior are measured**.

Therefore Chronicle MUST NOT make “one relational row per unchanged item occurrence per snapshot” its durable storage model.

## 8. Accepted storage split

### Layer A — fetch/validation metadata

Store fetch metadata in PostgreSQL:

- semantic endpoint;
- scheduled/request/completion timestamps;
- HTTP result;
- ETag/cache metadata;
- content hash;
- representation payload link;
- collection profile version;
- target interval;
- parser/schema metadata;
- error/outcome.

A 304 stores validation metadata only and references the prior accepted representation.

The v1 baseline keeps fetch metadata long-term. At ~2.2M scheduled rows/year per shard, this is not by itself a reason to add compaction complexity. Revisit after measured table/index growth.

### Layer B — immutable raw changed payload archive

Changed/unique source payloads are the durable replay evidence.

Store:

- content-addressed compressed payload files outside PostgreSQL;
- hash/size/storage reference and source metadata in PostgreSQL.

Unlike the previous 30-day-hot-only idea, payloads required to reproduce Chronicle-collected history SHOULD be retained long-term. Old payloads may move to a colder filesystem/object-storage tier later without changing logical identity.

304 responses and byte-identical 200 responses do not create duplicate payloads.

### Layer C — sparse relational semantic history

PostgreSQL stores query-oriented facts:

- current/canonical objective state;
- state intervals;
- observed changes;
- first-seen/reappearance/material-change evidence;
- ambiguous/unmatched evidence;
- counters/time-series observations;
- coverage;
- aggregates/models.

It SHOULD NOT duplicate every unchanged raw item occurrence from every map snapshot.

### Layer D — replay/reprocessing

Matcher/parser reprocessing reads the immutable raw snapshot archive and can reconstruct ephemeral item occurrences for a selected war/map/time range.

Persistent matcher evidence is stored for material decisions/changes/ambiguities, not merely because the same unchanged item appeared in another snapshot.

## 9. Semantic snapshot fingerprint

Raw `content_hash` identifies exact response bytes.

Chronicle SHOULD additionally compute a parser/version-bound **semantic snapshot fingerprint** for map payloads:

- independent of JSON property/array ordering where ordering has no source semantics;
- based on normalized raw source values, not canonical objective identity;
- versioned by parser/canonicalization algorithm.

If raw bytes differ but semantic fingerprint is unchanged:

- retain raw payload/provenance as required;
- create/update map-observation provenance;
- skip item-level state mutation.

This prevents representation-only changes from creating false relational churn.

## 10. Source-item persistence refinement

Previous Objective Identity drafts defined `source_item_observations` as every raw item occurrence in every payload. That is replayable but storage-inefficient at 15m collection.

Revised rule:

- the immutable raw payload is the complete source occurrence evidence;
- relational `source_item_evidence` (or retained table name with revised semantics) materializes only item occurrences needed to anchor identity/state history;
- evidence reasons include first seen, material semantic change, reappearance, ambiguity, unmatched state, manual-review anchor and reprocessing anchor;
- unchanged occurrences need not create relational rows.

Identity algorithms MUST remain replayable from raw archived payloads.

## 11. Preliminary capacity model

Do not convert schedule counts directly into a precise GB/year claim.

Known schedule cardinalities at 30 maps:

- ~2.216M regular fetch interactions/year;
- ~1.051M warReport polls/year;
- ~1.051M dynamic polls/year.

Unknowns that dominate physical storage:

- 200 vs 304 ratio;
- changed-payload ratio;
- average compressed raw payload size;
- public item count distribution;
- semantic-change rate;
- index width;
- JSONB/row overhead;
- WAL/autovacuum behavior;
- retention/backups.

A provisional engineering envelope MAY reserve approximately **10 GB/year of PostgreSQL growth per shard** for initial VPS planning, but this is an **ESTIMATE/HEADROOM TARGET, not a measured forecast**.

Raw archive sizing MUST be computed from measured:

`sum(compressed_unique_payload_bytes)`

not from an assumed payload size.

## 12. Measurements required from day one

Metrics:

- requests by endpoint/status;
- 200/304 ratio;
- identical-200 ratio;
- raw changed-payload ratio;
- semantic-changed-payload ratio;
- raw bytes received;
- compressed bytes archived;
- map item count distribution;
- item material-change count;
- source item evidence rows created;
- objective observations/changes created;
- PostgreSQL relation/index bytes by table;
- daily DB growth;
- WAL bytes/day;
- backup bytes/day;
- replay throughput.

Report these at least daily during initial calibration.

## 13. Production gates

1. Scheduler implements the accepted fixed cadence and deterministic staggering.
2. Every fetch records `collection_profile_version`.
3. Coverage uses the expected interval from the active collection profile.
4. 304 extends validation evidence without duplicating source facts.
5. Exact/raw payload hash and semantic snapshot fingerprint are distinct.
6. Changed raw payloads required for replay are retained long-term.
7. No full relational expansion of unchanged items per snapshot.
8. Objective Identity can replay a war from raw archived payloads.
9. DB/raw-storage growth is measured daily.
10. 30m/60m cadence changes require downsampling evidence and an explicit spec/ADR update.
