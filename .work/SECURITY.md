# Foxhole Chronicle — Security Baseline

Status: **Authoritative working specification**

Research baseline: **2026-09-19**

## 1. Threat model

Chronicle is public and read-heavy.

Primary risks:

- untrusted upstream/source text rendered in the web UI;
- ingestion SSRF/redirect abuse;
- public API resource exhaustion;
- malicious or oversized upstream payloads;
- secret/configuration leakage into Client Components;
- dependency/supply-chain compromise;
- database exposure;
- unsafe internal/operator endpoints added later.

## 2. Network boundaries

PostgreSQL MUST NOT be publicly exposed.

The raw payload store MUST NOT expose arbitrary filesystem paths or become a public file browser.

Worker source HTTP clients MUST use explicit allowed schemes/hosts and MUST validate redirects against the same source policy.

Source URLs MUST NOT be user-configurable through public API parameters.

## 3. Browser security

Chronicle MUST define a Content-Security-Policy and standard browser security headers.

Baseline headers include:

- Strict-Transport-Security at the public edge;
- Content-Security-Policy;
- X-Content-Type-Options: nosniff;
- Referrer-Policy;
- Permissions-Policy;
- frame-ancestors through CSP.

The policy SHOULD minimize third-party script/style origins.

## 4. CSP rendering tradeoff

Next.js nonce-based strict CSP may force request-time/dynamic rendering for pages that otherwise benefit from static/cache rendering.

Chronicle is a public analytical site with a strong cache/static requirement, so nonce CSP is not an automatic v1 choice.

v1 SHOULD use a reviewed static CSP compatible with production output and introduce stricter changes through report-only observation when useful.

Next.js experimental webpack-only SRI is NOT a production architecture dependency.

If requirements later demand nonce-based strict CSP, the impact on Cache Components, prerendering and CDN/self-hosted caching MUST be re-evaluated.

## 5. Server/client boundary

Next.js modules containing secrets, internal service URLs or privileged server logic SHOULD import server-only.

Only intentionally public environment variables may use NEXT_PUBLIC_.

Experimental React taint APIs MUST NOT be treated as a production security boundary.

The actual boundary remains:

- server-only modules;
- explicit DTO/view-model shaping;
- framework Server/Client Component serialization constraints;
- no secrets in client bundles.

## 6. API abuse protection

ASP.NET Core built-in Rate Limiting and Request Timeouts are the baseline.

Policies MUST be endpoint-aware.

Examples:

- cheap cached reads may allow higher rates;
- expensive compare/large timeline/export endpoints need stricter concurrency/rate limits;
- streaming endpoints, if introduced, use separate timeout/rate semantics.

Avoid unbounded rate-limit partition creation from attacker-controlled arbitrary keys.

Anonymous rate limiting MUST be load-tested before production thresholds are fixed.

## 7. Request/input limits

Chronicle SHOULD set explicit limits for:

- query-string length;
- page sizes;
- compare-war count;
- timeline range/resolution combinations;
- response/export size where appropriate;
- upstream response body size;
- decompression limits.

The application MUST reject unsupported combinations rather than allocate unbounded work.

## 8. Errors

Public errors use ProblemDetails with stable errorCode.

Production error responses MUST NOT disclose:

- stack traces;
- connection strings;
- SQL text with sensitive values;
- filesystem paths;
- secrets;
- internal hostnames unless intentionally public.

Trace/correlation IDs may be returned for support correlation.

## 9. Database credentials

API and Worker SHOULD use separate PostgreSQL roles where practical.

Roles SHOULD have only the permissions required for their responsibilities.

Migrations SHOULD NOT require the runtime API identity to retain schema-owner privileges forever.

Connection strings/secrets are supplied through deployment secret configuration, not committed files.

## 10. Operator plane

Future internal mutation/operator endpoints MUST be separated from /api/v1.

Before operator mutations are enabled, Chronicle MUST define:

- authentication;
- authorization/roles;
- audit log;
- CSRF model where browser cookies are used;
- explicit mutation idempotency;
- manual merge/split/quarantine safety.

This requirement does not block the initial public read-only vertical slice.

## 11. Dependency discipline

Chronicle SHOULD keep client dependencies small and review large browser additions for bundle impact.

Do not add duplicate framework layers merely for fashion.

Use lockfiles and centrally managed NuGet versions.

Security patching follows supported major lines defined in PLATFORM_DEPENDENCIES.md.

## 12. Containers/runtime

Containers SHOULD:

- run non-root where practical;
- use read-only root filesystems where practical;
- mount only required writable paths;
- avoid Docker socket access;
- expose only required ports.

Caddy is the only public ingress in the baseline topology.

## 13. Logging/telemetry privacy

Do not log raw Authorization/Cookie values.

Do not attach entire upstream payloads to traces.

Do not use arbitrary user/query strings as unbounded metric labels.

Raw replay evidence belongs in the raw payload store, not logs.

## 14. Evidence

Relevant current guidance:

- https://nextjs.org/docs/app/guides/production-checklist
- https://nextjs.org/docs/15/app/guides/content-security-policy
- https://nextjs.org/docs/app/guides/data-security
- https://nextjs.org/docs/app/api-reference/config/next-config-js/headers
- https://learn.microsoft.com/en-us/aspnet/core/performance/rate-limit?view=aspnetcore-10.0
- https://learn.microsoft.com/en-us/aspnet/core/performance/timeouts?view=aspnetcore-10.0
- https://learn.microsoft.com/en-us/aspnet/core/fundamentals/error-handling-api?view=aspnetcore-10.0
