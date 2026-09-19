# Foxhole Chronicle — Product Scope

Status: **Authoritative working specification**

## 1. Product statement

Foxhole Chronicle is a modern public historical observatory for Foxhole World Conquest.

Its product focus is not "all Foxhole analytics". It is one war-history model exposed through three core experiences:

1. **Current War** — what is happening now;
2. **War Timeline** — the central product: how the whole war evolved through time;
3. **War Replay** — move backward/forward through the observed historical map state.

FoxholeStats-style tactical live maps and general-purpose Foxhole tool hubs solve different problems.

Chronicle focuses on durable public history:

- what was observed;
- when it was observed;
- how the war changed over time;
- what state can be reconstructed at a selected historical point;
- how complete/reliable that reconstruction is;
- later, how wars/days/regions compare historically.

See [CORE_WAR_EXPERIENCE.md](./CORE_WAR_EXPERIENCE.md).

## 2. P0 — core launch product

The launch product is deliberately narrow.

### Primary surfaces

1. **Current War**
2. **War Timeline**
3. **War Replay**

### Supporting P0 surfaces

4. War selector / Archive
5. Region drill-down required by Timeline/Replay
6. Sources / Coverage

### Launch locales

- English (en)
- Russian (ru)
- Simplified Chinese (zh-Hans)
- French (fr)
- Brazilian Portuguese (pt-BR)

P0 data collection MUST preserve the objective/map observations, identity evidence, state intervals and observed changes required for Timeline and Replay.

## 3. P1 — supporting analytical depth

P1 includes:

- Daily Chronicle / Day drill-down;
- Compare;
- Records;
- Objective History;
- Shareable Insights;
- documented/stable external Public Data API / CSV guarantees.

Priority within P1 remains dependency-driven and MUST NOT delay P0 core surfaces.

A locale-neutral first-party application API exists from P0 under /api/app and may evolve lockstep with the web application. "Public Data API" in P1 means selected stable external-use resources published under /api/v1 with an explicit compatibility/deprecation commitment.

## 4. P1/P2 — analytical models

These are enrichments, not launch foundations:

- War DNA;
- Similar Wars;
- Day vs Day;
- War Phases;
- Largest Swings / State Reversals;
- Population Lab where a compatible historical dataset legitimately exists.

War Phases remain corpus-calibrated/versioned and MUST NOT be required to render Current War, Timeline or Replay.

Historical percentile/context claims MUST NOT be a P0 dependency.

## 5. Phase 2

Possible later capabilities:

- Event Stream;
- Watch Mode;
- richer bulk datasets;
- long-term cross-war objective analytics;
- advanced share cards;
- split Timeline + Replay workspace on wide screens;
- additional cross-war research views.

## 6. Explicit non-goals for v1

Chronicle v1 is not:

- a map-first tactical replacement;
- artillery/range tooling;
- route planning/logistics navigation;
- facility planning;
- private stockpile/regiment intelligence;
- player profiles/tracking;
- Discord/account coordination platform;
- comments/social network;
- mobile native app;
- AI/LLM-generated war summaries;
- winner/outcome prediction;
- hidden/private intelligence collector;
- memory/process/network inspection tool;
- gameplay automation;
- general-purpose Foxhole multi-tool;
- opaque "Turning Points" storytelling.

Replay is historical visualization, not tactical live-map functionality.

## 7. Main routes

Public UI routes are locale-prefixed.

- /{locale}/ — Current War entry / default-or-remembered shard resolution
- /{locale}/current/{shard} — canonical Current War surface
- /{locale}/wars — war selector/archive index
- /{locale}/war/{chronicleWarId} — War Timeline / canonical war workspace
- /{locale}/war/{chronicleWarId}/replay — War Replay
- /{locale}/war/{chronicleWarId}/day/{day} — Day drill-down
- /{locale}/regions
- /{locale}/regions/{region}
- /{locale}/archive
- /{locale}/compare — P1
- /{locale}/records — P1
- /{locale}/objectives/{objective} — P1 Objective History
- /{locale}/population — later/conditional
- /{locale}/data
- /{locale}/api/docs
- /{locale}/share/{shareId} — P1/later

