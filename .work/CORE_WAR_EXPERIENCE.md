# Foxhole Chronicle — Core War Experience

Status: **Authoritative working specification**

Product baseline: **2026-09-19**

This document defines the primary user experience of Foxhole Chronicle.

Chronicle is not a collection of equally weighted analytics pages. The product is organized around one temporal model of a World Conquest exposed through three primary experiences:

1. **Current War** — a beautiful, concise view of the current war now;
2. **War Timeline** — the central product surface: the whole war through time;
3. **War Replay** — a spatial projection of the selected historical time onto the map.

All supporting features exist to deepen one of these three experiences.

## 1. Product hierarchy

The product hierarchy is:

~~~text
                     WAR HISTORY MODEL
                            |
                            v
                       WAR TIMELINE
                    central product
                            |
              +-------------+-------------+
              |                           |
              v                           v
         CURRENT WAR                  WAR REPLAY
           now                         selected time
~~~

The three surfaces share the same canonical source history, war-relative time semantics, coverage model and objective identity.

They MUST NOT evolve into three independent data architectures.

### 1.1 Current War

Current War answers:

> What is happening in the current World Conquest now?

It is a concise, visually strong summary, not a tactical live-map replacement.

Conceptually:

~~~text
Current War = current-war summary + War Timeline inspected at the current end of known history
~~~

### 1.2 War Timeline

War Timeline answers:

> How has this war evolved from the beginning to the selected point or end?

War Timeline is Chronicle's central product surface.

The canonical war workspace MUST make Timeline immediately available rather than hiding it behind a secondary analytics tab.

### 1.3 War Replay

War Replay answers:

> What public map/objective state had Chronicle observed around this selected point in the war?

Replay is historical reconstruction from public observations.

It is NOT:

- a tactical live map;
- a simulated exact recording of the game world;
- a claim that ownership/state transitions occurred at exact timestamps between polls.

## 2. Scope priority

### P0 — core product

P0 user-facing scope is:

1. Current War;
2. War Timeline;
3. War Replay;
4. War Archive / war selector;
5. Region drill-down needed by Timeline/Replay;
6. Sources / Coverage explanations.

Five launch locales remain required:

- en;
- ru;
- zh-Hans;
- fr;
- pt-BR.

### P1 — supporting analytical depth

P1 includes:

- Daily Chronicle / day drill-down;
- Compare;
- Records;
- Objective History;
- Shareable Insights;
- external-use Public Data API / CSV guarantees.

### P1/P2 — model-dependent enrichment

These MUST NOT block the three core experiences:

- War DNA;
- Similar Wars;
- War Phases;
- Swing Analysis / State Reversals;
- broader cross-war analytical modules.

War Phases remain corpus-calibrated and MUST NOT appear as an authoritative P0 timeline segmentation.

## 3. Navigation model

Primary launch navigation SHOULD emphasize:

~~~text
Current War
Wars
Regions
Archive
~~~

Compare and Records MAY appear when their P1 implementations are mature, but MUST NOT drive initial information architecture.

Inside a war workspace:

~~~text
Timeline
Replay
Days
Sources
~~~

Other analytical views may be added later as secondary surfaces.

Overview is not the preferred user-facing name for the main current-war product. Use **Current War**.

## 4. Canonical routes

Localized UI routes remain locale-prefixed.

Recommended core routes:

~~~text
/{locale}/
    Current War entry / default-or-remembered shard resolution

/{locale}/current/{shard}
    Canonical Current War surface for one shard

/{locale}/wars
    War selector / archive index

/{locale}/war/{chronicleWarId}
    War Timeline / canonical war workspace

/{locale}/war/{chronicleWarId}/replay
    War Replay

/{locale}/war/{chronicleWarId}/day/{day}
    Day drill-down

/{locale}/regions
/{locale}/regions/{region}
    Region drill-down

/{locale}/archive
    Historical archive/search
~~~

The bare locale home is a convenience entry, not proof that there is one globally unique current war. It SHOULD resolve a supported default/remembered shard or present shard choice without GeoIP inference.

The canonical Current War URL includes shard identity.

