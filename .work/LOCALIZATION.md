# Foxhole Chronicle — Localization and Locale Routing

Status: **Authoritative working specification**

Research baseline: **2026-09-19**

This document defines Chronicle's UI localization, locale routing, language negotiation, formatting, SEO, accessibility, translation storage and the boundary between localized presentation and canonical data.

Normative terms **MUST**, **SHOULD**, and **MAY** follow RFC 2119 semantics.

## 1. Goals

Localization MUST:

- give every public UI page an explicit, stable language identity;
- preserve deterministic shareable and cache-safe URLs;
- auto-select a reasonable first language without overriding explicit user choice;
- keep canonical source data, metrics, provenance and the public API language-neutral;
- support real plural/grammar rules instead of translated string concatenation;
- work correctly with SSR/RSC, static rendering, SEO and accessibility;
- keep language independent from GeoIP, nationality, faction and timezone.

Localization is a presentation concern. It MUST NOT change historical truth.

## 2. Launch locales

Minimum launch locales:

| Locale | Variant | Native selector label |
|---|---|---|
| en | English | English |
| ru | Russian | Русский |
| zh-Hans | Simplified Chinese | 简体中文 |
| fr | French | Français |
| pt-BR | Brazilian Portuguese | Português (Brasil) |

Default/fallback locale: **en**.

Locale identifiers MUST use BCP 47 / Unicode locale identifier conventions with hyphen separators.

### 2.1 Simplified Chinese

Chronicle supports the Simplified Chinese writing system, not a China-only regional edition. Therefore **zh-Hans** is canonical rather than zh, cn or zh-CN.

Traditional Chinese is a distinct future locale: **zh-Hant**.

### 2.2 Brazilian Portuguese

Brazilian Portuguese MUST use **pt-BR**. Public routes/HTML MUST NOT use br, ptbr or pt_BR.

Likely future locales are pt-PT and zh-Hant, but neither is required for launch.

## 3. Locale-prefixed routing

All localized UI routes MUST use an explicit locale prefix:

~~~text
/en/
/ru/
/zh-Hans/
/fr/
/pt-BR/

/en/current/live-1
/ru/current/live-1
/zh-Hans/current/live-1
/fr/current/live-1
/pt-BR/current/live-1

/en/war/{chronicleWarId}
/ru/war/{chronicleWarId}/replay
/fr/war/{chronicleWarId}?at=2026-09-17T18%3A30%3A00Z
~~~

Chronicle uses next-intl localePrefix = always.

The bare root / is a locale resolver, not a duplicate English home page.

Unprefixed UI routes SHOULD redirect to their locale-prefixed equivalent. The redirect is user-dependent and SHOULD NOT be a permanent redirect.

Once a supported locale is present in the URL, the URL is authoritative. /fr/... MUST render French regardless of cookie or Accept-Language.

### 3.1 Path segment policy

v1 keeps technical route segments stable across languages:

~~~text
/en/archive
/fr/archive
/ru/current/live-1
/zh-Hans/war/{chronicleWarId}/replay
~~~

v1 MUST NOT maintain translated route dictionaries for analytical routes.

This intentionally prioritizes durable analytical permalinks, simpler cache identity and lower routing complexity. Localized editorial/marketing pathnames MAY be reconsidered later.

## 4. Locale negotiation

For a request without an explicit supported locale prefix, locale priority is:

1. explicit locale in the URL;
2. supported remembered locale preference;
3. browser Accept-Language;
4. en.

An explicit URL selection always wins.

Accept-Language is a first-contact hint, not permanent profile truth. The user MUST be able to switch language from every normal public page.

Chronicle MUST NOT use GeoIP, IP country, browser timezone, account country or faction to infer UI language.

### 4.1 General matching

General matching SHOULD use next-intl / @formatjs/intl-localematcher best-fit semantics.

Examples:

~~~text
ru-RU,ru;q=0.9,en;q=0.8 -> ru
fr-CA,fr;q=0.9,en;q=0.8 -> fr
pt-BR,pt;q=0.9,en;q=0.8 -> pt-BR
pt -> pt-BR
~~~

For v1, pt-PT MAY resolve to pt-BR through best-fit matching because pt-BR is the only Portuguese variant. The selector MUST still identify the rendered locale as Português (Brasil).

### 4.2 Chinese script guard

Chronicle MUST NOT silently collapse an explicit Traditional Chinese preference into Simplified Chinese.

Eligible for zh-Hans:

~~~text
zh-Hans
zh-CN
zh-SG
~~~

Traditional Chinese signals:

~~~text
zh-Hant
zh-TW
zh-HK
zh-MO
~~~

Until zh-Hant exists, these Traditional Chinese signals MUST NOT be force-mapped to zh-Hans. Negotiation continues to the next acceptable supported language and finally en.

This is a Chronicle product rule layered over generic best-fit matching.

## 5. Remembered preference

The language selector MUST navigate to the locale-prefixed version of the current page and preserve entity/path/query state where possible.