The P0 first-party machine API remains unlocalized under /api/app/*. A future stable external API is reserved under /api/v1/*.

The canonical Current War route is shard-aware. The locale root is only a convenience entry and MUST NOT imply one globally unique current war.

The canonical historical war UI route uses Chronicle UUID, not unqualified war number.

## 8. Current War

Current War should answer:

> What is happening in the current war now?

It is a concise, visually strong present-state summary built on the same temporal history as the full war workspace.

Includes where supported:

- World Conquest number;
- shard/context;
- active/completed state;
- elapsed day/duration;
- total/faction casualties;
- recent casualty rate;
- observed objective activity;
- regional casualty activity or another explicitly registered region metric;
- a large primary Timeline surface;
- data freshness and coverage;
- direct transition into full Timeline and Replay.

It MUST reuse the same canonical war-history/Timeline semantics as the selected-war workspace rather than maintain a separate live dashboard data model.

It MUST NOT become a miniature tactical map.

It MUST NOT require a War Phase classification or "how unusual" percentile panel in P0.

## 9. War Timeline

War Timeline is the central Chronicle product.

It is the default primary surface for a selected war.

It SHOULD present one continuous temporal surface backed by one composite Timeline API request with per-series freshness/resolution/coverage metadata, with synchronized layers such as:

- casualties/casualty rate;
- observed control balance where metric semantics support it;
- observed objective changes;
- regional casualty activity or another explicitly registered region metric;
- coverage/degraded periods.

All layers share one canonical war-time axis and one inspection marker.

Timeline observed changes MUST preserve polling uncertainty. If a state change is only known between two observations, the UI MUST show that interval rather than fabricate an exact capture/change timestamp.

Recent-day summaries are quick navigation into Timeline, not separate top-level dashboard products.

Future War Phases appear only as optional analytical overlay after the model satisfies ANALYTICS.md release requirements.

## 10. War Replay

War Replay is a first-class P0 surface.

It reconstructs Chronicle's **observed historical map/objective state** at a selected time.

It MUST distinguish evidence strength:

- observed exact checkpoint;
- supported continuity between same-state samples;
- transition uncertainty;
- last-known current-edge state;
- insufficient coverage.

Replay MUST NOT interpolate a false exact owner/state inside a known transition window.

Replay shares the same selected time with Timeline.

The user can:

- seek/scrub;
- move to previous/next meaningful observation/change;
- play/pause;
- change playback speed;
- jump by day;
- focus regions;
- move directly between Timeline event and Replay context.

Replay playback MUST use baseline state + ordered changes rather than refetching a complete map state per animation frame.

Detailed semantics are defined in [CORE_WAR_EXPERIENCE.md](./CORE_WAR_EXPERIENCE.md).

## 11. War Archive / selector

Archive exists primarily to select another war and enter the same Timeline/Replay experience.

A desktop war rail MAY show:

- World Conquest number;
- active/completed state;
- small sparkline/summary;
- current selection.

The current war should be visually identifiable as LIVE/ACTIVE.

On smaller screens this becomes a drawer/dropdown.

Archive MUST NOT become a separate competing dashboard architecture.

## 12. Region drill-down

Regions support the three core experiences.

A region page SHOULD answer:

- current/selected observed state;
- region casualties/activity over time;
- observed objective changes;
- coverage;
- links back into War Timeline/Replay at the relevant time.

Region pages MUST NOT introduce a separate tactical-map product.

## 13. Sources / Coverage

Data honesty is product functionality, not an implementation detail.

Every relevant Current War/Timeline/Replay surface must be able to answer:

- Source?
- As of when?
- Resolution?
- Coverage?
- Is this state confirmed, uncertain, or unavailable?
- Derived how?
- Which relevant metric/model/identity/time revision?

Coverage detail may be progressive disclosure, but uncertainty MUST NOT be hidden when it changes the meaning of the visualization.

## 14. Navigation

Launch primary navigation SHOULD emphasize:

- Current War
- Wars
- Regions
- Archive

Compare and Records may join primary navigation after their P1 surfaces are mature.

Inside a selected war, the primary local navigation is:

- Timeline
- Replay
- Days
- Sources

Additional analytical model pages remain secondary.

## 15. Design direction

High-level concept: **Strategic Data Observatory**.

Accepted direction from the current product reference:

- compact top navigation;
- restrained cinematic Foxhole identity/background;
- prominent World Conquest status strip;
- large central War Timeline;
- optional left war/archive selector on wide screens;
- vertical inspection marker;
- recent-day temporal navigation;
- dark graphite premium analytical aesthetic;
- faction colors used semantically;
- high density without command-center noise.

Required refinements:

- working pages use a shorter hero so Timeline appears early;
- Overview naming becomes Current War;
- War Timeline dominates the page;
- Replay becomes first-class;
- P0 does not depend on phase bands;
- P0 does not depend on historical percentile/"unusualness" panels;
- Compare/Records are not P0-primary;
- objective-derived control uses evidence-accurate naming;
- uncertainty is visible rather than smoothed away.

General principles:

- contemporary analytical product, not military cosplay;
- large continuous data surfaces over excessive cards;
- strong typographic hierarchy and tabular numerals;
- one dominant analytical idea per screen/section;
- no decorative 3D charts/gauges;
- motion only for state continuity/replay;
- accessible color-independent encoding;
- responsive re-composition rather than desktop shrink;
- localization-safe layouts and correct CJK glyph coverage.

## 16. Product model summary

The intended mental model is:

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

Current War is the current end of history.

Timeline is the canonical temporal representation of the whole war.

Replay is the spatial representation of a selected historical point.

## 17. Acceptance criteria

P0 is product-complete only when:

1. Current War provides a compelling current-war overview without a tactical live map.
2. War Timeline is the dominant selected-war experience.
3. Timeline restores/share its selected time.
4. Replay reconstructs observed historical state at a selected time.
5. Timeline and Replay share one temporal cursor.
6. Replay visibly distinguishes uncertainty/no coverage.
7. A -> B -> A temporal history survives deduplication and is replayable.
8. Timeline events do not invent exact transition times.
9. Current and historical wars use the same core war-history model.
10. Archive/Regions/Sources support the core instead of becoming separate product centers.
11. P0 remains useful without Compare, Records, War DNA, Similar Wars, War Phases or historical-percentile context.
