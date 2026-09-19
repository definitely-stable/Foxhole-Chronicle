# Foxhole Chronicle — Web Runtime Architecture

Status: **Authoritative working specification**

Research baseline: **2026-09-19**

This document defines Next.js runtime rendering, caching, URL state, API-client and browser/server boundaries.

## 1. Rendering model

Chronicle uses Next.js 16 App Router with React Server Components as the default.

Client Components are used only for real client interactivity such as:

- chart interaction;
- local table controls;
- language selector interaction;
- copy/share controls;
- live-refresh surfaces;
- URL-state controls that require browser history updates.

Fetching canonical Chronicle data SHOULD happen server-side by default.

## 2. Cache Components

Chronicle SHOULD enable Next.js 16 Cache Components.

This means:

- dynamic/runtime data access is dynamic by default;
- reusable cacheable work is marked explicitly with use cache;
- cacheLife defines time semantics;
- cacheTag identifies invalidation groups;
- old route-level dynamic/revalidate/fetchCache conventions SHOULD NOT be the primary v1 model.

Do not carry a Next.js 14/15 ISR mental model into the implementation.

## 3. Cache classes

Chronicle uses separate cache behavior for different truth classes.

### Current war/current analytics

Current data is bounded by collection cadence and should use short bounded caching.

Initial implementation SHOULD prefer time-bounded cache profiles over cross-process push invalidation.

Reason:

- Chronicle Worker and Next.js are separate processes;
- v1 is a single Next.js instance;
- source collection itself is 5m/15m;
- a distributed invalidation system would add complexity without making source observations fresher.

### Sealed historical wars

Sealed historical base facts are effectively immutable except explicit reprocessing/revision.

They MAY use long cache lifetimes.

Derived/model surfaces MUST still include the metric/model/data revision in their cache identity or invalidation policy.

### Archive/records/compare

These may use medium/long caching with tags or bounded lifetimes based on their dependencies.

### Source status/freshness

Operational source status uses short caching or no Next cache where freshness is more important than rendering reuse.

## 4. Cache keys and locale

Locale is explicit in the route and therefore part of UI cache identity.

Cached components MUST NOT read Accept-Language to vary a locale-prefixed page.

Request runtime values such as cookies or headers SHOULD be read outside use-cache scopes and passed as explicit arguments if needed.

Canonical API data remains locale-neutral, so API output-cache identity does not include UI locale.

## 5. No distributed cache in v1

With one self-hosted Next.js instance and persistent local disk, Next.js local cache is sufficient for v1.

Redis MUST NOT be introduced solely for Next.js cache coordination.

If Chronicle later runs multiple Next.js instances, cache-tag coordination and shared-cache requirements MUST be reviewed before scaling out.

## 6. API client

The frontend API contract is generated from ASP.NET Core OpenAPI 3.1.

Pipeline:

~~~text
Chronicle.Api
  -> build-time public OpenAPI document
  -> openapi-typescript
  -> generated paths/components types
  -> openapi-fetch
~~~

Rules:

- generated files are not manually edited;
- handwritten duplicate DTOs are prohibited unless the DTO is intentionally a frontend view model rather than API transport model;
- native fetch semantics remain visible;
- response headers remain available for ETag/Cache-Control/freshness behavior;
- middleware MAY add correlation/tracing headers but MUST NOT create hidden application semantics.

openapi-react-query is not baseline. Where TanStack Query is justified, its query functions SHOULD call the same openapi-fetch client.

## 7. URL state

Chronicle analytical pages are shareable research surfaces. Important view state belongs in the URL.

nuqs is the approved parser/state library for query-string view state.

Examples:

- metric;
- resolution;
- from/to range;
- comparison war IDs;
- region filters;
- day selection;
- normalization mode;
- sort/filter settings where sharing them is useful.

Rules:

- canonical resource identity belongs in the pathname;
- analytical/shareable state belongs in query parameters;
- ephemeral visual state belongs in local React state;
- large arbitrary JSON blobs MUST NOT be stored in the URL;
- URL state parsers are declared once and reused server/client;
- Server Components SHOULD parse with nuqs/server loaders/cache;
- public analytical query state SHOULD use strict parsing where invalid values would change analytical meaning.

Locale switching MUST preserve compatible pathname/query state.

## 8. Client state

Chronicle does not adopt a global client-state library in v1.

State priority:

1. server/canonical API data;
2. pathname identity;
3. query-string analytical state;
4. RSC/component props;
5. local component state;
6. TanStack Query state only for truly live client fetching.

Redux/Zustand/Jotai require a demonstrated cross-tree client-state problem before adoption.

## 9. Runtime validation

Zod 4 validates only untyped web runtime boundaries.

Environment variables SHOULD be validated at startup/import through one server-only environment module.

Do not expose server variables through NEXT_PUBLIC_.

The environment module MUST fail clearly when required configuration is missing.

Generated OpenAPI types are not runtime validators. If a future external/untrusted endpoint requires runtime payload validation, add a boundary schema there rather than validating every internal API response twice.

## 10. Server-only boundaries

Modules containing:

- server environment values;
- internal API base URLs;
- secrets;
- server-only fetch helpers;
- private telemetry exporters;

SHOULD import server-only.

Do not rely on experimental taint APIs as the main data-leak boundary.

## 11. Tables

Simple tabular output uses semantic HTML.

Adopt TanStack Table v9 only when a table needs richer controlled state.

Chronicle owns:

- markup;
- accessibility;
- styling;
- responsive behavior.

TanStack Table owns headless state/model logic.

Table pagination/filtering MUST distinguish client-local operations from server-side query operations. Large Archive/Records datasets paginate/filter server-side.

## 12. Charts

Apache ECharts remains the chart engine.

Charts are isolated Client Components.

Keep the data transformation/metric definition server-side or in shared deterministic view-model code where possible.

Do not make chart configuration the source of analytical truth.

Visible labels/tooltips/legend text are localized; metric IDs and series identifiers are stable/invariant.

## 13. Security headers and CSP

Chronicle MUST ship a CSP and standard security headers.

However, a nonce-based strict CSP can force request-time dynamic rendering and conflict with the product's cache-heavy public pages.

Therefore v1 SHOULD:

- use a reviewed static CSP compatible with the selected Next.js output;
- minimize third-party scripts;
- use frame-ancestors, object-src, base-uri and other restrictive directives;
- use HSTS at the public edge;
- set X-Content-Type-Options, Referrer-Policy and a restrictive Permissions-Policy;
- start stricter policy changes in report-only mode where practical.

Do NOT adopt Next.js experimental webpack-only SRI as a core security dependency while the project uses modern Next.js/Turbopack defaults.

If future compliance requires nonce-based strict CSP, the rendering/cache cost MUST be explicitly re-evaluated.

## 14. Production performance

Chronicle SHOULD measure:

- LCP;
- INP;
- CLS;
- server response latency;
- route payload size;
- client JS by route;
- chart initialization cost.

Use Next.js production build/start for representative measurements.

Use bundle analysis when bundle growth becomes material. Do not add large client dependencies without checking route-level impact.

## 15. Explicit non-goals

v1 does not use:

- a client-side universal API cache;
- a global Redux-like store;
- locale-hidden cache variants;
- Redis-backed Next.js cache;
- request-time machine translation;
- client-side canonical metric computation.