A current-war link SHOULD resolve to the canonical Chronicle war UUID when navigating into the war workspace.

War number remains shard-scoped and MUST NOT become the canonical route identity.

## 5. Shared temporal cursor

Timeline and Replay share one temporal inspection concept.

The canonical cursor represents an absolute Chronicle observation instant.

The shareable URL SHOULD use:

~~~text
?at=<UTC ISO-8601 instant>
~~~

Example:

~~~text
/en/war/6dc.../replay?at=2026-09-17T18:30:00Z
~~~

The UI derives:

- elapsed war duration;
- elapsed war day;
- displayed Day N + time;
- nearby observations/changes.

Why absolute at is canonical:

- source corrections can change conquest_start_at;
- elapsed-day display may therefore shift after a legitimate war-time revision;
- an absolute instant keeps an old shared link pointed at the same evidence time.

The UI MAY also expose day/range controls, but these derive the canonical at.

For Current War, the cursor is conceptually pinned to the latest accepted current state and does not require an at query in the normal home URL.

## 6. Current War experience

Current War is the landing product for an active shard/war.

It SHOULD contain:

- World Conquest number;
- shard where relevant;
- active/completed state;
- elapsed Day N and duration;
- last accepted data/freshness state;
- total/faction casualties where supported;
- recent casualty rate;
- observed objective activity;
- observed regional activity;
- compact/main Timeline view;
- direct entry into full Timeline and Replay.

It MUST NOT attempt to show every map object or replace a tactical map.

### 6.1 Current War visual structure

The reference direction is:

~~~text
compact cinematic Chronicle identity

WORLD CONQUEST 129 · ACTIVE · DAY 23 · Updated ...

WAR TIMELINE
[large continuous temporal surface]

RECENT DAYS
[quick temporal navigation]

optional secondary context
~~~

The cinematic hero is product identity, not the main analytical surface.

On working Current War / War pages it SHOULD be compact enough that the Timeline is visible early in the viewport.

### 6.2 P0 exclusions

Current War P0 MUST NOT depend on:

- calibrated War Phases;
- historical percentile comparisons;
- "how unusual" claims;
- Similar Wars;
- winner/outcome prediction.

Historical comparison context may be added later when cohort/coverage requirements are satisfied.

## 7. War Timeline experience

War Timeline is the primary representation of one war.

It SHOULD be one large, continuous temporal surface rather than a grid of disconnected cards.

Baseline layers MAY include:

1. casualties / casualty rate;
2. observed control balance or another defensible state aggregate;
3. observed objective changes;
4. regional activity;
5. source coverage / degraded periods.

All layers share one x-axis: canonical war time.

### 7.1 Inspection marker

A vertical inspection marker MUST synchronize all timeline layers.

Example:

~~~text
DAY 17 · 18:30
        |
        |
        v
~~~

Hover/click/touch inspection displays values for the same temporal position across layers.

The marker is also the bridge to Replay.

### 7.2 Timeline events

Observed changes are not exact event timestamps unless the source proves an exact time.

If state differs between observations:

~~~text
previous observed at 14:00
current observed at 14:15
~~~

the change is known only in:

~~~text
(14:00, 14:15]
~~~

Timeline visualization MUST preserve that interval uncertainty.

It MUST NOT place the event at:

- the midpoint;
- 14:15 as if it were exact;
- any fabricated "capture time".

UI examples may use:

- an uncertainty band/window;
- a marker whose tooltip explicitly states the observation interval;
- a distinct boundary-ambiguous state.

### 7.3 Observed control terminology

Avoid presenting objective-derived state as literal physical territorial percentage unless the metric genuinely supports that meaning.

Preferred labels include:

- Observed Control;
- Observed Objective Control;
- Control Balance.

The metric definition MUST specify the eligible objective set and weighting.

### 7.4 Recent days

Recent-day cards/strips are temporal navigation into Timeline, not independent dashboard products.

Selecting Day N SHOULD:

- move/zoom the Timeline;
- update the inspection range/cursor;
- preserve shareable URL state.

### 7.5 Phase overlay

War Phases, when eventually calibrated, are an optional analytical overlay on Timeline.

P0 Timeline MUST function fully without phase labels.

