# Foxhole Chronicle — Public Data API

Status: **Authoritative working specification**

Chronicle is both a website and a public normalized-data provider.

Base path:

`/api/v1`

OpenAPI 3.1 is the canonical machine-readable contract.

ASP.NET Core 10 first-party OpenAPI generation is the source of that document. Chronicle SHOULD generate the public v1 OpenAPI document at build time with Microsoft.Extensions.ApiDescription.Server so frontend type generation and contract tests do not require starting the API process.

## 1. Principles

The API MUST:

- expose normalized Chronicle entities and derived analytics;
- preserve source/provenance/coverage;
- use stable identifiers;
- support conditional caching;
- provide machine-readable errors;
- remain locale-neutral: stable fields/enums/CSV identifiers MUST NOT vary by UI locale, locale cookie or `Accept-Language`;
- avoid mirroring raw upstream payloads by default;
- be usable without a user account for public read operations.

### Localization boundary

The public data API is not localized.

- `/api/v1/*` MUST NOT be nested below `/{locale}`.
- JSON field names, enum tokens, identifiers, timestamps and CSV column names are culture-invariant machine contracts.
- `Accept-Language` MUST NOT change the semantic representation of canonical data.
- Human-facing API documentation MAY be localized in the Next.js UI.
- Date/number presentation formatting belongs to the UI; canonical timestamps remain ISO-8601 UTC and numeric JSON values remain numeric.

See [LOCALIZATION.md](./LOCALIZATION.md).

### Frontend contract generation

The first-party Next.js client uses:

~~~text
ASP.NET Core endpoint metadata
  -> build-time OpenAPI 3.1
  -> openapi-typescript
  -> generated TypeScript transport types
  -> openapi-fetch
~~~

Rules:

- generated TypeScript API transport types are not manually edited;
- frontend code MUST NOT maintain duplicate handwritten transport DTOs when OpenAPI already defines them;
- openapi-fetch remains a thin native-fetch client so response status/headers/ETag/Cache-Control remain available;
- TanStack Query, where justified for a client-live surface, calls the same typed openapi-fetch client.

Scalar.AspNetCore MAY expose a developer/internal interactive reference from the same OpenAPI document. It is not the canonical contract.

See [PLATFORM_DEPENDENCIES.md](./PLATFORM_DEPENDENCIES.md) and [WEB_RUNTIME.md](./WEB_RUNTIME.md).

## 2. Core endpoints

### Current War

- `GET /api/v1/shards/{shard}/current`
- `GET /api/v1/status`
- `GET /api/v1/sources`

The shard current response SHOULD identify the canonical Chronicle war UUID so the UI can move from Current War into the canonical Timeline/Replay workspace without relying on unqualified war number.

Current War is a projection of the same canonical history used by Timeline and Replay. It MUST NOT maintain a separate live-only truth model.

A future aggregate `GET /api/v1/current` MAY return a collection of current wars across shards, but it MUST NOT imply one globally unique current war.

### Wars

Canonical machine resource identity uses immutable Chronicle war UUID:

- `GET /api/v1/wars/{chronicleWarId}`
- `GET /api/v1/wars/{chronicleWarId}/timeline`
- `GET /api/v1/wars/{chronicleWarId}/replay/manifest`
- `GET /api/v1/wars/{chronicleWarId}/replay/state?at={utcInstant}`
- `GET /api/v1/wars/{chronicleWarId}/replay/changes?from={utcInstant}&to={utcInstant}&after={cursor}&limit={n}`
- `GET /api/v1/wars/{chronicleWarId}/days/{day}` — `{day}` is Chronicle 1-based elapsed war day
- `GET /api/v1/wars/{chronicleWarId}/regions`
- `GET /api/v1/wars/{chronicleWarId}/regions/{region}`
- `GET /api/v1/wars/{chronicleWarId}/dna`
- `GET /api/v1/wars/{chronicleWarId}/similar`
- `GET /api/v1/wars/{chronicleWarId}/phases`
- `GET /api/v1/wars/{chronicleWarId}/swings`

Lookup/convenience endpoints are explicitly shard-aware:

- `GET /api/v1/wars`
- `GET /api/v1/shards/{shard}/wars/{warNumber}`

`warNumber` MUST NOT be accepted as an unqualified canonical `{war}` path identifier because it is shard-scoped.

### Compare

- `GET /api/v1/compare?wars=...`
- `GET /api/v1/compare/days?day=17&wars=...&partialMode=partial_as_is|like_for_like_fraction`

