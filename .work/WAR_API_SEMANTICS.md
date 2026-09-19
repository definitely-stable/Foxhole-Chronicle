# Foxhole Chronicle — War API Semantics

Status: **Authoritative source-semantics specification**  
Verification date: **2026-09-19**

This document is the implementation gate for the official Foxhole War API. It defines only semantics that Chronicle can defend from the official `clapfoot/warapi` documentation, official repository evidence, or explicitly labeled secondary observations.

Primary source:

- https://github.com/clapfoot/warapi
- https://github.com/clapfoot/warapi/blob/master/README.md
- https://github.com/clapfoot/warapi/blob/master/LICENSE.md

Secondary evidence is used only where the official README is silent and is labeled as such.

## 1. Evidence classes

- **VERIFIED FACT** — explicitly documented by the official War API repository.
- **OBSERVED/SECONDARY** — observed in a live payload or documented by a secondary Foxhole source, but not an official API guarantee.
- **HISTORICAL ISSUE EVIDENCE** — an official-repository issue demonstrating a failure mode; it does not prove that the bug still exists.
- **UNKNOWN** — no defensible source guarantee found.
- **DESIGN DECISION** — Chronicle behavior chosen to remain correct under the known semantics.

Code MUST NOT silently upgrade OBSERVED/SECONDARY or UNKNOWN behavior into a source guarantee.

## 2. Endpoint inventory

The official API is HTTPS/JSON and is documented as War API v1.

| Capability | Endpoint | Official semantics | Documented update cadence |
|---|---|---|---|
| Current war state | `GET /worldconquest/war` | Current war identity/status/configuration | may update every 60 s |
| Active map names | `GET /worldconquest/maps` | Active World Conquest map names | not specified |
| Region war report | `GET /worldconquest/warReport/:mapName` | map-specific enlistments, casualties, `dayOfWar` | may update every 3 s |
| Static map data | `GET /worldconquest/maps/:mapName/static` | labels/resource nodes/world structures intended not to change during a map lifecycle | request once per map between World Conquests |
| Dynamic public map | `GET /worldconquest/maps/:mapName/dynamic/public` | public map icons that can change during the map lifecycle; team-specific data and forward bases excluded | may update every 3 s |

The official documentation currently lists shard roots:

- Live-1: `https://war-service-live.foxholeservices.com/api`
- Live-2: `https://war-service-live-2.foxholeservices.com/api`
- Live-3: `https://war-service-live-3.foxholeservices.com/api`
- Dev, when active: `https://war-service-dev.foxholeservices.com/api`

**DESIGN DECISION:** `shard` is mandatory provenance on every official-source fetch and normalized fact. Dev data MUST be isolated from production historical cohorts.

## 3. War identity

Official `/worldconquest/war` fields:

- `warId` — documented as the unique ID for the war.
- `warNumber` — documented as the current war number **for the shard**.
- `winner` — `NONE`, `WARDENS`, or `COLONIALS`.
- `conquestStartTime` — Unix timestamp or null before conquest starts.
- `conquestEndTime` — Unix timestamp or null before conquest ends.
- `resistanceStartTime` — Unix timestamp or null before resistance starts.
- `scheduledConquestEndTime` — short-conquest scheduled end timestamp or null.
- `requiredVictoryTowns` — configured required victory towns.
- `shortRequiredVictoryTowns` — short-conquest requirement when applicable.

The official docs explicitly say `warNumber` is shard-scoped. They call `warId` unique, but do not explicitly define cross-shard/global uniqueness semantics.

**DESIGN DECISION:**

- Chronicle canonical war PK remains internal UUID.
- Official runtime natural identity is `(shard, warId)`.
- `warNumber` MUST NOT be a relational key.
- PostgreSQL SHOULD enforce a partial unique constraint on `(shard, source_war_id)` when `source_war_id IS NOT NULL`.
- Chronicle MUST preserve the raw `warId` string even if it currently looks UUID-shaped.

Victory-town logic: the official docs state that `requiredVictoryTowns` is a static configuration value and does not account for scorched victory towns. A scorched victory town is a map item with both `IsVictoryBase` and `IsScorched`; consumers calculating the effective requirement must account for those separately.

## 4. Time semantics

### 4.1 Official timestamps

`conquestStartTime`, `conquestEndTime`, `resistanceStartTime`, and `scheduledConquestEndTime` are documented as Unix timestamps. Official examples are 13-digit values. Map-data `lastUpdated` is explicitly documented as **milliseconds from Unix epoch**.

