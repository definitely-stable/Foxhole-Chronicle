# AGENTS.md

Short normative contract for agents working in this repository.

## Authority

Before changing anything, read:

1. `.work/ARCHITECTURE.md`
2. the domain spec for the subsystem you touch
3. applicable accepted ADRs

Research/review files are supporting evidence only.

`.work/WAR_API_SEMANTICS.md` is authoritative for official source semantics. Do not strengthen upstream guarantees.

If implementation and `.work` conflict, reconcile the specification instead of silently choosing one.

## Scope

Change only what the task requires.

Do not refactor neighboring areas, rename unrelated concepts, alter external semantics, or add infrastructure "while here" unless required for correctness.

Architectural changes MUST update the relevant `.work` spec in the same PR.

## Constraints

Without a measured requirement and ADR, do not add:

- Redis, Kafka, RabbitMQ, Kubernetes, TimescaleDB, GraphQL, vector databases;
- Dapper, MediatR, AutoMapper, Serilog as default framework layers;
- Redux/Zustand/Jotai as global state;
- Replay-specific source-of-truth storage;
- an unapproved map-renderer dependency.

War API ingestion MUST NOT hide HTTP retries or hedging. One ingestion attempt performs at most one audited HTTP exchange.

Current War, War Timeline and War Replay share one canonical war-history model.

## Required domain reading

- ingestion/recovery: `INGESTION.md`, `IDEMPOTENCY_RECOVERY.md`
- schema/storage: `DATA_MODEL.md`, `DATA_LIFECYCLE.md`
- source/time/objectives: `WAR_API_SEMANTICS.md`, `TIME_SEMANTICS.md`, `OBJECTIVE_IDENTITY.md`
- metrics/models: `METRICS.md`, `ANALYTICS.md`
- API/web: `PUBLIC_API.md`, `WEB_RUNTIME.md`
- Replay/map: `CORE_WAR_EXPERIENCE.md`, `MAP_PRESENTATION.md`
- localization/security/testing/telemetry: corresponding `.work` spec

## Build and test

Current `main` is specification-only.

- Build: not available yet.
- Test: not available yet.
- Documentation validation: `git diff --check`

Do not invent commands. The first implementation-bootstrap PR MUST replace the unavailable entries with exact repository-root build/test commands.

## Branches and PRs

- Never commit directly to `main`.
- Use a focused `feature/*`, `fix/*`, `architecture/*`, or `docs/*` branch.
- Keep one coherent concern per PR.
- Include required tests and affected specs in the same PR.
- Do not mix unrelated cleanup into the change.
- State contract/architecture changes and deferred follow-up in the PR description.
