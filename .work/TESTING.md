# Foxhole Chronicle — Testing Strategy

Status: **Authoritative working specification**

Research baseline: **2026-09-19**

## 1. Test philosophy

Tests prove Chronicle's actual contracts.

Where correctness depends on PostgreSQL, HTTP semantics, time, caching or browser behavior, tests MUST use the relevant real implementation rather than a misleading surrogate.

## 2. .NET unit tests

Use xUnit v3.

Unit tests cover:

- pure metrics;
- interval/time semantics;
- state machines;
- parsers over in-memory fixture payloads;
- identity candidate scoring rules;
- deterministic IDs/helpers where appropriate;
- coverage calculations.

Current time is injected through TimeProvider.

Time-dependent tests use FakeTimeProvider from Microsoft.Extensions.TimeProvider.Testing.

## 3. PostgreSQL integration

Use Testcontainers.PostgreSql with the same PostgreSQL 18 major line as production.

Integration tests cover:

- migrations from empty DB;
- unique/check/foreign-key constraints;
- NodaTime mappings;
- UUIDv7 storage/order assumptions where relevant;
- SKIP LOCKED;
- row locks;
- fencing;
- concurrent claims;
- raw-capture/reconciliation transactions;
- outbox claims;
- pg_stat_statements/bootstrap extension configuration where practical;
- PostgreSQL-specific query translations used by Chronicle.

EF InMemory and SQLite MUST NOT substitute for PostgreSQL correctness tests.

## 4. Crash/recovery tests

The recovery suite covers explicit process/fault windows including:

- crash after job claim;
- crash after HTTP response before raw durability;
- crash after raw-durable commit before canonical reconciliation;
- unknown raw-capture COMMIT;
- unknown reconciliation COMMIT;
- stale job generation;
- stale endpoint fence;
- external CAS written but DB reference not committed;
- DB reference integrity after restore;
- outbox duplicate delivery.

These tests may use process/container orchestration rather than only in-process unit tests.

## 5. API contract tests

ASP.NET Core OpenAPI 3.1 is canonical.

Contract tests verify:

- documented status codes;
- ProblemDetails/errorCode shape;
- cursor pagination;
- shard-aware routes;
- ISO UTC timestamp serialization;
- enum/token stability;
- locale-neutral responses;
- ETag/Cache-Control behavior where specified;
- Replay manifest/state/change schemas;
- Replay state classes and uncertainty fields;
- no accidental breaking change in public v1 schema.

Build-time OpenAPI output feeds frontend type generation.

## 6. Frontend unit/component tests

Use:

- Vitest;
- React Testing Library;
- jsdom.

Use these for:

- pure URL parsers;
- formatting/view-model helpers;
- synchronous components;
- interactive Client Components;
- locale selector logic;
- table/chart control logic that does not require a real browser.

Do not attempt to prove async Server Component behavior solely with Vitest. Next.js documentation recommends E2E for async Server Components.

## 7. HTTP mocking

Use MSW for tests that benefit from a real fetch boundary without a live backend.

MSW is appropriate for:

- openapi-fetch client behavior;
- client-live surface handling;
- error/ProblemDetails UI;
- transient network UI states.

Mocks MUST follow generated OpenAPI shapes rather than inventing incompatible DTOs.

Full end-to-end tests still run against real Chronicle.Api.

## 8. Browser E2E

Use Playwright.

Core flows include:

- locale resolution and switching;
- Current War;
- navigation from Current War into the canonical war workspace;
- War Timeline inspection;
- Timeline at-cursor URL restoration;
- Archive / war switching;
- War Replay seek;
- Timeline -> Replay cursor synchronization;
- Replay -> Timeline cursor synchronization;
- Replay play/pause/step/speed controls;
- reload/back/forward restoration;
- shareable query state;
- uncertainty/no-coverage presentation;
- error/degraded data presentation;
- responsive layouts.

Compare/Records browser flows are P1 and MUST NOT displace P0 core-flow coverage.

Run representative smoke tests across all launch locales:

- en;
- ru;
- zh-Hans;
- fr;
- pt-BR.

## 8.1 Replay correctness suite

Replay requires dedicated deterministic fixtures.

Minimum scenarios:

1. A -> B -> A preserves all three temporal states.
2. Same payload/state bytes at the first and third observation do not collapse temporal history.
3. Selected instant exactly at previous observation returns the previous observed state.
4. Selected instant exactly at current observation returns the current observed state.
5. Selected instant strictly inside a different-state observation window returns transition_uncertain rather than an interpolated owner.
6. Missing/degraded evidence returns no_coverage when required by coverage policy.
7. Direct replay-state query matches baseline + accepted change-stream reconstruction.
8. Overlapping uncertainty windows do not gain fabricated exact ordering.
9. Identity remap/revision invalidates or versions affected replay output.
10. Conquest-start correction changes displayed elapsed Day/time but an absolute at cursor still points to the same evidence instant.

Performance test:

- playback animation MUST NOT generate one full-state API request per rendered frame.

## 9. Accessibility

Use @axe-core/playwright as an automated layer.

Automated a11y tests MUST NOT be treated as complete accessibility certification.

Manual review remains required for:

- keyboard flow;
- focus behavior;
- Timeline keyboard inspection;
- Replay keyboard controls;
- chart comprehension;
- replay uncertainty comprehension;
- non-color encoding;
- screen-reader wording;
- reduced-motion playback behavior;
- CJK/translated UI overflow.

## 10. Visual/layout regression

Targeted Playwright screenshots MAY be used for high-value stable surfaces, especially:

- five-locale header/navigation;
- Current War;
- War Timeline with inspection marker;
- War Replay confirmed/uncertain/no-coverage states;
- wide-screen archive rail;
- narrow responsive breakpoints;
- long French/Russian labels;
- Simplified Chinese typography.

Avoid broad fragile pixel snapshots as the primary correctness test.

## 11. Performance

Use k6 for API/protocol load tests.

Use browser tooling/Playwright/Lighthouse/Web Vitals for frontend performance.

These are separate concerns.

Load scenarios MUST test both warm and cold cache behavior where meaningful.

## 12. Restore/durability tests

Operational validation includes:

- PostgreSQL backup restore;
- PITR;
- CAS/raw payload referential completeness;
- archive manifest verification;
- restore onto a clean environment.

A successful PostgreSQL restore alone is insufficient if required raw payload objects are missing.

## 13. Search/table tests

When pg_trgm/search is introduced, test:

- aliases;
- typo tolerance;
- case/Unicode normalization;
- Latin/Cyrillic/CJK proper names.

When TanStack Table is introduced, test server/client responsibility boundaries rather than internal library mechanics.

## 14. No documentation CI requirement

This document defines product/code testing behavior only.

It does not introduce documentation gates or documentation-only CI policy.