**DESIGN DECISION:** source DTOs MUST initially deserialize source timestamps as nullable `long`, preserve the raw integer, validate the expected millisecond range, and only then convert with millisecond Unix semantics. A value outside a plausible millisecond range MUST be quarantined rather than silently interpreted as seconds.

### 4.2 `lastUpdated`

For static/dynamic map payloads:

- `lastUpdated` is the time the map data was last updated;
- it is not documented as the time of an individual capture, destruction, ownership transfer, upgrade, or other map-item event.

Therefore `lastUpdated` is source-state metadata, not an exact event timestamp.

### 4.3 `dayOfWar`

`dayOfWar` is returned by each map's war-report endpoint. The official documentation calls it the current day of war but does not define it as a 24-hour elapsed bucket and does not provide a global war-state `dayOfWar`.

Historical official-repository issue #81 reported per-map reset/desynchronization of this field and was later marked fixed. That issue is historical evidence for defensive validation, not proof of a current defect.

**DESIGN DECISION:** Chronicle keeps `dayOfWar` as `day_of_war_raw` only. Day-vs-Day and Daily Chronicle use:

`elapsed_war_day = floor((t - conquestStartTime) / 86400s) + 1`

with day N defined as:

`[conquestStartTime + (N-1)*24h, conquestStartTime + N*24h)`

The first and last analytical days may be partial. Maintenance does not stop this elapsed clock.

## 5. War report semantics

Official documented response fields are:

- `totalEnlistments`
- `colonialCasualties`
- `wardenCasualties`
- `dayOfWar`

The official README describes the endpoint as **map specific**.

### 5.1 Enlistments

The official README does not define whether `totalEnlistments` is globally unique, map-unique, event-counted, or resettable beyond calling it the number of enlistments for a map-specific report.

The Foxhole Wiki's War API page states that enlistments are unique players per map and that a player appearing in multiple maps contributes to multiple map totals. This is useful secondary evidence, but it is not an official API contract.

**Chronicle rule:**

- store as `region_enlistments`;
- never sum regions and label the result "unique players";
- never use it as faction population;
- never use it as global concurrency;
- expose provenance and scope in the public API.

### 5.2 Casualties

Casualty counters are map-specific. The official documentation does not state a monotonicity/correction/reset guarantee.

**Chronicle rule:** increasing values produce valid positive deltas. Equal values produce zero delta. A decrease is a reconciliation anomaly until explained by war transition/source reset/correction logic; it MUST NOT become a negative-casualty metric.

## 6. Map data schema

Official map-data envelope:

- `regionId` — internal region ID for the map.
- `scorchedVictoryTowns`.
- `mapItems[]`.
- `mapTextItems[]`.
- `lastUpdated` — milliseconds from epoch.
- `version` — version index that increments whenever that map data changes and is used for caching.

Official map item:

- `teamId`: `NONE | WARDENS | COLONIALS`.
- `iconType`: integer icon code.
- `x`, `y`: normalized map coordinates.
- `flags`: bitmask.

Official map text item:

- `text`.
- `x`, `y`: normalized map coordinates.
- `mapMarkerType`: `Major | Minor`; Major markers form the basis of Region Zones.

The official README does **not** expose a stable map-item/objective ID.

Array ordering is not documented as stable and MUST NOT participate in identity.

The README documents fixed world extents for converting normalized coordinates to in-game coordinates, but does not currently document coordinate origin/orientation. Official issue #91 requests documentation that the origin is top-left; because that issue remains a documentation request, Chronicle MUST NOT treat it as an official guarantee needed for identity.

## 7. Static vs dynamic data

Static endpoint semantics: labels, resource nodes, and world structures that do not change over the lifecycle of a map; official guidance says it only needs to be requested once per map between World Conquests.

Dynamic/public semantics: public map icons that can change over the lifecycle of a map. Team-specific data and forward bases are excluded.

There is no documented item-level event timestamp and no documented item-level stable ID.

**DESIGN DECISION:**

- static payload establishes per-war/per-map reference metadata;
- dynamic payload establishes observed public state;
- a dynamic disappearance alone MUST NOT be interpreted as destruction;
- `teamId=NONE` alone MUST NOT be interpreted as a capture/destruction event without comparison to valid neighboring observations and anomaly checks;
- icon changes MUST be preserved as raw state changes and interpreted only through versioned taxonomy logic.

