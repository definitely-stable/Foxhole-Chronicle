# Foxhole Chronicle — Platform and Dependency Baseline

Status: **Authoritative working specification**

Research baseline: **2026-09-19**

This document defines the approved application/runtime dependency baseline for Chronicle. Dependencies are adopted only when they remove meaningful correctness, interoperability, observability or maintainability risk.

Normative terms MUST, SHOULD and MAY follow RFC 2119 semantics.

## 1. Principles

Chronicle prefers:

- framework capabilities over third-party packages where the framework already solves the problem well;
- generated contracts over duplicated handwritten contracts;
- explicit PostgreSQL semantics over generic abstraction where correctness depends on locks, transactions or server behavior;
- server-first rendering and state over client-side framework duplication;
- vendor-neutral telemetry protocols;
- real PostgreSQL integration tests over surrogate databases;
- measured adoption of optional libraries.

A dependency MUST NOT be added merely because it is popular.

## 2. Web baseline

### 2.1 Adopt for v1

Runtime:

- next-intl — localization and locale routing;
- openapi-fetch — typed HTTP client over generated OpenAPI types;
- nuqs 2.x — typed URL query-state for analytical/shareable view state;
- zod 4.x — narrow runtime validation at untyped web boundaries;
- server-only — guard server-only modules from accidental Client Component import.

Build/development:

- openapi-typescript 7.x — generate TypeScript types from OpenAPI 3.1;
- TypeScript compiler with noUncheckedIndexedAccess enabled.

Testing:

- vitest;
- @testing-library/react;
- @testing-library/dom;
- jsdom;
- @playwright/test;
- @axe-core/playwright;
- msw for HTTP-client/component integration tests where mocking at the network boundary is useful.

Observability:

- @vercel/otel for Next.js server instrumentation;
- the OpenTelemetry packages required by the selected @vercel/otel configuration.

Browser OpenTelemetry instrumentation is NOT a v1 baseline. OpenTelemetry JavaScript browser instrumentation remains less mature than Node/server telemetry. Browser experience SHOULD instead start with Core Web Vitals and browser-level E2E/performance measurements.

### 2.2 Conditional

- @tanstack/react-table 9.x — adopt when Archive, Records, Regions ranking or other genuinely feature-rich tabular surfaces are implemented;
- @tanstack/react-virtual — add only after profiling demonstrates a need for row/column virtualization;
- TanStack Query — retain the existing rule: use only for client-live or mutation-oriented surfaces that cannot be expressed cleanly with RSC/server fetch + URL state;
- @next/bundle-analyzer — development-only if the selected bundler path requires it and built-in analysis is insufficient.
- Replay renderer/map library — NOT selected by default. Start with the simplest renderer that satisfies the historical non-geographic Foxhole map, objective markers, pan/zoom, uncertainty encoding and playback performance. Adopt a dedicated map/canvas library only after a prototype proves it improves maintainability/performance without pulling Chronicle toward tactical-map scope.

### 2.3 Do not add in v1 without new evidence

- Axios;
- Redux;
- Zustand/Jotai as a global default;
- openapi-react-query as a default API layer;
- AG Grid;
- request-time translation SDKs;
- large client-side date/time libraries for canonical time logic.
- Leaflet/MapLibre/PixiJS or another replay-map engine as an unproven baseline dependency.

The normal web data path is:

~~~text
ASP.NET OpenAPI 3.1
  -> build-time openapi document
  -> openapi-typescript
  -> generated TypeScript types
  -> openapi-fetch
  -> RSC/server components by default
  -> TanStack Query only where live client behavior requires it
~~~

## 3. .NET and PostgreSQL data access

### 3.1 Adopt EF Core 10 + Npgsql 10 hybrid

Approved packages:

- Npgsql.EntityFrameworkCore.PostgreSQL 10.x;
- Npgsql 10.x.

EF Core owns:

- migrations;
- ordinary entity persistence;
- ordinary LINQ queries;
- model mapping;
- normal transactional application work.

Raw Npgsql / explicit SQL owns operations where correctness or performance depends on PostgreSQL-specific semantics, including:

- SELECT ... FOR UPDATE;
- FOR UPDATE SKIP LOCKED;
- lease/fence claim SQL;
- unknown-COMMIT reconciliation helpers;
- pg_xact_status;
- COPY/bulk paths;
- carefully tuned analytical SQL;
- operations that must use a known lock order;
- SQL whose generated form must be stable and reviewed.

The project MUST NOT hide these PostgreSQL-specific operations behind a generic repository abstraction.

Dapper is NOT part of the initial baseline. It MAY be introduced later only if measured/query-complexity evidence shows a clear maintenance advantage over EF Core + Npgsql.

### 3.2 PostgreSQL extensions used by schema invariants

Approved PostgreSQL extensions:

- `pg_stat_statements` — query diagnostics;
- `btree_gist` — required by the PostgreSQL 18 temporal non-overlap constraint used for objective-state interval chronology when equality columns (UUID/text) participate alongside the range.

