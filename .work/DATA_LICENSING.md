# Foxhole Chronicle — Data Licensing and Source-Use Policy

Status: **Authoritative working policy**

This document defines whether Chronicle may ingest, retain, transform and redistribute data from external sources.

It is an engineering policy, not legal advice. Where permission cannot be verified, Chronicle MUST take the conservative path.

## 1. Source classes

### Official Foxhole / War API

Role: primary source for current/future public war state.

The official `clapfoot/warapi` repository contains a `LICENSE.md` using **Creative Commons Attribution-NonCommercial 4.0 International**.

Important limitation: the repository does not clearly state in its README that this repository license is the complete redistribution license for all live API payload/database contents. Chronicle MUST therefore distinguish:

- using the public API as an input to Chronicle analytics;
- storing source payloads for internal reproducibility;
- redistributing raw/substantial upstream payload data through Chronicle's Public API/CSV;
- publishing Chronicle-derived facts/aggregates.

Raw/substantial upstream redistribution MUST remain conservative until the applicable Foxhole/Siege Camp source-use terms are explicitly reviewed.

Source semantics: [WAR_API_SEMANTICS.md](./WAR_API_SEMANTICS.md).

### FoxholeStats

Role: candidate historical bootstrap source only.

### FoxholeHub

Role: candidate historical bootstrap source only.

Default policy is the same: disabled until source-use review is complete.

## 2. Runtime dependency rule

Chronicle MUST remain operational for current-war collection without FoxholeStats or FoxholeHub.

Historical sources MAY enrich the archive, but page rendering MUST read Chronicle-owned normalized data after an approved import.

## 3. Public API / CSV rule

Until a source-use decision explicitly permits broader redistribution:

- Chronicle MAY expose Chronicle-authored derived metrics, provenance metadata and normalized analytical results where lawful;
- Chronicle MUST NOT provide a bulk mirror of raw War API responses;
- Chronicle MUST NOT imply that public accessibility alone grants unrestricted redistribution rights;
- export manifests MUST record source-policy version and license/attribution notice.

A later decision to expose raw or near-raw upstream datasets requires an ADR/source-use review.