### Objectives

- `GET /api/v1/objectives/{objective}`
- `GET /api/v1/objectives/{objective}/history`
- `GET /api/v1/objectives/{objective}/revisions`

Objective identifiers in public routes resolve through canonical Chronicle identity/alias rules. A superseded alias SHOULD redirect or resolve to the surviving canonical objective without breaking old links.

### Records

- `GET /api/v1/records`

### Changes/events

Phase 2:

- `GET /api/v1/changes`
- `GET /api/v1/changes/stream` via SSE if adopted

## 3. Timeline query

Example:

`GET /api/v1/wars/{chronicleWarId}/timeline?metric=casualties&from=...&to=...&resolution=auto`

Supported generic resolution contract:

- `auto`
- `native`
- `15m`
- `1h`
- `1d`

Under `chronicle-collection-v1`, ordinary warReport/dynamic-derived high resolution is 15 minutes.

A finer resolution such as `5m` MAY exist only for a metric/dataset whose actual supporting observations permit it. Chronicle MUST NOT upsample 15m evidence and label it 5m data.

A requested resolution MAY be rejected/downgraded if source/collection/historical coverage cannot support it. The response MUST state effective resolution and collection profile.

Timeline is the central war-history query surface. Observed changes returned for Timeline MUST retain `previousObservedAt` / `currentObservedAt` uncertainty semantics rather than expose a fabricated exact event timestamp.

## 3.1 Replay contract

Replay is an observed-history projection over the same canonical data as Timeline.

### Manifest

`GET /api/v1/wars/{chronicleWarId}/replay/manifest`

The manifest SHOULD contain stable/slow-changing metadata required to render Replay efficiently:

- war identity and time bounds;
- region identities;
- objective identities/positions needed for the active war/map identity revision;
- available replay/coverage bounds;
- identity resolution version;
- relevant archive/data revision;
- map/static metadata required by the current replay renderer.

For sealed wars the manifest MAY use long-lived caching.

### State at selected instant

`GET /api/v1/wars/{chronicleWarId}/replay/state?at={utcInstant}`

`at` is an absolute UTC instant. The UI derives elapsed Day N/time from canonical war-time semantics.

Each replay item SHOULD include:

- canonical objective/region identity;
- position;
- observed owner/state where supported;
- `replayStateClass`;
- supporting/bounding observations;
- coverage/quality;
- identity resolution version;
- applicable data/time revision metadata.

Baseline `replayStateClass` values:

- `confirmed_observed`;
- `transition_uncertain`;
- `no_coverage`.

If Chronicle knows only that a state changed in `(previousObservedAt, currentObservedAt]`, a selected instant inside that unresolved transition window MUST NOT be assigned an interpolated exact state.

### Replay change range

`GET /api/v1/wars/{chronicleWarId}/replay/changes?from={utcInstant}&to={utcInstant}&after={cursor}&limit={n}`

This returns ordered accepted observed-change records for client playback.

Every record preserves its observation interval; ordering for deterministic transport/playback MUST NOT be misrepresented as exact in-game event ordering when uncertainty windows overlap.

The endpoint uses cursor pagination for large ranges.

### Client reconstruction invariant

For a supported point/range, a direct replay state query and:

`baseline replay state + ordered accepted replay changes`

SHOULD reconstruct the same Chronicle-observed state under the documented coverage/uncertainty semantics.

The browser MUST NOT fetch a full state snapshot for every animation frame.

See [CORE_WAR_EXPERIENCE.md](./CORE_WAR_EXPERIENCE.md).

## 4. Envelope metadata

Analytical responses SHOULD include:

```json
{
  "data": {},
  "meta": {
    "dataAsOf": "2026-09-19T12:00:00Z",
    "freshnessState": "fresh",
    "resolution": "15m",
    "collectionProfileVersion": "chronicle-collection-v1",
    "coverageRatio": 0.99,
    "qualityClass": "high",
    "sources": ["official-war-api"],
    "metricVersions": {},
    "modelVersions": {},
    "timeSemanticsVersion": "elapsed-war-clock@1",
    "warTimeRevision": 1
  }
}
```

For simple list endpoints, metadata MAY be represented in headers where clearer.

`collectionProfileVersion` describes Chronicle's source collection cadence when that cadence materially bounds what could have been observed. It is not the same as response/downsample `resolution`.

Objective-derived responses additionally SHOULD expose:

```json
{
  "identity": {
    "resolutionVersion": "objective-identity-v1",
    "coverageRatio": 0.98,
    "qualityClass": "complete",
    "ambiguousObservationCount": 0,
    "unmatchedObservationCount": 1
  }
}
```

These values describe Chronicle identity resolution quality; they are not source-provided confidence probabilities.

## 4.1 Objective History contract

`GET /api/v1/objectives/{objective}/history` SHOULD return:

- immutable canonical objective ID;
- canonical key;
- aliases;
- revision metadata;
- selected war or war range;
- normalized state/ownership intervals;
- observed changes;
- source coverage;
- identity coverage;
- active identity resolution version;
- taxonomy/state-model version;
- polling uncertainty boundaries.

Observed change shape SHOULD use interval semantics:

```json
{
  "changeType": "ownership_change_observed",
  "previousObservedAt": "2026-09-19T10:01:00Z",
  "currentObservedAt": "2026-09-19T10:02:00Z",
  "previousOwner": "WARDENS",
  "currentOwner": "COLONIALS"
}
```

The API MUST NOT emit a fabricated exact `capturedAt` when the source only supports an observation interval.

If identity quality is insufficient for canonical history, the API SHOULD return an explicit unavailable/degraded state rather than silently merge ambiguous observations.

## 4.2 Canonical war-time contract

War/current/day responses SHOULD use explicit fields:

```json
{
  "conquestStartAt": "2026-09-01T14:30:00Z",
  "conquestEndAt": null,
  "resistanceStartAt": null,
  "scheduledConquestEndAt": null,
  "dataAsOf": "2026-09-19T12:00:00Z",
  "elapsedWarSeconds": 1531800,
  "elapsedWarDay": 18,
  "dayStartAt": "2026-09-18T14:30:00Z",
  "dayEndExclusiveAt": "2026-09-19T14:30:00Z",
  "dayStatus": "active_partial",
  "daySpanFraction": 0.8958,
  "coverageRatio": 0.98,
  "timeSemanticsVersion": "elapsed-war-clock@1",
  "warTimeRevision": 1
}
```

Rules:

- all serialized instants use ISO-8601 UTC;
- `elapsedWarDay` is Chronicle's derived 1-based elapsed day;
- `dayOfWarRaw` is source diagnostic data only and SHOULD NOT appear on ordinary analytical surfaces;
- `daySpanFraction` describes the elapsed/existing portion of the 24-hour analytical day;
- `coverageRatio` describes observed source-data coverage and is not the same quantity;
- `dayEndExclusiveAt` is exclusive.

Avoid ambiguous public fields such as `day`, `warDay`, `timestamp`, `lastUpdated`, or floating `elapsedDays` without a precise schema definition.

### Day endpoint

`GET /api/v1/wars/{chronicleWarId}/days/{day}` MUST identify:

- requested elapsed day;
- effective interval;
- `dayStatus`;
- `daySpanFraction`;
- source coverage;
- time semantics version;
- war time revision;
- boundary-ambiguous change/delta counts where applicable.

A completed war ending exactly on a day boundary MUST NOT expose an empty following day.

### Day comparison

`partialMode=partial_as_is` returns the current partial interval and labels it partial.

`partialMode=like_for_like_fraction` compares eligible historical wars only over the same elapsed fraction of Day N. Sources that lack sufficient time resolution are excluded rather than interpolated.

## 5. Errors

Use ASP.NET Core 10 AddProblemDetails / IProblemDetailsService with RFC 7807/9457-compatible semantics.

Error payloads SHOULD include:

- type URI;
- title;
- status;
- detail;
- instance;
- stable `errorCode`;
- validation fields where relevant;
- trace/correlation ID.

## 6. Pagination

Large chronological collections MUST use cursor pagination.

Example:

`GET /api/v1/changes?after={cursor}&limit=100`

Do not use page-number pagination for continuously appended event/change streams.

## 7. Caching

ASP.NET Core Output Cache is the v1 server-response cache. The single-VPS baseline uses its in-process store; Redis is not required.

Historical immutable/completed-war resources SHOULD use long-lived public caching with ETags.

Current-war responses SHOULD use shorter Cache-Control and ETags.

The API SHOULD support `stale-while-revalidate` where behavior is appropriate.

Algorithm-versioned resources MAY have very long cache lifetime if the URL/version fully identifies immutable semantics.

War-relative historical cache keys MUST include or be invalidated by `warTimeRevision` when source time anchors are corrected.