Chronicle SHOULD use next-intl locale-cookie behavior with a project-owned cookie such as:

~~~text
CHRONICLE_LOCALE
~~~

Recommended properties:

- SameSite=Lax;
- Secure in production;
- site-wide path;
- non-HttpOnly because it is non-sensitive presentation preference state;
- bounded long-lived retention for an explicit preference.

If authenticated preferences are introduced later, a saved profile locale MAY supersede the cookie for unprefixed entry. The explicit locale in the current URL still wins.

## 6. Web implementation

Baseline:

- Next.js 16 App Router;
- React Server Components by default;
- next-intl for messages/routing/formatting integration;
- proxy.ts for request-boundary locale resolution;
- Intl / CLDR for locale-aware formatting.

Suggested layout:

~~~text
apps/web/
  src/
    app/
      [locale]/
        layout.tsx
        page.tsx
        war/
        regions/
        compare/
        records/
        archive/
    i18n/
      routing.ts
      request.ts
      navigation.ts
      locale-matching.ts
    messages/
      en/
      ru/
      zh-Hans/
      fr/
      pt-BR/
~~~

Routing contract:

~~~ts
export const locales = ['en', 'ru', 'zh-Hans', 'fr', 'pt-BR'] as const;

export const routing = defineRouting({
  locales,
  defaultLocale: 'en',
  localePrefix: 'always'
});
~~~

The exact proxy implementation MAY wrap next-intl matching to enforce the Chinese script guard.

## 7. Server-first localization

Chronicle SHOULD localize in Server Components whenever client interactivity does not require direct message lookup.

Preferred flow:

~~~text
Server Component
  -> getTranslations/useTranslations
  -> localized HTML or localized props
  -> Client Component only when needed
~~~

The full translation catalog MUST NOT be shipped to Client Components by default.

Client Components SHOULD receive already localized labels when that avoids sending unnecessary message namespaces/browser runtime.

## 8. Message model

Message identifiers MUST be semantic/stable keys, not English source sentences.

Recommended namespaces:

~~~text
Common.*
Navigation.*
War.*
Timeline.*
Regions.*
Compare.*
Records.*
Archive.*
Coverage.*
Sources.*
Errors.*
Accessibility.*
~~~

Messages MUST use ICU message syntax for interpolation, pluralization, select logic and language-specific grammar.

Application code MUST NOT construct sentences by concatenating translated fragments.

Bad:

~~~text
day + value + ofWar
~~~

Good:

~~~text
War.day = Day {day}
~~~

## 9. Translation storage

Translation files SHOULD be split by stable namespace:

~~~text
messages/
  en/
    common.json
    navigation.json
    war.json
    timeline.json
    archive.json
    analytics.json
    errors.json
    accessibility.json
  ru/
  zh-Hans/
  fr/
  pt-BR/
~~~

English defines the source key set, but English prose itself is not the key.

All five launch locales SHOULD have complete translations for a released feature.

A runtime English fallback MAY prevent a broken UI, but a substantially mixed-language page MUST NOT be advertised/indexed as a complete localized version.

Missing translations MUST be observable.

## 10. Domain terminology and glossary

Chronicle MUST maintain a localization glossary separating:

1. Chronicle UI terms;
2. Chronicle analytical terms;
3. official Foxhole proper nouns/source labels;
4. invariant machine identifiers.

Source identifiers/canonical raw values MUST NOT be translated during ingestion or persistence.

Examples of invariant values:

~~~text
live-1
warStatus = active
qualityClass = degraded
faction = colonials
Chronicle UUIDs
metric/model version IDs
source map identifiers
~~~

The presentation layer may map stable tokens to localized labels.

Foxhole place names, faction names and proper nouns SHOULD remain source-faithful unless Chronicle maintains an explicit reviewed localized display-name catalog. A translated label MUST never replace the canonical source value.

## 11. Public API boundary

The public API is locale-neutral.