`btree_gist` is a PostgreSQL-supplied extension, not an external service. It MUST be created explicitly by migrations/bootstrap before the temporal constraint that depends on it.

Chronicle uses PostgreSQL 18 `UNIQUE NULLS NOT DISTINCT` for nullable semantic endpoint keys and `UNIQUE (..., range WITHOUT OVERLAPS)` for accepted objective-state chronology.

Do not replace these invariants with application-only checks.

Official references:

- https://www.postgresql.org/docs/18/indexes-unique.html
- https://www.postgresql.org/docs/18/sql-createtable.html

### 3.3 Async-only direction

Application database I/O SHOULD be asynchronous. Npgsql 10 has explicitly signaled movement away from synchronous I/O in future major versions. New Chronicle code MUST NOT depend on synchronous database APIs.

## 4. Time model

### 4.1 Adopt NodaTime

Approved packages:

- NodaTime;
- Npgsql.EntityFrameworkCore.PostgreSQL.NodaTime;
- NodaTime.Serialization.SystemTextJson.

Canonical backend type guidance:

- Instant for absolute timestamps;
- Duration for elapsed durations;
- LocalDate only for true date-without-time concepts;
- LocalDateTime only when the domain genuinely has no timezone/instant meaning;
- DateTimeZone/ZonedDateTime only for presentation or future user-timezone features.

PostgreSQL timestamptz maps naturally to Instant.

Canonical war-time calculations MUST NOT use local wall-clock time.

### 4.2 TimeProvider

System.TimeProvider is the only approved source of current wall-clock time in application services.

Application code SHOULD NOT directly call DateTime.UtcNow, DateTimeOffset.UtcNow or similar global clock APIs.

Testing uses:

- Microsoft.Extensions.TimeProvider.Testing;
- FakeTimeProvider.

NodaTime models time values; TimeProvider supplies the controllable concept of now. They solve different problems and are used together.

## 5. ID policy

No external UUID library is required.

Chronicle-generated UUID primary/operation identifiers SHOULD use UUIDv7 where ordering/locality is useful.

Preferred application-side generation:

- Guid.CreateVersion7() or Guid.CreateVersion7(timestamp);
- one project-owned ID factory where dependency injection/current-time control is useful.

PostgreSQL 18 uuidv7() MAY be used for rows genuinely generated inside the database.

Important:

- idempotency IDs are generated once and reused across reconciliation/retry of the same logical operation;
- a retry MUST NOT create a new ID merely because UUIDv7 is cheap;
- UUID timestamp ordering is an implementation/storage property, not canonical event chronology;
- source natural identities, hashes and semantic fingerprints remain separate concepts.

UUIDv7 is especially appropriate for append-heavy IDs such as fetch, attempt, observation, outbox and operation IDs.

## 6. HTTP source resilience

Approved package:

- Microsoft.Extensions.Http.Resilience.

Chronicle MUST NOT use the default standard handler unchanged for War API ingestion because the standard handler contains transparent retry behavior.

The War API client SHOULD use a custom AddResilienceHandler pipeline containing only the strategies needed by Chronicle, such as:

- concurrency/rate limiting;
- total request timeout;
- per-attempt timeout;
- circuit breaker.

Automatic hidden retry and hedging are disabled for source collection.

Chronicle provenance rule remains:

~~~text
one audited HTTP exchange
  = one source_fetch
~~~

A subsequent retry is a new ingestion attempt/fetch controlled by Chronicle's durable scheduler, not a hidden HttpClient retry.

## 7. ASP.NET Core platform features

Use built-in ASP.NET Core 10 facilities instead of third-party equivalents where possible:

- AddProblemDetails / IProblemDetailsService;
- Output Cache;
- Rate Limiting middleware;
- Request Timeouts middleware;
- Health Checks;
- Microsoft.AspNetCore.OpenApi.

Additional build/development packages:

- Microsoft.Extensions.ApiDescription.Server for build-time OpenAPI generation;
- Scalar.AspNetCore for developer/internal interactive API reference.

Scalar is not the canonical API contract. OpenAPI is canonical.

The product-facing localized API documentation route MAY later render a Chronicle-native documentation UI from the same OpenAPI contract.

## 8. OpenAPI contract pipeline

ASP.NET Core 10 produces OpenAPI 3.1 by default.

Chronicle SHOULD generate the public v1 document at build time.

The generated document is used by:

- contract tests;
- openapi-typescript;
- developer reference UI;
- future external SDK/documentation generation.

Frontend code MUST NOT duplicate API DTO interfaces by hand when the type is present in generated OpenAPI types.

Recommended TypeScript settings include:

- strict mode;
- noUncheckedIndexedAccess;
- tsc --noEmit as the authoritative type-check command.

## 9. Web runtime validation

Zod 4 SHOULD be used only at untyped runtime boundaries, for example:

- web environment variables;
- untrusted JSON not covered by Chronicle's OpenAPI contract;
- browser storage payloads if introduced;
- intentionally JSON-encoded URL state if ever introduced.

Zod MUST NOT duplicate every API response schema. Chronicle controls both ends of the API and OpenAPI already owns that contract.

@t3-oss/env-nextjs is NOT a baseline dependency. A small project-owned environment module using Zod is sufficient for the initial environment surface. Reconsider only if environment complexity grows.

Backend configuration SHOULD use ASP.NET Options validation and ValidateOnStart rather than introducing FluentValidation solely for configuration.

## 10. Data tables

TanStack Table v9 is the preferred table engine for feature-rich Chronicle tables because it is headless and allows Chronicle to own markup/design.

Use it for surfaces that need multiple capabilities such as:

- sorting;
- filtering;
- faceting;
- column visibility;
- controlled pagination;
- grouping/expansion;
- complex Records/Archive comparisons.

Simple semantic HTML tables SHOULD remain simple HTML.

Virtualization is not automatic policy. Add @tanstack/react-virtual only after real row/column counts and browser profiling justify it.

## 11. PostgreSQL extensions and diagnostics

Required production extension/configuration:

- pg_stat_statements.

Conditional:

- pg_trgm for tolerant proper-name/alias search.

PostgreSQL full-text search MAY be used for prose/document search where its language configuration is appropriate.

Chronicle SHOULD NOT introduce Elasticsearch or Meilisearch for v1.

For multilingual entity-name search, especially proper nouns and CJK names, alias tables + pg_trgm are a safer first baseline than assuming one PostgreSQL linguistic FTS configuration solves all five UI locales.

## 12. Testing dependencies

Backend:

- xunit.v3;
- Testcontainers.PostgreSql;
- Microsoft.Extensions.TimeProvider.Testing.

Frontend:

- Vitest;
- React Testing Library;
- Playwright;
- @axe-core/playwright;
- MSW where network-boundary mocking is useful.

Performance/load tooling:

- Grafana k6 as repository tooling/scripts, not an application runtime dependency.

Tests MUST use the selected PostgreSQL 18 image for database semantics that matter to production.

SQLite/EF InMemory MUST NOT be used as proof of correctness for locks, constraints, transaction isolation, SKIP LOCKED, PostgreSQL type mappings or migrations.

## 13. Observability dependencies

.NET:

- OpenTelemetry.Extensions.Hosting;
- OpenTelemetry.Exporter.OpenTelemetryProtocol;
- OpenTelemetry.Instrumentation.AspNetCore;
- OpenTelemetry.Instrumentation.Http;
- OpenTelemetry.Instrumentation.Runtime;
- Npgsql.OpenTelemetry when database tracing is enabled.

Next.js server:

- @vercel/otel;
- required OpenTelemetry JS SDK/log/instrumentation dependencies according to the pinned version.

Chronicle uses OTLP as the application-to-collector boundary.

Do NOT add Serilog by default. Microsoft.Extensions.Logging + OpenTelemetry is sufficient until a concrete logging sink/feature requires another provider.

Do NOT add EF Core tracing solely to duplicate Npgsql spans. Use EF query tags/logging for ORM-level attribution and Npgsql telemetry for actual PostgreSQL operations.

## 14. Security-related dependency decisions

Adopt:

- server-only for web server-bound modules.

Use platform/configuration rather than packages for:

- CSP;
- HSTS;
- Referrer-Policy;
- Permissions-Policy;
- X-Content-Type-Options;
- frame-ancestors;
- request limits/timeouts.

Do NOT enable experimental React tainting as a production security boundary.

Do NOT depend on Next.js experimental webpack-only SRI for the v1 CSP design.

## 15. Explicit non-baseline dependencies

Do not add without a measured/new product requirement:

- Redis;
- Kafka;
- RabbitMQ;
- Hangfire;
- Quartz;
- TimescaleDB;
- PostGIS;
- GraphQL;
- MediatR;
- AutoMapper;
- FluentValidation as a blanket default;
- Dapper as a blanket default;
- Serilog as a blanket default;
- Elasticsearch/Meilisearch;
- Redux;
- Axios.

## 16. Version policy

Architecture documents pin supported major lines, not arbitrary stale patch numbers.

At implementation/bootstrap time:

- .NET/EF Core remain on latest supported 10.0.x patches;
- Npgsql/EF provider remain on latest compatible 10.x patches;
- PostgreSQL remains on latest PostgreSQL 18 minor release;
- Next.js remains on current supported 16.x security release;
- openapi-typescript remains on 7.x unless a reviewed major migration occurs;
- nuqs remains on 2.x unless a reviewed major migration occurs;
- Zod remains on 4.x;
- TanStack Table uses 9.x when adopted.

NuGet package versions SHOULD be centrally managed with Directory.Packages.props.

JavaScript dependencies MUST be locked by the repository package-manager lockfile.