The labels:

- opening;
- contested;
- high_mobility;
- late_war;

MUST NOT appear as authoritative segmentation until the model is released under the requirements in ANALYTICS.md.

## 8. War Replay semantics

Replay reconstructs an **observed historical state**, not omniscient truth.

The model distinguishes at least:

1. confirmed_observed — the accepted state is supported for the selected point under Chronicle coverage semantics;
2. transition_uncertain — adjacent observations establish that a change occurred in an interval containing the selected point, but not exactly when;
3. no_coverage — Chronicle does not have sufficient valid evidence for the selected point.

Replay MUST display these states in a color-independent way.

### 8.1 Example

Suppose:

~~~text
18:00 — objective observed WARDENS
18:15 — objective observed COLONIALS
~~~

At an intermediate selected instant such as 18:07, Chronicle MUST NOT assert an exact owner solely by interpolation.

Replay SHOULD present the transition as uncertain within the observed change window.

### 8.2 Same-state validation

Chronicle may treat repeated valid same-state observations/304 validation according to the existing coverage rules.

Replay semantics MUST remain consistent with DATA_MODEL.md and coverage calculations; it MUST NOT invent a stronger continuous-truth guarantee.

### 8.3 A -> B -> A

Replay depends on preserving temporal occurrences.

The sequence:

~~~text
A -> B -> A
~~~

MUST remain three temporal states/observations even if the first and third payload/state representations are byte/semantic duplicates.

Payload deduplication MUST NOT erase temporal history.

## 9. War Replay UI

Replay is a historical map surface synchronized with the Timeline cursor.

Primary controls:

- seek/scrub;
- previous/next meaningful observation/change;
- play/pause;
- bounded playback speeds such as 1x/4x/16x;
- Day N jump;
- region focus;
- direct Timeline <-> Replay transition.

Replay legend MUST distinguish:

- confirmed observed state;
- transition uncertainty;
- insufficient coverage.

The map is contextual and historical. It MUST NOT grow into:

- route planning;
- private markers;
- artillery calculations;
- facility planning;
- live regiment coordination.

## 10. Replay API shape

The public/first-party API SHOULD expose three replay-oriented resources.

### 10.1 Manifest

~~~http
GET /api/v1/wars/{chronicleWarId}/replay/manifest
~~~

Purpose: load stable or slowly changing replay metadata.

It SHOULD include:

- war identity;
- conquest start/end;
- replay time bounds;
- regions;
- objective identities required for the replay;
- objective/static positions needed by the current identity/map revision;
- source/map/identity revision metadata;
- available coverage/resolution summary;
- relevant archive/data revision.

Manifest responses for sealed wars may be cached aggressively.

### 10.2 State at selected time

~~~http
GET /api/v1/wars/{chronicleWarId}/replay/state?at={utcInstant}
~~~

It SHOULD return each included objective/region state with:

- canonical ID;
- position;
- observed owner/state;
- replayStateClass;
- previous supporting observation;
- next bounding observation where relevant;
- coverage/quality;
- identity resolution version;
- data/revision metadata.

replayStateClass baseline values:

~~~text
confirmed_observed
transition_uncertain
no_coverage
~~~

The response MUST NOT fabricate exact transition timestamps.

### 10.3 Change range

~~~http
GET /api/v1/wars/{chronicleWarId}/replay/changes
    ?from={utcInstant}
    &to={utcInstant}
    &after={cursor}
    &limit={n}
~~~

Returns ordered observed-change records with their uncertainty intervals.

This endpoint supports local playback after a baseline seek.

## 11. Replay client algorithm

The browser MUST NOT request a full state snapshot on every animation frame.

Preferred flow:

~~~text
seek
  -> fetch manifest if not cached
  -> fetch state at selected time
  -> fetch nearby/range changes

play
  -> advance local cursor
  -> apply ordered deltas locally
  -> fetch additional change windows when needed
~~~

Thus:

~~~text
60 FPS UI != 60 API requests/second
~~~

A fresh direct seek may request a new baseline state.

The client MUST be able to reconstruct the same state from:

~~~text
baseline state + ordered accepted change stream
~~~