Historical official issue #92 showed that server restarts once produced partial dynamic payloads with many `teamId=NONE` values and false event-log churn; the issue was later marked fixed. Chronicle still needs a defensive "mass state collapse" anomaly detector so one malformed/partial observation cannot generate hundreds of false objective events.

## 8. Official icon and flag semantics

Current official README icon codes include:

| Code | Official label |
|---:|---|
| 5 | Static Base 1 — removed Update 46 |
| 6 | Static Base 2 — removed Update 46 |
| 7 | Static Base 3 — removed Update 46 |
| 8 | Forward Base 1 |
| 9 | Forward Base 2 — removed Update 50 |
| 10 | Forward Base 3 — removed Update 50 |
| 11 | Hospital |
| 12 | Vehicle Factory |
| 17 | Refinery |
| 18 | Shipyard |
| 19 | Tech Center / Engineering Center |
| 20 | Salvage Field |
| 21 | Component Field |
| 22 | Fuel Field |
| 23 | Sulfur Field |
| 27 | Special Base (Keep) |
| 28 | Observation Tower |
| 29 | Fort |
| 32 | Sulfur Mine |
| 33 | Storage Facility |
| 34 | Factory |
| 35 | Garrison Station |
| 37 | Rocket Site |
| 38 | Salvage Mine |
| 39 | Construction Yard |
| 40 | Component Mine |
| 45 | Relic Base 1 |
| 46 | Relic Base 2 — removed Update 52 until further notice |
| 47 | Relic Base 3 — removed Update 52 until further notice |
| 51 | Mass Production Factory |
| 52 | Seaport |
| 53 | Coastal Gun |
| 54 | Soul Factory |
| 56 | Town Base 1 |
| 57 | Town Base 2 |
| 58 | Town Base 3 |
| 59 | Storm Cannon |
| 60 | Intel Center |
| 61 | Coal Field |
| 62 | Oil Field |
| 70 | Rocket Target |
| 71 | Rocket Ground Zero |
| 72 | Rocket Site With Rocket |
| 75 | Facility Mine Oil Rig |
| 83 | Weather Station |
| 84 | Mortar House |
| 88 | Aircraft Depot |
| 89 | Aircraft Factory |
| 90 | Aircraft Radar |
| 91 | Aircraft Runway (T1) |
| 92 | Aircraft Runway (T2) |

Removed historical codes listed by the official README but omitted above from active taxonomy MUST still be accepted as raw integers.

Official flags:

- `0x01 IsVictoryBase`
- `0x02 IsHomeBase` — removed Update 29
- `0x04 IsBuildSite`
- `0x10 IsScorched`
- `0x20 IsTownClaimed`

The official docs explicitly warn that unlisted flag bits are internal and may be removed at any time.

**DESIGN DECISION:** Chronicle MUST preserve the complete raw integer `flags`, decode only documented bits, and retain unknown bits without assigning semantics.

## 9. Objective identity feasibility

**VERIFIED FACT:** the documented map-item schema has no stable item/objective ID.

**UNKNOWN:** cross-war stability guarantees for coordinates, names, icon codes, and `regionId` are not documented.

Therefore Chronicle cannot derive a guaranteed durable cross-war objective identity from a single upstream key.

### v1 identity policy

Within a war/map:

1. scope candidates by shard + war + source map name;
2. use static reference data where applicable;
3. compare normalized coordinates;
4. require compatible objective family/icon semantics;
5. use Major text labels/name only as supporting evidence;
6. compare local neighborhood/context where needed;
7. accept only an unambiguous best match;
8. otherwise quarantine as unmatched/ambiguous.

Across wars, matching MUST be stricter and may create a new revision or identity rather than force a merge.

No numeric coordinate tolerance is authoritative yet. It MUST be calibrated against a captured real-payload corpus and golden fixtures before production matching is enabled.

Every accepted match records:

- identity algorithm version;
- match method;
- candidate evidence;
- distance/score where applicable;
- ambiguity margin;
- source map version;
- source payload hash.

## 10. HTTP caching and polling

Official documentation:

- asks clients to respect returned caching headers;
- says API responses include `ETag`;
- says clients should send `If-None-Match`;
- documents `304 Not Modified`;
- notes that an expired cache may still return 304 if underlying data did not change.

No numeric request-rate limit is documented in the official README.

