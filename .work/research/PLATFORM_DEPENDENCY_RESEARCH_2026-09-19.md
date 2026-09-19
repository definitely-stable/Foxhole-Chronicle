# Platform / dependency research synthesis — 2026-09-19

Status: **Research evidence for PLATFORM_DEPENDENCIES.md, WEB_RUNTIME.md, OBSERVABILITY.md and TESTING.md**

## Official/current findings

### Next.js 16 caching

Cache Components are the Next.js 16 model for mixing dynamic and cached content. Enabling cacheComponents makes runtime data dynamic by default and introduces use cache, cacheLife and cacheTag. Old route-level dynamic/revalidate/fetchCache configuration is no longer the preferred mental model under Cache Components.

Sources:

- https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents
- https://nextjs.org/docs/app/api-reference/directives/use-cache
- https://nextjs.org/docs/app/guides/migrating-to-cache-components
- https://nextjs.org/docs/app/guides/self-hosting

### OpenAPI TypeScript

openapi-typescript 7.x generates TypeScript types from OpenAPI 3.0/3.1. openapi-fetch consumes those types while remaining a thin native-fetch client and recommends noUncheckedIndexedAccess plus tsc --noEmit.

Sources:

- https://openapi-ts.dev/introduction
- https://openapi-ts.dev/openapi-fetch/
- https://openapi-ts.dev/openapi-fetch/testing

### URL state

nuqs 2.x supports Next.js App Router and server-side typed loaders/search-param cache.

Sources:

- https://nuqs.dev/docs/installation
- https://nuqs.dev/docs/server-side
- https://nuqs.dev/docs/adapters

### EF Core/Npgsql

EF Core 10 is the .NET 10 LTS-aligned EF release. Npgsql EF provider 10 supports EF 10 and PostgreSQL 18 features including UUIDv7 translation when PG18 is configured. Npgsql 10 is moving toward async-only APIs in future majors.

Sources:

- https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-10.0/whatsnew
- https://www.npgsql.org/efcore/
- https://www.npgsql.org/efcore/release-notes/10.0.html
- https://www.npgsql.org/doc/release-notes/10.0.html

### NodaTime

Npgsql explicitly recommends NodaTime for non-trivial PostgreSQL date/time handling. EF integration uses Npgsql.EntityFrameworkCore.PostgreSQL.NodaTime. NodaTime.Serialization.SystemTextJson provides official System.Text.Json converters.

Sources:

- https://www.npgsql.org/doc/types/nodatime.html
- https://www.npgsql.org/efcore/mapping/nodatime.html
- https://www.nodatime.org/3.3.x/userguide/serialization

### TimeProvider

Microsoft.Extensions.TimeProvider.Testing provides FakeTimeProvider and Microsoft recommends injecting TimeProvider for deterministic current-time/timer tests.

Source:

- https://learn.microsoft.com/en-us/dotnet/core/extensions/timeprovider-testing

### UUIDv7

.NET 10 provides Guid.CreateVersion7. PostgreSQL 18 natively provides uuidv7() and documents UUIDv7 as timestamp-ordered.

Sources:

- https://learn.microsoft.com/en-us/dotnet/api/system.guid.createversion7?view=net-10.0
- https://www.postgresql.org/docs/18/datatype-uuid.html
- https://www.postgresql.org/docs/18/release-18.html

### HTTP resilience

Microsoft.Extensions.Http.Resilience standard handler contains rate limiting, total timeout, retry, circuit breaker and attempt timeout. AddResilienceHandler supports custom pipelines. Chronicle intentionally omits hidden retry/hedging because every source HTTP exchange is provenance.

Sources:

- https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.http.resilience.httpstandardresilienceoptions?view=net-10.0-pp
- https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.dependencyinjection.resiliencehttpclientbuilderextensions.addresiliencehandler?view=net-10.0-pp
- https://learn.microsoft.com/en-us/dotnet/core/resilience/http-resilience

### ASP.NET Core 10

ASP.NET Core provides first-party ProblemDetails, Output Cache, Rate Limiting, Request Timeouts, Health Checks and OpenAPI generation. .NET 10 OpenAPI defaults to OpenAPI 3.1. Build-time generation uses Microsoft.Extensions.ApiDescription.Server. Interactive API UIs are separate; Scalar.AspNetCore integrates with Microsoft.AspNetCore.OpenApi.