as a direct state query for the same supported point, modulo explicitly documented coverage/uncertainty semantics.

## 12. Timeline / Replay synchronization

Timeline and Replay MUST use the same selected at instant.

Timeline -> Replay:

- clicking/inspecting a point;
- selecting an observed change;
- choosing a day;

sets the shared cursor.

Replay -> Timeline:

- scrubbing;
- stepping to next change;
- playback;

moves the Timeline inspection marker when Timeline is visible or when the user returns to Timeline.

A future split view MAY show both surfaces together on wide screens.

Split view is a presentation mode, not a separate data contract.

## 13. Archive / war selector

A desktop archive rail/selector may appear beside the Timeline, but it is navigation, not a competing analytical module.

Recommended information:

- WC number;
- active/completed indicator;
- compact sparkline/summary where cheap;
- selected state.

The current war SHOULD be identifiable as LIVE/ACTIVE.

On narrower layouts the rail becomes a drawer/dropdown.

## 14. Reference-inspired visual hierarchy

The accepted visual direction from the current concept is:

- compact top navigation;
- restrained cinematic Foxhole identity/background;
- prominent World Conquest status strip;
- large central War Timeline;
- left war/archive selector on wide screens;
- vertical inspection marker;
- recent-day quick navigation;
- dark graphite analytical aesthetic;
- faction colors used semantically;
- high information density without "command-center" noise.

Changes from the current reference:

- hero is shorter on working data pages;
- Overview becomes Current War;
- phase bands are absent from P0 or clearly experimental/optional later;
- historical percentile/unusualness panel is not P0;
- Compare/Records are not launch-primary navigation;
- Replay is added as a first-class mode/surface;
- timeline event uncertainty is explicitly visualized;
- "territorial state" wording is replaced by evidence-accurate observed-control terminology where appropriate.

## 15. Data pipeline alignment

The core experience is intentionally supported by the existing ingestion model:

~~~text
War API
  -> fetch
  -> raw durable evidence
  -> normalized observations
  -> objective identity
  -> objective observations
  -> objective state intervals
  -> observed changes
  -> time buckets/aggregates
  -> Current War / Timeline / Replay
~~~

Current War, Timeline and Replay MUST read the same canonical history.

No separate replay-only scrape/database is introduced.

## 16. Caching alignment

Current War:

- short bounded caching;
- always displays underlying dataAsOf/freshness.

Timeline:

- current war: short/medium bounded cache by query/range/resolution;
- sealed war: long cache keyed/invalidation-aware by data/time/metric revisions.

Replay manifest:

- long cache for sealed wars;
- revision-aware cache for active wars.

Replay state/change range:

- query/revision-aware;
- sealed wars may be cached aggressively;
- active wars use bounded caching appropriate to source collection cadence.

## 17. Accessibility

Timeline and Replay MUST not encode faction/state/uncertainty by color alone.

Provide:

- textual tooltip/state;
- patterns/shapes/markers;
- keyboard-operable temporal navigation;
- accessible current time/cursor label;
- replay controls with accessible names;
- reduced-motion-safe behavior;
- non-animated alternative for playback-sensitive users.

## 18. Acceptance criteria

The core product is not considered implemented until:

1. Current War works without rendering a tactical live map.
2. War Timeline is the default central surface for a selected war.
3. Timeline uses one canonical temporal axis and a synchronized inspection marker.
4. Current War and historical wars use the same underlying war-history model.
5. Replay can seek to a historical point and reconstruct observed state.
6. Replay distinguishes confirmed observed, uncertain transition and no-coverage states.
7. Replay never assigns fabricated exact capture/transition timestamps.
8. A -> B -> A history remains visible in Replay.
9. Timeline observed-change markers expose observation uncertainty.
10. Timeline and Replay share the same URL-restorable at cursor.
11. Replay playback applies local change deltas rather than polling a full state per frame.
12. Direct replay state and baseline+changes reconstruction agree under the documented semantics.
13. P0 works without War Phases, percentile context, DNA, Similar Wars, Compare or Records.
14. Source/freshness/coverage remain visible enough to explain what the user is seeing.
15. The product remains a historical observatory, not a tactical map replacement.
