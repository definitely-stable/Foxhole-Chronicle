# AGENTS.md

This file is the short normative contract for agents working in this repository.

## Authority

Before changing code or architecture, read:

1. `.work/ARCHITECTURE.md`
2. the domain specification(s) for the subsystem being changed
3. accepted ADRs that apply
4. research/review files only as supporting evidence

`.work/WAR_API_SEMANTICS.md` is authoritative for official source semantics. Do not strengthen upstream guarantees.

If implementation and `.work` disagree, stop and reconcile the specification; do not silently choose one.

## Scope

Change only what the task requires.

Do not refactor neighboring modules, rename unrelated concepts, change public semantics, or introduce infrastructure "while here" unless required for correctness.

Architectural changes MUST update the relevant `.work` specification in the same PR.

## Architecture constraints

Do not introduce without a measured requirement and ADR:

- Redis, Kafka, RabbitMQ, Kubernetes, TimescaleDB, GraphQL, vector databases;
- Dapper, MediatR, AutoMapper, Serilog as default framework layers;
- Redux/Zustand/Jotai as global state;
- a Replay-specific source-of-truth database;
- an unapproved map renderer dependency.

War API ingestion MUST NOT use hidden HTTP retries or hedging. One ingestion attempt performs at most one audited HTTP exchange.

Current War, War Timeline and War Replay MUST use the same canonical war-history model.

## Domain specs

Read the relevant spec before touching that area:

- ingestion/recovery: `INGESTION.md`, `IDEMPOTENCY_RECOVERY.md`
- schema/storage: `DATA_MODEL.md`, `DATA_LIFECYCLE.md`
- source semantics: `WAR_API_SEMANTICS.md`
- time: `TIME_SEMANTICS.md`
- objectives: `OBJECTIVE_IDENTITY.md`
- metrics/models: `METRICS.md`, `ANALYTICS.md`
- API/web: `PUBLIC_API.md`, `WEB_RUNTIME.md`
- Replay/map: `CORE_WAR_EXPERIENCE.md`, `MAP_PRESENTATION.md`
- localization: `LOCALIZATION.md`
- security/testing/telemetry: corresponding `.work` spec

## Build and test

Current `main` is specification-only; no executable solution/package workspace exists yet.

For documentation changes run:

~~~bash
git diff --check
~~~

Do not invent build/test commands.

The first implementation-bootstrap PR MUST update this section with the exact repository-root build/test commands before implementation work continues.

## Branches and PRs

- Do not commit directly to `main`.
- Use a focused branch such as `feature/*`, `fix/*`, `architecture/*`, or `docs/*`.
- Keep one coherent concern per PR.
- Include required tests and affected specifications in the same PR.
- Do not mix unrelated cleanup with the requested change.
- PR descriptions must state architectural/contract changes and any deferred follow-up.
