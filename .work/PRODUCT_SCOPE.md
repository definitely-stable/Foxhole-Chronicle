# Foxhole Chronicle — Product Scope

Status: **Authoritative working specification**

## 1. Product statement

Foxhole Chronicle is a modern public analytics and historical archive for Foxhole World Conquest.

FoxholeStats-style live maps already solve a different problem. Chronicle focuses on:

- what happened;
- how a war evolved;
- how unusual it was;
- how one day/region/objective compares historically;
- which public observable patterns characterize the war;
- making those analyses durable and shareable.

## 2. MVP / P0

Core launch scope:

- Overview
- War Analytics
- Daily Chronicle
- Regions
- Compare
- Records
- Archive
- War Phases (P0)

P0 data collection MUST also preserve objective observations needed for later Objective History/Swings even if those UIs are not launch-blocking.

## 3. P1 analytical features

- Similar Wars
- War DNA
- Day vs Day
- Objective History
- Largest Swings / State Reversals
- Shareable Insights
- Public Data API / CSV

Priority within P1 is dependency-driven:

1. Objective identity + history foundation
2. Day vs Day
3. War DNA
4. Similar Wars
5. War Phases refinement
6. Swing Analysis
7. Shareable Insights
8. Public bulk exports

Public JSON API basics exist from the beginning for the first-party frontend; "Public Data API" refers to documented/stable external-use guarantees.

## 4. Historical modules

- Archive
- Compare
- Records
- Population Lab, where compatible historical population/play-hour data is legitimately available.

Population Lab MUST remain separate from official region enlistment semantics.

## 5. Phase 2

- Event Stream
- Watch Mode
- richer bulk datasets
- long-term cross-war objective analytics
- advanced share cards

## 6. Explicit non-goals for v1

- player profiles/tracking;
- Discord/account system;
- comments/social network;
- mobile native app;
- AI/LLM-generated war summaries;
- winner/outcome prediction;
- hidden/private intelligence;
- memory/process/network inspection of the game;
- gameplay automation;
- map-first tactical replacement;
- opaque "Turning Points" claims.

Deterministic War Phases and descriptive Swing Analysis are allowed because their formulas, evidence and coverage are explicit.

## 7. Main routes

- `/` — Overview
- `/war/{war}`
- `/war/{war}/day/{day}`
- `/war/{war}/dna`
- `/war/{war}/phases`
- `/war/{war}/swings`
- `/war/{war}/similar`
- `/regions`
- `/regions/{region}`
- `/compare`
- `/objectives/{objective}`
- `/records`
- `/archive`
- `/population` — historical Population Lab when source policy/data permits
- `/data`
- `/api/docs`
- `/share/{shareId}`

## 8. Overview

Overview should answer "what is happening in the current war, and how unusual is it?"

Includes:

- war number/day/duration;
- total and faction casualties;
- 24h casualties and rate;
- recent regional activity;
- current phase classification with explanation/status;
- main casualty timeline;
- selected historical context;
- freshness/source state.

It MUST not become a miniature map.

## 9. Daily Chronicle

Deterministic daily summary by elapsed war day.

Includes:

- day casualty total/rate;
- faction split;
- busiest covered regions;
- observed objective changes;
- most contested/changed objective only if metric definition supports it;
- phase for that interval;
- source/coverage.

Narrative text SHOULD be template/deterministic, not LLM-generated.

## 10. War page

War page is the analytical workspace for one war.

Sections/tabs may include:

- Overview
- Timeline
- Days
- Regions
- DNA
- Phases
- Swings
- Similar
- Objectives
- Records
- Sources/Coverage

## 11. Design direction

High-level concept: **Strategic Data Observatory**.

Principles:

- contemporary analytical product, not military cosplay;
- dark/graphite neutral base with faction colors used semantically;
- large continuous data surfaces over excessive cards;
- strong typographic hierarchy and tabular numerals;
- one dominant analytical idea per screen/section;
- line/area, diverging bars, small multiples, heatmaps, distributions and percentile bands;
- no decorative 3D charts/gauges;
- motion only for state continuity;
- accessible color-independent encoding;
- responsive re-composition rather than desktop shrink.

Concrete visual references are intentionally out of scope for this phase.

## 12. Data honesty

Every analytical surface must answer:

- Source?
- As of when?
- Resolution?
- Coverage?
- Derived how?
- Which metric/model version?

If the answer is incomplete, the UI MUST show it rather than hide it.
