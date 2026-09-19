# Research brief

Research date target: **2026-09-19**.

## Goal

Produce a production-ready architecture and implementation specification for Foxhole Chronicle, critically reconciling prior architecture reviews with current primary documentation.

## Baseline architecture to verify

- Next.js 16.x + React 19.x + TypeScript + supported Node LTS
- Tailwind CSS 4.x
- Radix UI
- TanStack Query only for genuinely live/client-interactive areas
- Apache ECharts 6.1+
- ASP.NET Core / .NET 10 LTS, C# 14
- PostgreSQL 18.x
- Caddy
- Docker Compose
- OpenTelemetry
- modular monolith / vertical slices
- separate ingestion worker
- REST API
- PostgreSQL as primary datastore
- Next.js for presentation/SSR
- ASP.NET Core as authoritative API/business/data layer
- one public origin through Caddy: `/api/*` -> ASP.NET Core; everything else -> Next.js

The research MUST reject or replace any baseline choice that is not justified by current official documentation and operational constraints.

## Primary-source requirements

1. Verify Foxhole War API behavior against the latest official Foxhole/Siege Camp material and official `clapfoot/warapi` repository.
2. Verify endpoint semantics, shards, cache behavior/ETag where documented, identifiers, map item schema, timestamps and limitations.
3. Verify technology support/security status from primary vendor/project documentation.
4. Treat FoxholeStats historical import conservatively: verify robots/ToS/fan-content constraints where possible; do not infer permission from public accessibility.

## Core data semantics

The design MUST explicitly model:

- canonical internal war UUID
- shard
- official war ID
- display war number/alias
- `captured_at`
- source timestamp when present
- `war_day`
- `war_elapsed_seconds`
- UTC calendar date
- observation intervals
- provenance
- coverage
- data quality/resolution
- late corrections
- deduplication/idempotency
- reconciliation/reprocessing

Polling-derived changes MUST NOT be represented as exact event timestamps when the source only supports an observed interval. Prefer an `ObservedChange`/equivalent model with `previous_observed_at`, `current_observed_at`, detector version and confidence/quality metadata where justified.

Map-object identity MUST NOT assume a stable upstream objective ID unless verified. Define an internal identity strategy anchored in static map data, with versioned identity logic.

## Raw ingestion and retention

Evaluate with transparent sizing scenarios:

- 1/2/5 minute polling
- dynamic/public separately from warReport
- plausible raw payload-size scenarios
- changed-payload ratios
- requests/day/year
- rows/day/year
- PostgreSQL storage order of magnitude
- bandwidth
- backup size

Prefer content-addressed raw payloads:

- source fetch metadata
- payload keyed by content hash
- ETag/source timestamp where available
- conditional GET where supported
- explicit retention policy

Do not introduce PostgreSQL partitioning in v1 without measured thresholds that justify it. Define the threshold and migration path instead.

## Ingestion requirements

Specify:

- scheduler/freshness policy
- conditional requests
- concurrency limits
- advisory/distributed locking appropriate to single-VPS deployment
- idempotency
- retry with exponential backoff + jitter
- circuit breaker where useful
- rate limiting
- schema-drift detection
- ingestion job state machine
- backfill
- replay/reprocessing
- reconciliation
- targeted recomputation after corrections

## Metrics

Create a versioned metric registry with:

- name/key
- version
- unit
- formula
- window
- required source inputs
- aggregation semantics
- coverage requirements
- algorithm hash/version
- sample count
- coverage ratio
- quality/confidence metadata where meaningful

Downsampling MUST be semantic: cumulative values, deltas and rates cannot all use the same aggregation.

Do not implement or specify automatic Turning Points. Do not predict a war winner or outcome.

## API

Specify:

- REST contracts
- OpenAPI
- generated TypeScript client
- RFC 7807/ProblemDetails-compatible errors
- cursor pagination for event/change streams
- filters
- `resolution=auto|5m|1h|1d` or a better justified contract
- ETag/Cache-Control/freshness metadata
- coverage/source metadata
- health/live/ready/status/source endpoints
- SSE decision for phase 2

## Frontend

Define:

- Next.js RSC/SSR/ISR/cache strategy
- historical vs current-war behavior
- strict scope for TanStack Query
- ECharts modular loading/dynamic import
- backend downsampling
- accessibility
- responsive analytical layouts
- SEO/archive behavior
- OpenGraph
- loading/error/stale states

## Design direction

High-level concept: **Strategic Data Observatory**.

The design specification should modernize and critically define this concept through:

- information hierarchy
- density
- typography
- chart language
- faction colors as semantic accents, not decorative chrome
- colorblind-safe encoding
- tabular numerals
- responsive behavior
- stale/error/loading/coverage states

Do not select concrete reference websites/screenshots in this research pass.

## Single-VPS operations

Specify:

- recommended VPS sizing with assumptions
- Docker Compose topology
- Caddy
- internal networks
- persistent volumes
- secrets
- non-root/read-only containers where feasible
- PostgreSQL tuning
- backup + WAL/offsite strategy
- restore drills
- migrations
- deployment
- rollback
- realistic SLOs for a single node
- disaster recovery

A 99.9% availability target MUST NOT be claimed as guaranteed for a non-redundant single-node architecture.

## Observability

Cover:

- structured logs
- metrics
- traces
- ingestion lag
- source failures
- conditional-request/304 ratio
- payload/schema drift
- DB growth
- aggregate lag
- API latency/errors
- Web Vitals
- disk/certificate/backup health

## Security

Threat-model the public read-only analytics service:

- ingestion SSRF boundaries
- untrusted source/chart text
- XSS
- CSP/HSTS/security headers
- CORS
- public API rate limiting
- dependency/container scanning
- secret handling
- admin/CLI boundaries
- DB/network access
- supply-chain risks

## Testing

Specify:

- unit tests
- golden datasets for metrics
- parser fixtures/snapshots
- source/API contract tests
- WireMock or equivalent
- Testcontainers PostgreSQL
- migration tests
- Playwright
- accessibility tests
- load tests
- backup restore tests

## Deliverable quality

The final documentation must give concrete decisions, not menus of alternatives, except where a decision is genuinely unresolved.

Each disputed recommendation from previous reviews should be either accepted with justification, modified, or explicitly rejected with primary-source evidence.
