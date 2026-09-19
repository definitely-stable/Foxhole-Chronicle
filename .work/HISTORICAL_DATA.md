# Foxhole Chronicle — Historical Data

Status: **Authoritative working specification**

Chronicle must support historical analysis without pretending that every historical war has Chronicle-native high-frequency data.

## 1. Source hierarchy

1. **Official War API** — primary current/future runtime source.
2. **FoxholeStats** — candidate community historical/bootstrap source.
3. **FoxholeHub** — candidate community historical/bootstrap source.
4. **Chronicle-derived** — normalized facts and analytical results computed from approved inputs.

Community historical sources MUST NOT override an official fact silently.

## 2. Coverage tiers

Every historical dataset MUST declare one of these resolution classes.

### Tier A — Chronicle high-frequency

Chronicle directly observed the source at the configured polling cadence.

Supports, subject to actual coverage:

- time-series casualties;
- objective observations;
- observed changes;
- Objective History;
- high-resolution region analytics;
- War Phases;
- Swing Analysis;
- War DNA;
- Similar Wars;
- Day vs Day.

### Tier B — imported time-series

A historical source provides a time series but not necessarily Chronicle's exact sampling semantics.

Supports only metrics compatible with the imported resolution.

Objective-level event reconstruction is allowed only when the source actually provides that history and identity can be reconciled.

### Tier C — daily aggregate

Supports:

- daily casualties;
- some Day vs Day comparisons;
- duration/pace;
- final/aggregate records;
- limited War DNA dimensions;
- limited Similar Wars feature vectors.

Does not support high-frequency swings or precise objective histories.

### Tier D — final aggregate

Supports:

- war start/end/duration where known;
- winner/result where known;
- final casualties;
- simple archive/records;
- limited completed-war comparisons.

Must not be used for phase/swing/objective-history claims.

### Tier U — unknown/insufficient

Visible as source metadata only; excluded from derived analytics requiring stronger coverage.

## 3. Coverage UX

Every page/API that mixes historical tiers MUST expose:

- source;
- resolution class;
- coverage ratio when measurable;
- first/last covered time;
- recorded-since note;
- missing-data warning.

A historical leaderboard MUST not rank a Tier D war against a Tier A metric that requires high-frequency observations.

## 4. Import manifests

Every import batch requires an immutable manifest:

- dataset key;
- source;
- source URLs;
- retrieval timestamp;
- file/content hashes;
- parser version;
- importer version;
- licensing-policy version;
- source schema description;
- coverage tier;
- row counts;
- warnings;
- known gaps.

## 5. Conflict resolution

When sources disagree:

- keep both source facts where feasible;
- record reconciliation status;
- prefer official source only where semantics actually overlap;
- do not rewrite historical community values to "match" a different source without evidence.

UI may expose "source discrepancy" for material differences.

## 6. Ruleset epochs

Cross-war analytics MUST recognize that mechanics, map layout and objective sets may change over time.

Chronicle uses versioned `ruleset_epochs` to define cohorts where documented game changes materially affect comparability.

A ruleset epoch MUST have evidence. It MUST NOT be guessed simply because a war looks statistically different.

## 7. Current historical candidates

### FoxholeStats

Intended use: controlled bootstrap for historical aggregate/time-series data if source-use review permits.

Runtime page requests MUST NOT scrape FoxholeStats.

### FoxholeHub

Intended use: controlled bootstrap if it provides useful historical datasets and source-use review permits.

Runtime page requests MUST NOT depend on FoxholeHub.

Exact current capability/coverage for both is **PENDING VERIFICATION** by the active research pass.

## 8. Backfill strategy

Historical imports should be additive:

1. ingest immutable source artifact/manifest;
2. parse into source-staging representation;
3. normalize into Chronicle identities;
4. compute coverage;
5. run reconciliation;
6. derive only metrics allowed for that tier;
7. publish after validation.

Backfill MUST be rerunnable and idempotent.

## 9. Historical corrections

A corrected import MUST create a new import revision/manifest.

Affected aggregates/models MUST be recomputed by input fingerprint.

Old analytical outputs MAY be retained for reproducibility but MUST not remain the default if superseded.

## 10. Historical feature availability

Feature availability is data-driven.

- **War DNA**: partial dimensions allowed; unavailable dimensions clearly shown.
- **Similar Wars**: requires minimum shared feature coverage.
- **Day vs Day**: daily or better data.
- **War Phases**: Tier A/B only unless a separately validated daily-resolution model exists.
- **Swing Analysis**: primarily Tier A; lower-resolution results require a distinct model/version.
- **Objective History**: only where objective-level history exists.
- **Records**: metric-specific tier policy.
- **Population Lab**: remains a separate historical module where compatible population/play-hour data legitimately exists.

## 11. Non-negotiable rule

Chronicle MUST prefer an honest "insufficient historical resolution" state over synthesizing a visually complete but unsupported timeline.