Cache policy is endpoint-class specific. Current/freshness responses use short bounded caching; sealed historical resources may use long caching; expensive comparison/records responses use revision-aware keys/tags. Errors and streaming responses are not cached by default.

Output caching MUST NOT hide source/data freshness metadata: `dataAsOf` and `freshnessState` describe the underlying data, not the cache age.

## 8. Rate limiting

Public read API MUST have per-IP/consumer fair-use limits.

Limits SHOULD distinguish:

- ordinary page/API reads;
- large timeline queries;
- bulk CSV export;
- abusive repeated uncached queries.

Rate-limit responses MUST return `429` and retry metadata.

## 9. CORS

First-party browser traffic is same-origin through Caddy.

Public API MAY expose permissive GET CORS for documented read-only endpoints after abuse/cost review.

Mutation/admin endpoints MUST NOT share the same public CORS policy.

## 10. CSV

CSV endpoints SHOULD be explicit, for example:

- `GET /api/v1/wars/{chronicleWarId}/timeline.csv?... `
- `GET /api/v1/wars/{chronicleWarId}/days.csv`
- `GET /api/v1/objectives/{objective}/history.csv`
- `GET /api/v1/exports/{dataset}.csv`

Every CSV export MUST document:

- schema version;
- units;
- timestamps/time basis;
- source fields;
- derived fields;
- coverage fields;
- metric/model versions;
- identity resolution version for objective-derived datasets;
- identity coverage for objective-derived datasets.

Large bulk datasets MAY be prepared as immutable export artifacts with an export manifest.

For sealed wars, Parquet + ZSTD MAY be published as a bulk analytical projection alongside CSV where useful. Parquet is not the request-time source of truth and MUST identify archive revision, schema/version metadata, collection profile and content hash.

## 11. Public OpenAPI

- `GET /api/openapi/v1.json`
- `/api/docs` interactive/reference docs

The frontend TypeScript client SHOULD be generated from OpenAPI during CI.

Breaking API changes require a new major API version or explicit deprecation lifecycle.

## 12. Deprecation

Deprecated fields/endpoints SHOULD provide:

- deprecation notice;
- replacement;
- sunset date where possible;
- changelog entry.

No field may silently change units or semantics.

## 13. Shareable Insights

Share URLs are web routes, not opaque API query dumps.

Recommended canonical web routes:

- `/share/{shareId}`
- stable analytical page URLs with canonicalized query state.

Share snapshots SHOULD preserve model/metric versions when immutable semantics matter.

## 14. Source redistribution

The public API MUST follow DATA_LICENSING.md.

Default:

- expose Chronicle-normalized facts when allowed;
- expose Chronicle-derived analytics;
- include provenance;
- do not expose an unrestricted raw-upstream mirror.

## 15. Health endpoints

Internal:

- `/health/live`
- `/health/ready`

Public status:

- `/api/v1/status`

Readiness MUST consider database/API health; upstream War API outage alone SHOULD NOT make the public read API unready if cached data can be served.

## 16. Acceptance criteria

1. OpenAPI fully describes public v1.
2. Generated TS client builds in CI.
3. ETag revalidation works.
4. Cursor pagination is stable under appended changes.
5. Historical low-resolution data cannot masquerade as high-resolution output.
6. CSV and JSON expose the same metric semantics.
7. Rate limiting protects expensive analytics endpoints.
8. Objective History never serializes polling-bounded changes as exact event timestamps.
9. Objective-derived responses expose identity resolution version and identity coverage.
10. Old objective aliases remain resolvable after rename/merge.
11. War-relative responses expose `timeSemanticsVersion` and `warTimeRevision`.
12. Day endpoints use half-open elapsed-war intervals and never expose an empty day after an exact conquest-end boundary.
13. Partial Day-vs-Day comparison mode is explicit.
14. Boundary-ambiguous poll-derived changes are distinguishable from exact-single-bucket changes.
15. Observation-sensitive analytics expose `collectionProfileVersion` separately from output resolution.
16. Generic timeline resolution cannot claim finer granularity than the supporting collection/source evidence.
17. Sealed-war bulk artifacts expose archive revision and content hash.
18. Replay manifest/state/changes use the same canonical history as Timeline.
19. Replay state distinguishes confirmed observed, transition uncertain and no-coverage states.
20. Replay never emits a fabricated exact transition timestamp.
21. A direct replay-state query agrees with baseline+change reconstruction under documented semantics.
22. Current War exposes enough canonical identity to navigate into the same war Timeline/Replay workspace.
