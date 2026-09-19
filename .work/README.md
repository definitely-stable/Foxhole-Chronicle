# Foxhole Chronicle — .work

This directory is the working specification area for Foxhole Chronicle.

## Purpose

The `.work/` tree contains architecture/product research and implementation specifications intended for both human developers and AI coding agents.

The authoritative architecture document will be `ARCHITECTURE.md`. It MUST link to the supporting specifications rather than duplicate them.

## Planned deliverables

- `ARCHITECTURE.md`
- `PRODUCT_REQUIREMENTS.md`
- `DATA_MODEL.md`
- `INGESTION.md`
- `METRICS.md`
- `API.md`
- `FRONTEND.md`
- `DESIGN_SYSTEM.md`
- `OPERATIONS.md`
- `SECURITY.md`
- `TESTING.md`
- `IMPLEMENTATION_PLAN.md`
- `SOURCES.md`
- `OPEN_QUESTIONS.md`
- `ADR/` — architecture decision records

## Documentation rules

Specifications use RFC 2119 terminology: MUST, SHOULD, MAY.

Material claims should be classified where useful as:

- **VERIFIED FACT** — verified against a cited primary/official source.
- **DESIGN DECISION** — chosen architecture/product decision.
- **ASSUMPTION** — assumption that requires validation.
- **ESTIMATE** — sizing/capacity estimate, not an observed fact.

For Foxhole data semantics, the latest official Siege Camp/Foxhole documentation and the official `clapfoot/warapi` repository are the source of truth. Secondary/community sources MUST NOT silently override primary sources.

## Product scope

Foxhole Chronicle is a public historical and analytical World Conquest site. It is not a player-profile product and not a map-first tactical tool.

MVP:

- Overview
- War Analytics
- Daily Chronicle
- Regions
- Compare
- Records
- Archive

Phase 2:

- Event Stream
- Watch Mode

Explicitly excluded from v1:

- automatic Turning Points
- Population Lab
- accounts / Discord
- player profiles
- comments
- AI/LLM summaries
- mobile app
- winner/outcome prediction
