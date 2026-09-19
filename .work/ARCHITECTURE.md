# Foxhole Chronicle — Architecture

Status: **Authoritative working specification**

This is the top-level architecture document for Foxhole Chronicle. Supporting details live in the documents linked below. If two `.work` documents conflict, this file defines the intended system boundary and the more specific document defines implementation detail unless an ADR explicitly supersedes it.

Normative terms **MUST**, **SHOULD**, and **MAY** follow RFC 2119 semantics.

## 1. Product

Foxhole Chronicle is a public historical and analytical World Conquest platform.

It is:

- a long-lived public archive;
- a time-series analytics product;
- a comparative research tool;
- a source-transparent data product.

It is not:

- a map-first tactical replacement for FoxholeStats;
- a player tracking/profile system;
- a hidden-intelligence collector;
- a winner/outcome prediction system;
- an AI narrative engine.

See [PRODUCT_SCOPE.md](./PRODUCT_SCOPE.md).

## 2. Architecture style

Chronicle uses a **modular monolith with a separate ingestion worker**.

Public topology:

```text
Internet
   |
 Caddy
 TLS / routing / compression / limits
   |
   +--------------------------+
   |                          |
Next.js                  ASP.NET Core API
SSR/RSC/UI               authoritative REST
   |                          |
   +------------+-------------+
                |
           PostgreSQL
                ^
                |
        Ingestion Worker --------> Raw Payload Store
                |                  inline + Zstd CAS
                |                         |
        allowed data sources              v
                                  verified offsite archive
```

The API and Worker share application/domain/data contracts, but run as separate processes so source failures and long-running collection jobs do not block web requests.

v1 MUST NOT introduce Redis, Kafka, RabbitMQ, Kubernetes, TimescaleDB, GraphQL or a vector database without a measured requirement and an ADR.

## 3. Technology baseline

Verified platform baseline for the September 2026 bootstrap:

- Next.js 16.x
- React 19.x
- TypeScript
- next-intl for UI localization / locale routing
- openapi-typescript + openapi-fetch for generated frontend API contracts
- nuqs 2.x for shareable analytical URL state
- Zod 4 for narrow untyped web runtime boundaries
- supported Node.js LTS
- Tailwind CSS 4.x
- Radix UI primitives
- TanStack Query only for truly client-live/interactively refreshed surfaces
- TanStack Table 9.x only when feature-rich data tables are implemented
- Apache ECharts 6.1+
- ASP.NET Core / .NET 10 LTS
- C# 14
- EF Core 10 + Npgsql 10 hybrid data access
- NodaTime for canonical backend time types
- PostgreSQL 18.x with pg_stat_statements
- pgBackRest for physical backup/WAL-PITR management
- Zstandard for external raw/archive compression
- Apache Parquet for sealed analytical exports only
- Caddy
- Docker Compose
- OpenTelemetry / OTLP

Supported major lines and dependency decisions are defined in [PLATFORM_DEPENDENCIES.md](./PLATFORM_DEPENDENCIES.md). Patch versions are selected at implementation/bootstrap time from the latest compatible supported patch. Backup/archive tooling versions MUST also be compatibility-tested against the selected PostgreSQL/runtime image.

## 4. Repository structure

Recommended implementation layout:

```text
apps/
  web/

src/
  Chronicle.Api/
  Chronicle.Worker/
  Chronicle.Core/
    Wars/
    Regions/
    Objectives/
    Analytics/
    Records/
    Archive/
    DataExports/
  Chronicle.Infrastructure/

tests/
  Chronicle.UnitTests/
  Chronicle.IntegrationTests/
  Chronicle.ContractTests/

infra/
  docker/
  caddy/
  postgres/

.work/
  authoritative design documents
```

The backend SHOULD use vertical slices/modules rather than ceremonial Clean Architecture layers.

Avoid repository/UoW/mediator abstractions that add no domain value.

## 5. Authoritative boundaries

### Next.js

Owns:

- routing and presentation;
- locale-prefixed routing, locale negotiation and localized presentation;
- SSR/RSC;
- SEO, hreflang and OpenGraph;
- chart composition;
- responsive UX;
- static/historical rendering strategy;
- share-card rendering.

Does not own:

- business metric formulas;
- canonical source reconciliation;
- ingestion;
- authoritative persistence semantics.

### ASP.NET Core API

Owns:

- locale-neutral public REST contract;
- analytical query application services;
- source/coverage/freshness metadata;
- output caching;
- validation/error semantics;
- OpenAPI.

### Worker

Owns:

- scheduling;
- HTTP fetches;
- historical imports;
- exact raw-payload placement/dedup;
- normalization;
- reconciliation;
- transactional outbox processing;
- durable job/attempt leases;
- endpoint scheduling state and endpoint-level fencing;
- unknown-COMMIT reconciliation;
- observed-change detection;
- aggregates;
- analytical model recomputation;
- raw offsite replication/verification;
- war sealing and archive-export generation.

### PostgreSQL

Owns:

- canonical facts;
- source provenance/fetch metadata;
- small inline raw payloads;
- current and historical state;
- aggregates;
- metric/model results;
- archive/share/export manifests;
- outbox/job/lease state.

### Raw payload store

Owns:

- large exact replay payloads under content-addressed identity;
- local durable CAS/cache;
- independently verified offsite replicas.

PostgreSQL metadata and the raw payload store are jointly required for complete historical recovery.

## 6. Data semantics

The canonical chain is:

`source -> fetch -> raw durable evidence -> observation -> normalized fact -> observed change -> derived metric -> analytical model/result -> share/export`

This separation is mandatory.

Key rules:

1. Polling bounds a change to an observation interval; it does not prove exact in-game event time.
2. War-relative elapsed time is distinct from UTC calendar date and from any upstream game-day field; canonical bucket boundaries follow TIME_SEMANTICS.md.
3. Objective identity is Chronicle-owned unless a stable upstream identifier is explicitly verified.
4. Every derived metric/model is deterministic, reproducible and versioned.
5. Coverage and provenance are first-class data.
6. Historical sources may have lower resolution and MUST be labeled accordingly.
7. Collection resolution is distinct from UI/aggregation resolution; `chronicle-collection-v1` collects war at 5m and warReport/dynamic map state at 15m.

Official source semantics are fixed in [WAR_API_SEMANTICS.md](./WAR_API_SEMANTICS.md). Canonical war-relative clock/bucket semantics are fixed in [TIME_SEMANTICS.md](./TIME_SEMANTICS.md). UI localization, locale routing and language-selection semantics are fixed in [LOCALIZATION.md](./LOCALIZATION.md). Domain/storage rules are in [DATA_MODEL.md](./DATA_MODEL.md), [OBJECTIVE_IDENTITY.md](./OBJECTIVE_IDENTITY.md), and [METRICS.md](./METRICS.md).

## 7. Current and historical data

Runtime current/future collection uses the official War API as primary source.

FoxholeStats and FoxholeHub are historical/bootstrap candidates only. They MUST NOT be hard runtime dependencies.

Historical import automation remains blocked until [DATA_LICENSING.md](./DATA_LICENSING.md) records an acceptable policy.

See [HISTORICAL_DATA.md](./HISTORICAL_DATA.md) and [INGESTION.md](./INGESTION.md).

## 8. Analytics

Core derived analytics include:

- Daily Chronicle;
- War Pace;
- War Compare;
- Records;
- Region Analytics;
- Activity Heatmap;
- Region Rankings;
- War DNA;
- Similar Wars;
- Day vs Day;
- deterministic War Phases;
- descriptive Swing Analysis;
- Objective History.

No model may predict the winner/outcome.

No model may claim causality from temporal correlation alone.

See [ANALYTICS.md](./ANALYTICS.md).

## 9. API

Chronicle exposes a versioned public REST API and CSV exports.