Sources:

- https://learn.microsoft.com/en-us/aspnet/core/fundamentals/openapi/aspnetcore-openapi?view=aspnetcore-10.0
- https://learn.microsoft.com/en-us/aspnet/core/fundamentals/error-handling-api?view=aspnetcore-10.0
- https://learn.microsoft.com/en-us/aspnet/core/performance/caching/output?view=aspnetcore-10.0
- https://learn.microsoft.com/en-us/aspnet/core/performance/rate-limit?view=aspnetcore-10.0
- https://learn.microsoft.com/en-us/aspnet/core/performance/timeouts?view=aspnetcore-10.0
- https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/health-checks?view=aspnetcore-10.0
- https://scalar.com/products/api-references/integrations/aspnetcore/integration

### Zod

Zod 4 is stable and is the selected narrow runtime validator for TypeScript boundaries.

Source:

- https://zod.dev/v4

### TanStack Table v9

TanStack Table v9 became stable in August 2026. v9 remains headless and adds a tree-shakable feature architecture/fine-grained state model, making it a good optional fit for Chronicle-controlled table UX.

Sources:

- https://tanstack.com/blog/announcing-tanstack-table-v9
- https://tanstack.com/table/latest/docs/overview
- https://tanstack.com/table/latest/docs/guide/features

### OpenTelemetry

Next.js recommends OpenTelemetry and provides @vercel/otel for self-hosted or hosted deployments. OpenTelemetry JS browser instrumentation is still less mature/experimental. .NET uses ILogger, Meter and ActivitySource with the OpenTelemetry SDK/exporters.

Npgsql 10 improved tracing/metrics alignment with OTel database conventions.

Sources:

- https://nextjs.org/docs/pages/guides/open-telemetry
- https://nextjs.org/docs/app/guides/instrumentation
- https://opentelemetry.io/docs/languages/js/
- https://opentelemetry.io/docs/languages/dotnet/instrumentation/
- https://learn.microsoft.com/en-us/dotnet/core/diagnostics/observability-with-otel
- https://www.npgsql.org/doc/release-notes/10.0.html
- https://www.npgsql.org/doc/diagnostics/metrics.html
- https://www.npgsql.org/doc/diagnostics/tracing.html

### PostgreSQL query diagnostics

pg_stat_statements tracks normalized SQL planning/execution statistics and requires shared_preload_libraries plus CREATE EXTENSION.

Source:

- https://www.postgresql.org/docs/18/pgstatstatements.html

### Testing

Next.js documents Vitest + React Testing Library but recommends E2E for async Server Components. Playwright documents axe integration while warning automated accessibility tests do not replace manual testing. Testcontainers provides a PostgreSQL module for .NET.

Sources:

- https://nextjs.org/docs/app/guides/testing/vitest
- https://nextjs.org/docs/app/guides/testing
- https://playwright.dev/docs/accessibility-testing
- https://dotnet.testcontainers.org/modules/postgres/

### Security

Next.js recommends CSP and standard production hardening. Nonce-based CSP affects rendering/dynamic behavior; experimental SRI is webpack-only. The server-only package prevents accidental server module import from client code.

Sources:

- https://nextjs.org/docs/app/guides/production-checklist
- https://nextjs.org/docs/15/app/guides/content-security-policy
- https://nextjs.org/docs/app/guides/data-security
- https://nextjs.org/docs/app/api-reference/config/next-config-js/headers

### Performance testing

Grafana k6 provides protocol load tests and thresholds/SLO-style criteria.

Sources:

- https://grafana.com/docs/k6/latest/testing-guides/api-load-testing/
- https://grafana.com/docs/k6/latest/using-k6/thresholds/

## Chronicle-specific conclusions

- Do not add a generic repository layer around PostgreSQL semantics.
- Do not add hidden HTTP retries to source ingestion.
- Do not introduce Redis for one Next.js instance.
- Do not duplicate OpenAPI DTOs in TypeScript.
- Do not use browser OTel as a v1 requirement.
- Do not add Serilog, Dapper, MediatR, AutoMapper or FluentValidation by default.
- Prefer pg_stat_statements before introducing an external query analytics system.
- Prefer PostgreSQL alias/trigram search before a dedicated search engine.