**DESIGN DECISION:**

- ETag is a transport/cache validator, not Chronicle's durable content identity.
- SHA-256 of response bytes remains the payload identity.
- scheduler MUST honor response cache eligibility before Chronicle's own target interval;
- on 304, record the fetch but create no payload/fact observation;
- on 200 with unchanged SHA-256, record the fetch but skip normalization/fact mutation;
- on 200 with changed content, persist payload then normalize/reconcile.

Because Chronicle is historical analytics rather than a tactical live map, initial target polling SHOULD be approximately 60 seconds for dynamic map and war-report data, 60 seconds for war state, and transition/new-map driven for static data, while always respecting stricter upstream cache headers. These are Chronicle product targets, not upstream guarantees.

## 11. Event-time epistemics

For objective/public-map state the source provides state snapshots, not an event stream.

If state A is valid at observation t0 and state B is valid at t1, Chronicle may assert only:

`change observed in (t0, t1]`

unless a future official field explicitly supplies an event timestamp with documented semantics.

Do not use:

- midpoint as capture time;
- fetch completion time as capture time;
- `lastUpdated` as item event time;
- map `version` as a timestamp.

## 12. Cross-endpoint consistency

The official documentation gives no transactional/atomic consistency guarantee across war state, map list, war reports, static maps, or dynamic maps.

**DESIGN DECISION:** one Chronicle collection cycle is an **observation batch**, not an atomic world snapshot.

Persist:

- batch start/end;
- each endpoint's request/completion time;
- each endpoint's ETag/content hash;
- each map's `lastUpdated` and `version`.

Analytics spanning multiple endpoints MUST use coverage/freshness tolerances and MUST NOT imply simultaneous source state.

## 13. Error and anomaly policy

Chronicle MUST handle:

- unknown/removed map -> classify 404/permanent-for-current-list, refresh map list before retrying;
- 5xx/timeout -> transient retry with jitter, serve last-known-good;
- malformed JSON/type drift -> quarantine parser result, retain raw payload when policy allows;
- reordered arrays -> no semantic change by itself;
- unknown enum/icon/flag -> preserve raw value and mark unknown;
- counter decrease -> anomaly/reset/correction workflow;
- mass dynamic disappearance/neutralization -> quarantine candidate observation pending next valid sample;
- map `version` regression -> anomaly; do not infer rollback events;
- warId change -> explicit war transition workflow;
- conquest start null -> pre-conquest state; do not compute elapsed war day;
- conquest end/resistance timestamps appearing -> persist as source state; do not backdate events beyond source timestamp semantics.

## 14. Source DTO contract

Source DTOs MUST be tolerant of additive schema changes and preserve unknown values.

Recommended C# shape:

```csharp
public sealed record WarApiWarDto(
    string WarId,
    int WarNumber,
    string Winner,
    long? ConquestStartTime,
    long? ConquestEndTime,
    long? ResistanceStartTime,
    long? ScheduledConquestEndTime,
    int RequiredVictoryTowns,
    int ShortRequiredVictoryTowns);

public sealed record WarApiWarReportDto(
    long TotalEnlistments,
    long ColonialCasualties,
    long WardenCasualties,
    int DayOfWar);

public sealed record WarApiMapDataDto(
    int RegionId,
    int ScorchedVictoryTowns,
    IReadOnlyList<WarApiMapItemDto> MapItems,
    IReadOnlyList<WarApiMapTextItemDto> MapTextItems,
    long LastUpdated,
    long Version);

public sealed record WarApiMapItemDto(
    string TeamId,
    int IconType,
    double X,
    double Y,
    long Flags);
```

Implementation SHOULD use `JsonExtensionData` or equivalent raw-field capture so additive fields are observable without parser failure.

Do not deserialize `teamId`, `winner`, `mapMarkerType`, `iconType`, or flags into closed enums that reject unknown future values. Normalize known values separately while preserving raw source values.

## 15. Ingestion identity

`source_fetch` identity is the HTTP attempt, not the source state.

Recommended layers:

- fetch attempt: unique Chronicle UUID;
- endpoint semantic key: `source + shard + endpoint kind + mapName?`;
- raw payload identity: SHA-256;
- transport validator: ETag;
- map source revision: `version` plus `lastUpdated`, preserved but not used as sole global identity;
- normalized observation: deduplicated by semantic endpoint + war + content hash/verified source revision.

ETag MUST NOT be the database PK or sole idempotency key.