OpenAPI 3.1 is the canonical machine-readable contract. ASP.NET Core generates the document at build time; openapi-typescript generates TypeScript transport types and openapi-fetch is the default frontend client. Handwritten duplicate API DTOs SHOULD NOT be maintained in the web app.

Caddy exposes one public origin:

```text
/api/*  -> Chronicle.Api
/*      -> Next.js
```

Browser CORS is therefore unnecessary for the first-party UI. Public third-party API CORS is configured explicitly.

See [PUBLIC_API.md](./PUBLIC_API.md).

## 10. Web runtime and caching

Caching layers have separate responsibilities:

1. PostgreSQL stores canonical queryable truth.
2. ASP.NET Core Output Cache caches API responses.
3. Next.js 16 Cache Components cache explicitly selected server rendering/data work.
4. Browser cache follows API/page Cache-Control.

Next.js v1 SHOULD use the Cache Components model (cacheComponents + use cache/cacheLife/cacheTag), not treat legacy ISR route configuration as the primary architecture.

Current-war surfaces use short bounded caching. Sealed historical facts may use long caching. v1 does not require Redis or distributed Next.js cache coordination because the baseline has one Next.js instance.

Analytical/shareable view state is encoded in query parameters through typed nuqs parsers; canonical entity identity remains in the pathname.

TanStack Query MUST NOT become a second universal data-fetching architecture. Use it only where client interaction/live refresh justifies it.

Live/phase-2 Event Stream MAY use SSE if product freshness needs justify it.

See [WEB_RUNTIME.md](./WEB_RUNTIME.md).

## 11. Storage

PostgreSQL 18 is the v1 queryable system of record for canonical facts, provenance metadata, sparse semantic history, coverage, aggregates and model outputs.

No table partitioning is required initially.

Replayable source storage uses one logical payload abstraction with hybrid physical storage:

1. fetch/validation metadata in PostgreSQL;
2. small exact raw payloads MAY be stored inline in PostgreSQL;
3. larger replay-heavy payloads use Zstandard-compressed content-addressed storage;
4. sparse relational item/objective evidence remains in PostgreSQL;
5. derived aggregates/models remain in PostgreSQL.

Replay-critical raw payloads SHOULD be retained long-term and replicated offsite. Physical storage tier may change, but exact content identity/replayability must survive.

PostgreSQL and external raw archive together form one recovery unit: a database restore that references missing replay payloads is degraded recovery.

PostgreSQL MUST NOT duplicate every unchanged map item occurrence on every snapshot merely to preserve replayability. Full matcher/parser replay reconstructs occurrences from archived raw payloads.

The accepted planning baseline is 30 active maps/shard under `chronicle-collection-v1`:

- war 5m;
- warReport 15m/map;
- dynamic/public 15m/map;
- maps 60m;
- static once per war/map.

This yields 6,072 scheduled regular requests/day/shard before retries, but request count alone is not a DB-size forecast. Storage sizing MUST be based on measured payload sizes, change ratios and relation/index growth.

See [INGESTION.md](./INGESTION.md), [DATA_MODEL.md](./DATA_MODEL.md), [DATA_LIFECYCLE.md](./DATA_LIFECYCLE.md), [IDEMPOTENCY_RECOVERY.md](./IDEMPOTENCY_RECOVERY.md), [adr/collection-cadence-and-storage.md](./adr/collection-cadence-and-storage.md), [adr/data-lifecycle-and-recovery.md](./adr/data-lifecycle-and-recovery.md), and [adr/idempotency-transaction-crash-recovery.md](./adr/idempotency-transaction-crash-recovery.md).

## 12. Reliability model

This is a single-VPS deployment.

Chronicle MUST prioritize data durability and graceful stale-data behavior over pretending to have multi-node high availability.

The public site must continue serving the last known-good dataset if ingestion fails.

