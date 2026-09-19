# Foxhole Chronicle — Public Data API

Status: **Authoritative working specification**

Chronicle is both a website and a public normalized-data provider.

Base path:

`/api/v1`

OpenAPI is the canonical contract.

## 1. Principles

The API MUST:

- expose normalized Chronicle entities and derived analytics;
- preserve source/provenance/coverage;
- use stable identifiers;
- support conditional caching;
- provide machine-readable errors;
- avoid mirroring raw upstream payloads by default;
- be usable without a user account for public read operations.

## 2. Core endpoints

### Current

- `GET /api/v1/current`
- `GET /api/v1/status`
- `GET /api/v1/sources`

### Wars

- `GET /api/v1/wars`
- `GET /api/v1/wars/{war}`
- `GET /api/v1/wars/{war}/timeline`
- `GET /api/v1/wars/{war}/days/{day}` — `{day}` is Chronicle 1-based elapsed war day
- `GET /api/v1/wars/{war}/regions`
- `GET /api/v1/wars/{war}/regions/{region}`
- `GET /api/v1/wars/{war}/dna`
- `GET /api/v1/wars/{war}/similar`
- `GET /api/v1/wars/{war}/phases`
- `GET /api/v1/wars/{war}/swings`

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

`GET /api/v1/wars/140/timeline?metric=casualties&from=...&to=...&resolution=auto`

Supported resolution contract:

- `auto`
- `5m`
- `1h`
- `1d`

A requested resolution MAY be rejected/downgraded if historical source coverage cannot support it. The response MUST state effective resolution.

## 4. Envelope metadata

Analytical responses SHOULD include:

```json
{
  "data": {},
  "meta": {
    "dataAsOf": "2026-09-19T12:00:00Z",
    "freshnessState": "fresh",
    "resolution": "5m",
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

`GET /api/v1/wars/{war}/days/{day}` MUST identify:

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

Use ASP.NET Core ProblemDetails compatible with RFC 7807/9457 semantics.

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

Historical immutable/completed-war resources SHOULD use long-lived public caching with ETags.

Current-war responses SHOULD use shorter Cache-Control and ETags.

The API SHOULD support `stale-while-revalidate` where behavior is appropriate.

Algorithm-versioned resources MAY have very long cache lifetime if the URL/version fully identifies immutable semantics.

War-relative historical cache keys MUST include or be invalidated by `warTimeRevision` when source time anchors are corrected.

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

- `GET /api/v1/wars/{war}/timeline.csv?... `
- `GET /api/v1/wars/{war}/days.csv`
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