## 16. War transition algorithm

```text
fetch war state
validate warId and timestamps
current = active Chronicle war for shard

if current is null:
    create/reconcile war(shard, warId)
    initialize coverage
    fetch map list + static references
else if current.source_war_id == warId:
    reconcile mutable war-state fields
else:
    close previous collection coverage at observation boundary
    DO NOT invent missing conquestEndTime/winner
    create/reconcile new war(shard, warId)
    reset per-war endpoint state/ETags where endpoint semantics require it
    fetch new map list + static references
```

A new `warId` is the transition trigger. `warNumber` alone is not.

## 17. Objective-change algorithm

```text
validate payload envelope
reject/quarantine mass-collapse anomaly
resolve dynamic item -> canonical objective using identity algorithm
compare against previous valid observation for same objective

if same normalized state:
    no ObservedChange
else:
    emit ObservedChange(
        previous_observed_at = previous.valid_observed_at,
        current_observed_at = current.valid_observed_at,
        previous_state,
        current_state,
        source payload hashes,
        source map versions,
        detector version
    )
```

## 18. Capability matrix

| Capability | Official support | Chronicle use | Risk |
|---|---|---|---|
| war identity | yes, `warId` | runtime war transition + provenance | global cross-shard uniqueness not explicitly defined |
| war number | yes, shard-scoped | display/navigation | not a PK |
| war start/end/resistance | yes | elapsed time/archive | timestamp unit validation required |
| winner | yes | completed-war fact | NONE while unresolved |
| casualties | yes, map-specific | region/war aggregates | monotonicity/correction semantics undocumented |
| enlistments | yes, map-specific | region activity context | uniqueness/reset semantics not official |
| `dayOfWar` | yes, per map | raw diagnostic only | not defined as 24h analytical day |
| active maps | yes | region discovery | cadence/atomicity unspecified |
| static labels/locations | yes | reference/identity evidence | no stable item ID |
| dynamic public ownership/state | yes | observed objective state | no exact event timestamp |
| objective stable ID | no documented field | Chronicle-owned identity | matching ambiguity |
| exact capture timestamp | no | unavailable | polling interval only |
| global player population | no | use separate source if desired | War API cannot provide it |
| faction population | no | unavailable | do not infer from enlistments |
| exact historical event stream | no | Chronicle builds observations prospectively | cannot reconstruct retroactively |

## 19. Required tests/fixtures

Before backend collector implementation is accepted, add sanitized fixtures for:

- war pre-conquest;
- active war;
- completed/resistance war;
- normal war-report increase;
- casualty counter decrease;
- divergent `dayOfWar` across maps;
- static map with Major/Minor labels;
- dynamic ownership change;
- unknown `iconType`;
- unknown flag bit;
- reordered `mapItems`;
- mass disappearance/neutralization anomaly;
- map version regression;
- 304 response metadata;
- warId transition.

Fixtures MUST record source endpoint, retrieval date, payload SHA-256, schema fingerprint and sanitization note.

## 20. Pre-backend acceptance gate

The following are now resolved enough for implementation:

- canonical war identity: internal UUID + `(shard, warId)`;
- analytical day: Chronicle elapsed 24h day, not raw `dayOfWar`;
- map timestamps: `lastUpdated` is map-state update metadata, not event time;
- objective ID: no documented stable upstream item ID;
- event timing: polling-bounded ObservedChange;
- ETag: required optimization/conditional validator, not durable identity;
- shard keying: mandatory;
- enlistments: region-scoped and non-summable as global unique population;
- unknown enums/flags: preserve raw values;
- cross-endpoint snapshots: non-atomic observation batches.

Still intentionally unresolved and MUST remain conservative:

- official guarantee for `totalEnlistments` uniqueness/reset semantics;
- casualty monotonicity/correction guarantees;
- global uniqueness scope of `warId` across shards;
- coordinate origin/orientation as an official guarantee;
- stable cross-war objective matching tolerance;
- exact numeric HTTP cache lifetimes/rate limits beyond returned headers and documented "may update" cadence.

## 21. Licensing note

The official War API repository's `LICENSE.md` is Creative Commons Attribution-NonCommercial 4.0 International. Chronicle's public redistribution/export policy MUST be reviewed against that license and any applicable Foxhole/Siege Camp terms before raw upstream payloads or substantial source data are redistributed. This document is an engineering interpretation, not legal advice.
