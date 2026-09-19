# Foxhole Chronicle — Observability and Performance Diagnostics

Status: **Authoritative working specification**

Research baseline: **2026-09-19**

## 1. Objectives

Observability must answer:

- is Chronicle serving requests correctly and quickly;
- is source collection healthy;
- how stale is current data;
- where did an ingestion/reconciliation operation fail;
- which PostgreSQL queries consume time/I/O;
- whether archive/backup/raw replication is healthy;
- whether a user-visible regression is web, API, database or upstream-source related.

Chronicle uses logs, metrics and distributed traces together.

## 2. OpenTelemetry boundary

Chronicle uses OpenTelemetry and OTLP.

Application components export to a local/nearby collector boundary rather than coding directly against an observability vendor.

Logical services:

- foxhole-chronicle-web;
- foxhole-chronicle-api;
- foxhole-chronicle-worker.

Resource attributes include deployment environment and service version/commit.

## 3. Next.js

Use @vercel/otel through instrumentation.ts for Next.js server instrumentation.

Do not enable browser OpenTelemetry as a v1 default. OpenTelemetry JS browser instrumentation remains less mature/standardized than Node server instrumentation.

Browser experience is initially measured through:

- Core Web Vitals;
- Playwright/browser performance scenarios;
- optional project-owned Web Vitals reporting.

## 4. .NET

Use the .NET OpenTelemetry SDK with:

- OpenTelemetry.Extensions.Hosting;
- OTLP exporter;
- ASP.NET Core instrumentation;
- HttpClient instrumentation;
- Runtime instrumentation.

Application-specific traces use ActivitySource.

Application-specific metrics use Meter.

Application logs use Microsoft.Extensions.Logging and OpenTelemetry export.

Serilog is not required for v1.

## 5. PostgreSQL/Npgsql telemetry

Npgsql 10 emits metrics aligned more closely with OpenTelemetry database conventions and improved tracing for commands, COPY and physical connection opening.

Use Npgsql.OpenTelemetry when database spans are enabled.

Do not simultaneously add redundant database instrumentation that creates duplicate spans for the same PostgreSQL command.

EF Core query tags MAY add constant logical operation names such as:

~~~text
Chronicle.War.Current
Chronicle.War.Timeline
Chronicle.Compare.Wars
Chronicle.Records.Query
Chronicle.Worker.Reconcile
~~~

Tags MUST NOT contain war IDs, payload hashes, user input or other high-cardinality values.

## 6. pg_stat_statements

PostgreSQL production configuration MUST preload and enable pg_stat_statements.

It is the primary database-side aggregate query diagnostic.

Track at least:

- calls;
- total/mean execution time;
- rows;
- shared block hits/reads;
- temp I/O where relevant;
- WAL-related signals exposed by the installed PostgreSQL release;
- parallel-worker behavior where relevant.

Query diagnostics combine:

- pg_stat_statements queryid;
- stable application/query tag;
- OTel trace/span when investigating a single request.

Do not expose raw SQL with sensitive values as a public metric label.

## 7. Metrics cardinality

Metrics MUST use bounded dimensions.

Forbidden metric labels include:

- war UUID;
- objective UUID;
- fetch ID;
- payload hash;
- trace ID;
- exception message;
- arbitrary endpoint URL containing identifiers.

These values belong in structured logs/traces.

Safe metric dimensions include bounded enums such as:

- service;
- endpoint class;
- source kind;
- shard from a known bounded set;
- outcome class;
- freshness state;
- quality class;
- job kind.

## 8. Correlation

Every external web/API request should have trace correlation.

Worker operations should correlate:

- logical job ID;
- attempt ID;
- source fetch ID;
- reconciliation operation ID;
- outbox job ID.

IDs are trace/log fields, not metrics labels.

HTTP propagation follows W3C trace context.

## 9. Health endpoints

API health SHOULD separate:

- liveness: process can run/respond;
- readiness: required local dependencies for serving are usable.

A temporary War API outage MUST NOT make the read-only public API unready if the API can still serve last-known-good PostgreSQL data.

Worker health separately exposes source-collection lag/failure.

Readiness SHOULD check PostgreSQL where serving canonical reads depends on it.

Archive/offsite-replica lag is an operational metric, not normally an API liveness condition.

## 10. Logs

Use structured logs.

Prefer event names/stable event IDs to parsing prose.

Production logs MUST avoid:

- raw secrets;
- full sensitive headers;
- unbounded payload bodies;
- storing entire upstream responses by default.

Raw source payloads belong in the raw evidence store, not normal logs.

## 11. Performance/load tests

Grafana k6 is the preferred protocol-level load tool.

Scenarios SHOULD cover:

- current overview API;
- war timeline;
- compare;
- records/archive pagination;
- bursts of public anonymous reads;
- output-cache cold/warm behavior.

Thresholds should map to measured SLO targets rather than arbitrary universal numbers.

Browser performance remains separate from protocol load testing.

## 12. Backend choice

The observability storage/UI backend is deliberately not coupled into application architecture.

Any selected backend MUST accept standard OTLP directly or through the collector.

Chronicle MAY use Grafana-family components, another self-hosted stack or a hosted provider without rewriting instrumentation.

For the single-VPS deployment, backend resource consumption MUST be measured before co-locating a large logs/traces stack with PostgreSQL.