The /api/v1/* namespace MUST NOT be nested under /{locale}.

Core API representations MUST NOT vary by:

- locale-prefixed UI route;
- locale cookie;
- Accept-Language.

Example canonical response:

~~~json
{
  "warStatus": "active",
  "qualityClass": "degraded",
  "faction": "colonials",
  "capturedAt": "2026-09-19T15:30:00Z"
}
~~~

API enum tokens, JSON field names, OpenAPI identifiers and CSV column identifiers remain stable across UI languages.

Human-facing API documentation MAY have localized presentation pages, but the machine contract remains invariant.

## 12. Numbers, dates, time and units

Locale controls presentation formatting only.

Use standard Intl facilities where applicable:

- Intl.NumberFormat;
- Intl.DateTimeFormat;
- Intl.RelativeTimeFormat;
- Intl.ListFormat;
- Intl.DisplayNames.

Backend/API timestamps remain ISO-8601 UTC values.

Chronicle elapsed-war time/day/bucket semantics remain defined by TIME_SEMANTICS.md and MUST NOT change by locale or timezone.

Locale and timezone are independent. User-local wall-clock rendering MUST remain presentation-only.

## 13. HTML language and accessibility

Every localized document MUST set the resolved BCP 47 language on the html element.

Content in another natural language SHOULD use nested lang attributes where useful for accessibility/text processing.

Localized UI includes localized:

- accessible names;
- form labels;
- chart/image alternative text where applicable;
- validation messages;
- empty states;
- navigation labels;
- screen-reader-only context.

The language selector MUST be keyboard accessible.

Country flags MUST NOT represent languages.

The selector SHOULD use native names/scripts:

~~~text
English
Русский
简体中文
Français
Português (Brasil)
~~~

## 14. Layout and typography

UI components MUST tolerate translation expansion without clipping/fixed-width text assumptions.

Test coverage SHOULD include:

- longer French/Russian labels;
- plural forms;
- CJK line breaking and glyph coverage;
- dense tables/charts;
- narrow responsive layouts.

Typography MUST provide Simplified Chinese glyph coverage. Chronicle MUST NOT rely on a Latin-only display font for Han text.

CJK font delivery SHOULD be measured separately; a large CJK webfont SHOULD NOT be forced onto all locales without evidence.

Charts MUST localize visible labels/tooltips/legends while keeping metric IDs stable.

## 15. SEO

Every indexable localized page SHOULD have a unique locale-prefixed URL.

Each translated version MUST expose reciprocal alternates for itself and every actually available sibling locale.

For a fully translated page:

~~~text
en
ru
zh-Hans
fr
pt-BR
x-default
~~~

x-default SHOULD point to the neutral resolver/root where appropriate.

Canonical URLs SHOULD be self-canonical per localized page. Translated pages MUST NOT all canonicalize to English.

A locale without actual translated content MUST NOT be advertised as a false hreflang alternate.

Chronicle SHOULD use one consistent alternate-link mapping derived from routing configuration and sitemap generation.

## 16. Caching

The locale prefix is part of UI cache identity.

Once on /{locale}/..., content MUST NOT vary by Accept-Language.

~~~text
/en/war/...      -> English representation
/ru/war/...      -> Russian representation
/zh-Hans/war/... -> Simplified Chinese representation
~~~

Only the bare/unprefixed locale resolver may vary its redirect based on remembered preference and Accept-Language.

API caches remain independent from UI locale because API representations are locale-neutral.

## 17. Fallback/failure behavior

Unsupported explicit locale prefixes MUST fail or redirect predictably according to routing rules; they MUST NOT silently masquerade as a different locale under the same URL.

If message loading fails:

- production MAY fall back to English for resilience;
- the failure MUST be observable;
- canonical data remains unaffected;
- SEO metadata MUST NOT falsely claim translation completeness.

## 18. Tests

Implementation SHOULD cover:

- URL locale beats cookie/header;
- remembered preference beats Accept-Language on unprefixed entry;
- unsupported language falls back to en;
- fr-CA -> fr;
- ru-RU -> ru;
- pt-BR -> pt-BR;
- generic pt -> pt-BR;
- explicit Traditional Chinese is not force-mapped to zh-Hans;
- locale switch preserves current entity/path/query state;
- html lang matches route locale;
- released namespace key parity across all five launch locales;
- ICU plural/select edge cases;
- canonical/hreflang alternates;
- public API representation remains locale-neutral;
- locale-prefixed page caches do not vary on Accept-Language.

## 19. Explicit non-goals

v1 does not require:

- GeoIP language routing;
- locale-specific domains;
- translated analytical route segments;
- localized public API payloads;
- request-time machine translation;
- Traditional Chinese;
- Portuguese (Portugal).

## 20. Evidence baseline

Verified against current official/project documentation:

- Next.js 16 App Router i18n:
  https://nextjs.org/docs/app/guides/internationalization
- Next.js 16 Proxy:
  https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- next-intl routing configuration:
  https://next-intl.dev/docs/routing/configuration
- next-intl locale detection / best-fit:
  https://next-intl.dev/docs/routing/middleware
- next-intl Server/Client Components:
  https://next-intl.dev/docs/environments/server-client-components
- next-intl ICU messages:
  https://next-intl.dev/docs/usage/translations
- Unicode/CLDR language identifiers:
  https://cldr.unicode.org/index/cldr-spec/picking-the-right-language-code
- Unicode LDML:
  https://www.unicode.org/reports/tr35/
- W3C Accept-Language guidance:
  https://www.w3.org/International/questions/qa-accept-lang-locales.en.html
- W3C language declaration / zh-Hans and zh-Hant:
  https://www.w3.org/International/docs/bp-html-lang/
- W3C multilingual navigation:
  https://www.w3.org/International/quicktips/
- Google localized pages / hreflang:
  https://developers.google.com/search/docs/specialty/international/localized-versions
- ASP.NET Core 10 localization model:
  https://learn.microsoft.com/en-us/aspnet/core/fundamentals/localization?view=aspnetcore-10.0
