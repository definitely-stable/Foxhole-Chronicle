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
        Ingestion Worker
                |
        allowed data sources
```

The API and Worker share application/domain/data contracts, but run as separate processes so source failures and long-running collection jobs do not block web requests.

v1 MUST NOT introduce Redis, Kafka, RabbitMQ, Kubernetes, TimescaleDB, GraphQL or a vector database without a measured requirement and an ADR.

## 3. Technology baseline

Working baseline, pending final version verification from official project documentation:

- Next.js 16.x
- React 19.x
- TypeScript
- supported Node.js LTS
- Tailwind CSS 4.x
- Radix UI primitives
- TanStack Query only for truly client-live/interactively refreshed surfaces
- Apache ECharts 6.1+
- ASP.NET Core / .NET 10 LTS
- C# 14
- PostgreSQL 18.x
- pgBackRest for physical backup/WAL-PITR management
- Zstandard for external raw/archive compression
- Apache Parquet for sealed analytical exports only
- Caddy
- Docker Compose
- OpenTelemetry

Version assertions MUST be pinned by the final research pass before production bootstrap. Backup/archive tooling versions MUST also be compatibility-tested against the selected PostgreSQL/runtime image.

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
- SSR/RSC;
- SEO and OpenGraph;
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

- public REST contract;
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
- raw payload dedup;
- normalization;
- reconciliation;
- observed-change detection;
- aggregates;
- analytical model recomputation.

### PostgreSQL

Owns:

- canonical facts;
- source provenance;
- current and historical state;
- aggregates;
- metric/model results;
- share/export manifests;
- job/lease state.

## 6. Data semantics

The canonical chain is:

`source -> fetch -> observation -> normalized fact -> observed change -> derived metric -> analytical model/result -> share/export`

This separation is mandatory.

Key rules:

1. Polling bounds a change to an observation interval; it does not prove exact in-game event time.
2. War-relative elapsed time is distinct from UTC calendar date and from any upstream game-day field; canonical bucket boundaries follow TIME_SEMANTICS.md.
3. Objective identity is Chronicle-owned unless a stable upstream identifier is explicitly verified.
4. Every derived metric/model is deterministic, reproducible and versioned.
5. Coverage and provenance are first-class data.
6. Historical sources may have lower resolution and MUST be labeled accordingly.
7. Collection resolution is distinct from UI/aggregation resolution; `chronicle-collection-v1` collects war at 5m and warReport/dynamic map state at 15m.

Official source semantics are fixed in [WAR_API_SEMANTICS.md](./WAR_API_SEMANTICS.md). Canonical war-relative clock/bucket semantics are fixed in [TIME_SEMANTICS.md](./TIME_SEMANTICS.md). Domain/storage rules are in [DATA_MODEL.md](./DATA_MODEL.md), [OBJECTIVE_IDENTITY.md](./OBJECTIVE_IDENTITY.md), and [METRICS.md](./METRICS.md).

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

OpenAPI is the canonical machine-readable contract. Frontend TypeScript clients SHOULD be generated from it.

Caddy exposes one public origin:

```text
/api/*  -> Chronicle.Api
/*      -> Next.js
```

Browser CORS is therefore unnecessary for the first-party UI. Public third-party API CORS is configured explicitly.

See [PUBLIC_API.md](./PUBLIC_API.md).

## 10. Caching

Caching layers have separate responsibilities:

1. PostgreSQL stores canonical queryable truth.
2. ASP.NET Core Output Cache caches API responses.
3. Next.js caching/ISR/RSC optimizes presentation and historical pages.
4. Browser cache follows API/page Cache-Control.

TanStack Query MUST NOT become a second universal data-fetching architecture. Use it only where client interaction/live refresh justifies it.

Live/phase-2 Event Stream MAY use SSE if product freshness needs justify it.

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

See [INGESTION.md](./INGESTION.md), [DATA_MODEL.md](./DATA_MODEL.md), [DATA_LIFECYCLE.md](./DATA_LIFECYCLE.md), [adr/collection-cadence-and-storage.md](./adr/collection-cadence-and-storage.md), and [adr/data-lifecycle-and-recovery.md](./adr/data-lifecycle-and-recovery.md).

## 12. Reliability model

This is a single-VPS deployment.

Chronicle MUST prioritize data durability and graceful stale-data behavior over pretending to have multi-node high availability.

The public site must continue serving the last known-good dataset if ingestion fails.

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

The site is public/read-heavy.

Primary threats include:

- ingestion SSRF/open redirect abuse;
- untrusted source text/XSS;
- public API abuse;
- secret leakage;
- database exposure;
- supply-chain/dependency vulnerabilities;
- malicious/oversized upstream payloads.

Worker outbound requests MUST use allowlisted hosts.

Database MUST not be publicly exposed.

Containers SHOULD run non-root and read-only where practical.

## 14. Testing

Required test layers:

- unit;
- parser fixtures;
- metric/model golden datasets;
- PostgreSQL integration via Testcontainers;
- source contract tests;
- migration tests;
- OpenAPI compatibility;
- Playwright;
- accessibility;
- load tests;
- backup restore drills.

## 15. Authoritative design documents

- [WAR_API_SEMANTICS.md](./WAR_API_SEMANTICS.md)
- [TIME_SEMANTICS.md](./TIME_SEMANTICS.md)
- [DATA_MODEL.md](./DATA_MODEL.md)
- [INGESTION.md](./INGESTION.md)
- [DATA_LIFECYCLE.md](./DATA_LIFECYCLE.md)
- [HISTORICAL_DATA.md](./HISTORICAL_DATA.md)
- [METRICS.md](./METRICS.md)
- [ANALYTICS.md](./ANALYTICS.md)
- [OBJECTIVE_IDENTITY.md](./OBJECTIVE_IDENTITY.md)
- [PUBLIC_API.md](./PUBLIC_API.md)
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
- OBJECTIVE_IDENTITY.md
- METRICS.md
- DATA_LICENSING.md

The backend MUST NOT encode unresolved upstream semantics as irreversible schema assumptions.

Production bootstrap MUST also validate backup/PITR, raw-archive replication, archive integrity checks and a restore drill before Chronicle treats collected history as durable.
