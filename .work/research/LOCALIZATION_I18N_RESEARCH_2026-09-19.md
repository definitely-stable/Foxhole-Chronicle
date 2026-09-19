# Localization / i18n research synthesis — 2026-09-19

Status: **Research evidence for LOCALIZATION.md**

This note records the evidence used to define Chronicle's localization contract. LOCALIZATION.md is normative.

## Verified findings

### Next.js 16

Official App Router guidance recommends browser language preferences / Accept-Language for selecting a supported locale and redirecting into locale-aware routes.

Next.js 16 renamed Middleware to Proxy; proxy.ts is the request-boundary convention.

Sources:

- https://nextjs.org/docs/app/guides/internationalization
- https://nextjs.org/docs/app/guides/upgrading/version-16
- https://nextjs.org/docs/app/api-reference/file-conventions/proxy

### next-intl

Current behavior/capabilities:

- localePrefix = always is the default;
- locale detection priority is route prefix, cookie, Accept-Language, default;
- Accept-Language uses @formatjs/intl-localematcher best-fit matching;
- locale-cookie behavior is configurable;
- alternate/hreflang links derive from routing configuration;
- Server Components can keep messages/i18n runtime server-side;
- ICU messages cover interpolation, plural and select grammar.

Sources:

- https://next-intl.dev/docs/routing/configuration
- https://next-intl.dev/docs/routing/middleware
- https://next-intl.dev/docs/environments/server-client-components
- https://next-intl.dev/docs/usage/translations

### Locale identifiers

Unicode/CLDR uses BCP 47-style locale identifiers.

W3C explicitly recommends zh-Hans / zh-Hant when Simplified/Traditional Chinese distinction matters.

Chronicle launch identifiers are therefore:

- en
- ru
- zh-Hans
- fr
- pt-BR

Sources:

- https://cldr.unicode.org/index/cldr-spec/picking-the-right-language-code
- https://www.unicode.org/reports/tr35/
- https://www.w3.org/International/docs/bp-html-lang/

### Accept-Language

W3C treats Accept-Language as a useful first-contact signal but warns against using it as the sole permanent locale source. Users must be able to override inferred language.

Source:

- https://www.w3.org/International/questions/qa-accept-lang-locales.en.html

### Language navigation

W3C recommends language navigation using the target language's native name/script and warns against using country flags to identify languages.

Sources:

- https://www.w3.org/International/quicktips/
- https://www.w3.org/International/questions/qa-site-conneg.en.html

### SEO

Google requires each localized page version to reference itself and other available variants. x-default can identify a neutral language resolver.

Source:

- https://developers.google.com/search/docs/specialty/international/localized-versions

### ASP.NET Core 10

ASP.NET Core supports query/cookie/Accept-Language request-culture providers. Chronicle deliberately keeps the public data API locale-neutral; UI localization belongs to Next.js.

Sources:

- https://learn.microsoft.com/en-us/aspnet/core/fundamentals/localization?view=aspnetcore-10.0
- https://learn.microsoft.com/en-us/aspnet/core/fundamentals/localization/select-language-culture?view=aspnetcore-10.0

## Chronicle-specific decisions

These are architecture/product decisions derived from the evidence:

1. Always prefix public UI routes with locale.
2. Keep analytical route segments stable across languages in v1.
3. Keep /api/v1 locale-neutral.
4. Keep source/proper-noun values separate from localized presentation labels.
5. Guard explicit Traditional Chinese preferences from silently collapsing into zh-Hans.
6. Permit best-fit Portuguese fallback to pt-BR until pt-PT is supported.
7. Keep locale independent from timezone and canonical war-relative time.
8. Prefer server-first translations and avoid shipping full catalogs to Client Components.
