# Foxhole Chronicle — .work

This directory contains the authoritative working specifications for Foxhole Chronicle.

The documents are written for both human developers and AI coding agents. They are expected to evolve through reviewed design decisions and source verification, not through undocumented implementation drift.

## Authority order

1. `ARCHITECTURE.md`
2. the domain-specific specification for the topic
3. accepted ADRs in `adr/`
4. research/review material under `research/`, `reviews/`, `RESEARCH_BRIEF.md`, and `REVIEW_SYNTHESIS.md`

For official Foxhole source semantics, `WAR_API_SEMANTICS.md` is the authoritative source contract. Domain documents MUST NOT strengthen an upstream guarantee beyond it.

Research/review files are evidence and critique, not authoritative architecture by themselves.

## Product direction

Foxhole Chronicle is a public historical observatory for World Conquest, not a tactical live-map replacement and not a general-purpose Foxhole tool hub.

The product is organized around one temporal war-history model and three primary experiences:

1. **Current War** — a concise, beautiful view of the current war now;
2. **War Timeline** — the central product: the whole war through time;
3. **War Replay** — move backward/forward through Chronicle's observed historical map/objective state.

Supporting surfaces such as Archive, Regions and Sources/Coverage exist to deepen those three core experiences.

Compare, Records, Daily Chronicle, Objective History, War DNA, Similar Wars, War Phases, Swing Analysis and other analytical modules are P1/P2 depth and MUST NOT delay the P0 core.

See:

- `CORE_WAR_EXPERIENCE.md`
- `PRODUCT_SCOPE.md`

## Authoritative structure

~~~text
.work/
├── ARCHITECTURE.md
├── CORE_WAR_EXPERIENCE.md
├── PRODUCT_SCOPE.md
├── WAR_API_SEMANTICS.md
├── TIME_SEMANTICS.md
├── DATA_MODEL.md
├── INGESTION.md
├── DATA_LIFECYCLE.md
├── IDEMPOTENCY_RECOVERY.md
├── HISTORICAL_DATA.md
├── METRICS.md
├── ANALYTICS.md
├── OBJECTIVE_IDENTITY.md
├── PUBLIC_API.md
├── LOCALIZATION.md
├── WEB_RUNTIME.md
├── PLATFORM_DEPENDENCIES.md
├── OBSERVABILITY.md
├── SECURITY.md
├── TESTING.md
├── DATA_LICENSING.md
└── adr/
~~~

Supporting research material includes:

~~~text
.work/
├── RESEARCH_BRIEF.md
├── REVIEW_SYNTHESIS.md
├── research/
│   ├── OBJECTIVE_IDENTITY_RESEARCH_2026-09-19.md
│   ├── TIME_SEMANTICS_RESEARCH_2026-09-19.md
│   ├── COLLECTION_CADENCE_STORAGE_ANALYSIS_2026-09-19.md
│   ├── DATA_LIFECYCLE_ARCHIVAL_RESEARCH_2026-09-19.md
│   ├── LOCALIZATION_I18N_RESEARCH_2026-09-19.md
│   └── PLATFORM_DEPENDENCY_RESEARCH_2026-09-19.md
└── reviews/
~~~

## Existing pre-backend architecture gate

The repository already defines a pre-backend consistency gate in `ARCHITECTURE.md`.

The most important source/data-semantics documents before encoding irreversible backend assumptions remain:

~~~text
WAR_API_SEMANTICS.md
TIME_SEMANTICS.md
DATA_MODEL.md
INGESTION.md
DATA_LIFECYCLE.md
IDEMPOTENCY_RECOVERY.md
OBJECTIVE_IDENTITY.md
METRICS.md
DATA_LICENSING.md
~~~

This index does not add a new documentation CI/gate policy.

## Core product implementation order

The P0 vertical path is intentionally product-first:

~~~text
War API
  -> durable source observations
  -> current war identity/state
  -> Timeline foundation
  -> objective historical state
  -> Replay projection
  -> unified Current War / Timeline / Replay web experience
~~~

Do not implement Compare/Records/DNA/Phases first and postpone the product's central Timeline/Replay experience.

See `CORE_WAR_EXPERIENCE.md` for the detailed sequence and acceptance criteria.

## Documentation rules

Specifications use RFC 2119 terminology: **MUST**, **SHOULD**, **MAY**.

Material statements SHOULD be classified where useful as:

- **VERIFIED FACT** — verified against a cited primary/official source.
- **OBSERVED/SECONDARY** — observed or supported by a secondary source but not an official guarantee.
- **DESIGN DECISION** — chosen architecture/product decision.
- **ASSUMPTION** — assumption requiring validation.
- **ESTIMATE** — sizing/capacity estimate, not an observed fact.
- **PENDING VERIFICATION** — implementation must not assume the claim until source verification resolves it.

For Foxhole data semantics, current official Siege Camp/Foxhole documentation and the official War API repository are the primary source of truth.

Community historical sources MUST NOT silently override official semantics or become runtime hard dependencies.

## Data honesty rules

Chronicle preserves the semantic chain:

`source -> fetch -> raw durable evidence -> observation -> normalized fact -> observed change -> derived metric -> analytical model/result -> share/export`

Chronicle MUST NOT:

- invent exact event times from polling;
- equate raw `dayOfWar`, UTC calendar day and Chronicle elapsed war day;
- create an empty following day when conquest ends exactly on a 24-hour elapsed boundary;
- allocate boundary-crossing poll uncertainty to a fake exact day;
- hide historical resolution gaps;
- silently redefine metrics;
- merge uncertain objective identities by guess;
- claim causal explanations from correlation;
- expose upstream raw data contrary to source policy;
- sum map-scoped enlistments and call them globally unique players;
- treat a dynamic map disappearance as a proven destruction event;
- treat map `lastUpdated` as an item-level event timestamp;
- show Replay as omniscient exact history when Chronicle only has bounded observations.

Replay therefore distinguishes confirmed observed state, transition uncertainty and insufficient coverage.

## Current architecture status

### Source and identity semantics

The War API source-semantics contract is materialized in `WAR_API_SEMANTICS.md`.

Objective identity research is integrated into `OBJECTIVE_IDENTITY.md`, `DATA_MODEL.md`, `INGESTION.md`, `METRICS.md`, `ANALYTICS.md` and `PUBLIC_API.md`. Production matcher thresholds remain intentionally uncommitted until calibration against a labeled real-payload corpus.

### Time semantics

Canonical time semantics are defined in `TIME_SEMANTICS.md`.

Version:

`elapsed-war-clock@1`

Timeline/Replay share an absolute UTC `at` inspection cursor; elapsed Day/time is derived from the currently accepted war-time anchors.

### Collection and storage

Collection profile `chronicle-collection-v1`:

- war — 5m;
- warReport — 15m/map;
- dynamic/public — 15m/map;
- maps — 60m;
- static — once per war/map.

PostgreSQL stores sparse semantic history rather than duplicating every unchanged item occurrence. Exact raw evidence uses hybrid inline + Zstd-compressed CAS storage.

### Durability / execution correctness

Logical ingestion job ownership and endpoint mutation ownership are separate:

- `ingestion_jobs.lease_generation` protects logical job ownership;
- `endpoint_poll_state.fence_token` independently fences stale endpoint mutators.

Received 200-response evidence crosses the raw-durable boundary before canonical reconciliation. Unknown COMMIT outcomes are reconciled by stable logical identities rather than blindly replayed as new operations.

### Platform baseline

The implementation baseline now includes:

- Next.js 16 / React 19 / TypeScript;
- next-intl;
- openapi-typescript + openapi-fetch;
- nuqs;
- ECharts;
- .NET 10 / C# 14;
- EF Core 10 + Npgsql 10;
- NodaTime + TimeProvider;
- PostgreSQL 18 + pg_stat_statements;
- OpenTelemetry / OTLP;
- Testcontainers, Playwright and the testing stack documented in `TESTING.md`.

See `PLATFORM_DEPENDENCIES.md`, `WEB_RUNTIME.md`, `OBSERVABILITY.md`, `SECURITY.md`, and `TESTING.md`.

### Localization

Launch UI locales:

- en;
- ru;
- zh-Hans;
- fr;
- pt-BR.

UI routes are locale-prefixed; the machine API remains locale-neutral.

See `LOCALIZATION.md`.

### Core war experience

Current War, War Timeline and War Replay are now the explicit product core.

Replay is a read projection over the same canonical history as Timeline; no replay-only source-of-truth store is introduced.

Detailed semantics/API/UI/acceptance criteria are in `CORE_WAR_EXPERIENCE.md`.

Items explicitly marked UNKNOWN or unresolved remain conservative implementation constraints, not invitations to guess.
