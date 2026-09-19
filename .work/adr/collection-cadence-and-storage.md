# ADR: Collection Cadence and Storage Shape

Status: **Accepted — 2026-09-19**

## Context

Chronicle is a historical/analytical product, not a tactical live-map replacement.

The collection problem has two conflicting properties:

1. Some source values are cumulative counters. Coarser polling usually preserves the eventual total but reduces temporal resolution.
2. Dynamic map data is snapshot state. Intermediate states can disappear between polls and cannot be reconstructed later from the current-state API.

Chronicle also needs replayable source evidence for identity and analytics without writing every unchanged map item as a new PostgreSQL row on every snapshot.

See:

- [INGESTION.md](../INGESTION.md)
- [DATA_MODEL.md](../DATA_MODEL.md)
- [OBJECTIVE_IDENTITY.md](../OBJECTIVE_IDENTITY.md)
- [DATA_LIFECYCLE.md](../DATA_LIFECYCLE.md)
- [research/COLLECTION_CADENCE_STORAGE_ANALYSIS_2026-09-19.md](../research/COLLECTION_CADENCE_STORAGE_ANALYSIS_2026-09-19.md)

## Decision

### Collection profile v1

Chronicle defines:

`collection_profile_version = chronicle-collection-v1`

Target cadence per shard:

- `/worldconquest/war` — **5 minutes**
- `/worldconquest/warReport/:map` — **15 minutes**
- `/worldconquest/maps/:map/dynamic/public` — **15 minutes**
- `/worldconquest/maps` — **60 minutes**
- `/worldconquest/maps/:map/static` — **once per (shard, warId, map)**

Additional map-list refresh is triggered on war transition and reconciliation/discovery conditions such as an unexpected map-specific 404.

Upstream cache eligibility always wins over Chronicle's target interval.

All conditional endpoints use ETag/`If-None-Match`.

### Fixed cadence, no hot mode in v1

v1 does not implement activity-triggered hot polling.

Reasons:

- a short `A -> B -> A` state can disappear entirely before a coarse baseline poll and therefore cannot trigger hot mode;
- fixed cadence produces cleaner coverage semantics;
- fixed cadence gives a comparable corpus for 15m -> 30m -> 60m downsampling analysis;
- scheduler complexity is not justified before empirical evidence.

### Planning baseline

Capacity calculations use **30 active maps per shard** unless a specific environment supplies a different count.

At that baseline the regular schedule produces:

- 6,072 requests/day/shard;
- 182,160 regular requests per 30-day war;
- 2,216,280 regular requests/year/shard;

plus one-time static/recovery/retry requests.

These are schedule counts, not guaranteed HTTP transfer counts.

### Storage shape

Chronicle separates:

1. **fetch/validation metadata** in PostgreSQL;
2. **exact raw payload evidence** through one hybrid payload abstraction:
   - small payloads MAY be inline PostgreSQL `bytea`;
   - larger payloads use Zstandard-compressed external CAS;
3. **sparse relational semantic history** in PostgreSQL;
4. **derived aggregates/models** in PostgreSQL.

Exact raw payload evidence is the complete replay basis. Physical storage kind is an implementation policy and does not change source content identity.

Detailed archival/recovery behavior is owned by DATA_LIFECYCLE.md and adr/data-lifecycle-and-recovery.md.

PostgreSQL MUST NOT durably expand every unchanged map item occurrence from every changed snapshot merely for replayability.

Relational source-item evidence is materialized when it is needed to anchor:

- first-seen state;
- material semantic change;
- reappearance;
- ambiguity/unmatched state;
- manual review;
- persisted matcher/reprocessing decisions.

Unchanged item presence is represented through snapshot/coverage validation rather than another duplicate item row.

### Long-term replay evidence

Unique changed raw payloads required to reproduce Chronicle-collected history are retained long-term by default.

A 304 or byte-identical 200 does not create a duplicate payload.

Storage tier may change later, but content identity and replayability must survive.

### Two hashes/fingerprints

Chronicle keeps:

- raw `content_hash` — exact source response bytes;
- versioned `semantic_fingerprint` — canonical parser-level representation insensitive to irrelevant ordering/serialization differences.

A byte-level change with unchanged semantic fingerprint does not cause item-level relational mutation.

### Calibration

After a representative corpus exists, Chronicle must simulate 30m and 60m collection by downsampling the native 15m corpus.

Cadence may change only after measuring:

- transition retention;
- short excursion loss;
- ownership-duration drift;
- churn/recapture drift;
- phase stability;
- swing/model drift;
- operational/storage cost.

## Consequences

- Chronicle preserves substantially more transient history than hourly-only collection.
- Public UI refresh/resolution can remain coarser than collection resolution.
- Normal dynamic/war-report uncertainty is about 15 minutes under healthy collection, but outages/cache restrictions can widen it.
- A transient state wholly between two polls remains fundamentally unobservable.
- PostgreSQL growth is driven by semantic change and analytical history rather than `polls × all_items`.
- Raw evidence growth is measured separately by inline bytes and external original/compressed bytes.
- Objective Identity reprocessing reads raw archived snapshots when full occurrence reconstruction is required.

## Rejected alternatives

### Hourly-only dynamic collection

Rejected as the initial baseline because transient snapshot states are irrecoverable and the operational saving is small relative to the lost future analytical options.

It may be reconsidered after downsampling evidence.

### 3–5 second collection

Rejected because Chronicle is not a tactical live tracker and snapshot API semantics still would not become an exact event stream.

### Adaptive hot mode as the primary strategy

Rejected for v1 because invisible `A -> B -> A` transitions cannot trigger it and because it complicates coverage/calibration.

### Full relational snapshot expansion

Rejected because at 30 maps/15m it can create tens or hundreds of millions of item-occurrence rows per year depending on item count/change rate.

### Precise GB/year forecast before measurement

Rejected.

Initial capacity planning may reserve headroom, but physical DB/raw growth must be measured from real payloads, compression, indexes and semantic-change rates.

## Review trigger

Revisit this ADR after:

- at least one representative war or equivalent corpus;
- measured per-table/index DB growth;
- measured compressed raw archive growth;
- 15m/30m/60m downsampling comparison.

Any cadence change creates a new `collection_profile_version`.