Worker correctness uses at-least-once execution plus deterministic idempotency, not an exactly-once claim. HTTP/CAS work remains outside PostgreSQL transactions. A short raw-capture transaction makes received source evidence durable before canonical processing. Canonical reconciliation then locks endpoint scheduling/fence state and accepted-state cursor in a stable order, requiring both current job ownership and the current endpoint fence token. A connection loss around COMMIT is reconciled by stable fetch/operation identity before retry.

Operational SLOs SHOULD include:

- API read latency;
- page Web Vitals;
- current-data lag;
- aggregation/model lag;
- PostgreSQL growth by relation/index;
- compressed raw archive growth;
- 200/304 and semantic-change ratios;
- raw offsite-replication lag;
- backup freshness;
- restore success;
- last verified restore drill;
- archive referential-integrity failures.

A guaranteed 99.9% availability claim is inappropriate for a non-redundant single node.

## 13. Security

The site is public/read-heavy. The security baseline covers ingestion SSRF/redirect controls, CSP/security headers, server/client secret boundaries, API rate/time limits, request-size limits, database exposure and future operator-plane separation.

Worker outbound requests MUST use allowlisted hosts and redirect validation.

Database MUST not be publicly exposed.

Containers SHOULD run non-root and read-only where practical.

See [SECURITY.md](./SECURITY.md).

## 14. Testing

The concrete baseline uses xUnit v3, Testcontainers.PostgreSql with PostgreSQL 18, FakeTimeProvider, Vitest/React Testing Library, Playwright, axe and k6 where appropriate.

Async Server Component behavior is verified through browser/E2E tests rather than relying on Vitest alone.

Database correctness tests MUST use PostgreSQL for PostgreSQL-specific locks, isolation, mappings, constraints and migrations.

Crash-recovery, unknown-COMMIT, outbox duplicate-effect, PITR and DB-to-CAS completeness tests remain required.

See [TESTING.md](./TESTING.md).

## 15. Authoritative design documents

- [WAR_API_SEMANTICS.md](./WAR_API_SEMANTICS.md)
- [TIME_SEMANTICS.md](./TIME_SEMANTICS.md)
- [DATA_MODEL.md](./DATA_MODEL.md)
- [INGESTION.md](./INGESTION.md)
- [DATA_LIFECYCLE.md](./DATA_LIFECYCLE.md)
- [IDEMPOTENCY_RECOVERY.md](./IDEMPOTENCY_RECOVERY.md)
- [HISTORICAL_DATA.md](./HISTORICAL_DATA.md)
- [METRICS.md](./METRICS.md)
- [ANALYTICS.md](./ANALYTICS.md)
- [OBJECTIVE_IDENTITY.md](./OBJECTIVE_IDENTITY.md)
- [PUBLIC_API.md](./PUBLIC_API.md)
- [LOCALIZATION.md](./LOCALIZATION.md)
- [WEB_RUNTIME.md](./WEB_RUNTIME.md)
- [PLATFORM_DEPENDENCIES.md](./PLATFORM_DEPENDENCIES.md)
- [OBSERVABILITY.md](./OBSERVABILITY.md)
- [SECURITY.md](./SECURITY.md)
- [TESTING.md](./TESTING.md)
- [DATA_LICENSING.md](./DATA_LICENSING.md)
- [PRODUCT_SCOPE.md](./PRODUCT_SCOPE.md)

Architecture decisions are recorded under [adr/](./adr/).

## 16. Pre-backend gate

Before writing core backend domain/data code, the following MUST be reviewed and internally consistent:

- WAR_API_SEMANTICS.md
- TIME_SEMANTICS.md
- DATA_MODEL.md
- INGESTION.md
- DATA_LIFECYCLE.md
- IDEMPOTENCY_RECOVERY.md
- OBJECTIVE_IDENTITY.md
- METRICS.md
- DATA_LICENSING.md

The backend MUST NOT encode unresolved upstream semantics as irreversible schema assumptions.

Production bootstrap MUST also validate idempotency/crash fault injection, backup/PITR, raw-archive replication, archive integrity checks and a DB-to-CAS restore drill before Chronicle treats collected history as durable.
