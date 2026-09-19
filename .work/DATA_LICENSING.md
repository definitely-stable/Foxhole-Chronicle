# Foxhole Chronicle — Data Licensing and Source-Use Policy

Status: **Authoritative working policy**

This document defines whether Chronicle may ingest, retain, transform and redistribute data from external sources.

It is an engineering policy, not legal advice. Where permission cannot be verified, Chronicle MUST take the conservative path.

## 1. Source classes

### Official Foxhole / War API

Role: primary source for current/future public war state.

Required before production:

- verify current official documentation/repository;
- record any license/terms applicable to the API/data;
- record fan-content/branding rules relevant to site presentation;
- record attribution requirements;
- record any restrictions on redistribution/cache retention.

### FoxholeStats

Role: candidate historical bootstrap source only.

Default policy: **no automated scraping/import until terms/robots/source-use permission are reviewed and recorded**.

Public accessibility does not equal permission to scrape or redistribute.

### FoxholeHub

Role: candidate historical bootstrap source only.

Default policy is the same: disabled until source-use review is complete.

## 2. Runtime dependency rule

Chronicle MUST remain operational for current-war collection without FoxholeStats or FoxholeHub.

Historical sources MAY enrich the archive, but page rendering MUST read Chronicle-owned normalized data after an approved import.

## 3. Source decision record

Each external source requires a `source_policy` record with:

- source key;
- reviewed URLs/documents;
- review date;
- robots result;
- terms/ToS result;
- license result;
- attribution requirement;
- automated access decision;
- storage decision;
- transformation decision;
- redistribution decision;
- raw-payload redistribution decision;
- reviewer notes;
- policy version.

Possible decisions:

- `allowed`
- `allowed_with_conditions`
- `manual_import_only`
- `metadata_only`
- `not_allowed`
- `unknown_blocked`

Unknown MUST behave as blocked for automated historical extraction.

## 4. Robots.txt

robots.txt is an automated crawling signal, not a complete license.

Chronicle MUST:

- retrieve and archive the relevant robots.txt during source review;
- obey explicit crawl disallow rules for automated collectors;
- still review terms/license even when robots permits crawling.

A permissive robots file MUST NOT be recorded as data redistribution permission.

## 5. Terms and attribution

If a source requires attribution, Chronicle MUST display it:

- in DATA/SOURCES documentation;
- in API provenance;
- in bulk export manifests where imported data contributes;
- optionally in page-level source details when material.

Attribution MUST identify the actual source without implying endorsement or affiliation.

Chronicle SHOULD carry a clear "unofficial / not affiliated" notice if required by applicable fan-content/branding rules.

## 6. Historical bootstrap artifacts

Approved imports MUST have immutable manifests containing:

- source URL;
- retrieval timestamp;
- SHA-256;
- parser/importer version;
- policy version;
- source classification;
- coverage/resolution;
- known caveats.

If retaining the raw artifact is not permitted, Chronicle MUST retain only the allowed metadata/hash and normalized facts permitted by the source policy.

## 7. Public Data API redistribution

The Chronicle API SHOULD expose:

- Chronicle-normalized official-source facts where redistribution is permitted;
- Chronicle-derived metrics/results;
- provenance and coverage;
- source attribution.

It MUST NOT automatically mirror complete raw upstream payloads unless the source policy explicitly permits redistribution.

Historical community-source rows MUST carry source policy/provenance, and bulk redistribution MUST be disabled when rights are unclear.

## 8. Derived data

A derived value does not erase source obligations.

Every exported derived dataset MUST retain enough metadata to identify:

- input source classes;
- algorithm/model version;
- generation time;
- coverage;
- Chronicle terms/license for Chronicle-authored transformations.

Chronicle MUST NOT claim ownership over upstream facts merely because they were normalized.

## 9. Cache and raw retention

Raw retention is a separate permission from temporary HTTP caching.

Where source terms are unclear, Chronicle SHOULD minimize retained raw historical community content while keeping legally/technically necessary provenance hashes and Chronicle-normalized data only if permitted.

## 10. Deletion/takedown process

Chronicle SHOULD support source-specific removal:

1. identify all imports/manifests from the source;
2. disable further collection;
3. remove or quarantine raw artifacts as required;
4. remove/recompute derived outputs if continued use is not permitted;
5. preserve internal audit records only where legally permissible;
6. invalidate public exports/caches.

The data model MUST therefore retain source lineage at every import stage.

## 11. Branding and screenshots

Shareable Insight cards and pages MUST NOT use official logos/assets in a manner that implies affiliation.

Any game imagery, icons or trademarks used in the site MUST be reviewed under applicable fan-content/asset terms separately from data licensing.

## 12. Required decisions before backend historical importer

Before implementing FoxholeStats or FoxholeHub automated import, DATA_LICENSING.md MUST be updated with verified findings for each:

- robots URL and result;
- ToS/terms URL and relevant clauses;
- license or explicit permission if any;
- attribution;
- automated request policy;
- local storage;
- derived use;
- public redistribution.

If one of these remains unknown and materially affects permission, the automated importer MUST remain disabled.

## 13. Current working decisions

- Official War API: **primary runtime source; exact current terms PENDING VERIFICATION**.
- FoxholeStats: **historical candidate; automated import BLOCKED pending verification**.
- FoxholeHub: **historical candidate; automated import BLOCKED pending verification**.
- Chronicle-derived metrics: may be publicly exposed subject to upstream source obligations.
- Raw upstream payload mirror: **disabled by default**.
