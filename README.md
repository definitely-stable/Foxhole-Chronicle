# Foxhole Chronicle

Foxhole Chronicle is a historical observatory for Foxhole World Conquest.

Its product core is deliberately narrow:

- **Current War** — a beautiful, concise view of the current war now;
- **War Timeline** — the central product: the whole war through time;
- **War Replay** — move backward/forward through Chronicle's observed historical map/objective state.

Chronicle is not intended to replace a tactical live map or become a general-purpose Foxhole tool hub.

The system turns public source observations into a durable, source-transparent historical record with explicit time, coverage and uncertainty semantics.

## Architecture

Baseline:

- Next.js 16 / React 19 / TypeScript;
- ASP.NET Core / .NET 10 / C# 14;
- PostgreSQL 18;
- separate ingestion Worker;
- hybrid durable raw-payload storage;
- OpenTelemetry / OTLP;
- Docker Compose + Caddy.

The architecture is a modular monolith with a separate ingestion worker.

## Implementation bootstrap

Prerequisites:

- .NET SDK 10.0.112 or compatible newer 10.0 feature band allowed by `global.json`;
- Node.js 24.21+ LTS with npm 11;
- Docker Compose for local PostgreSQL.

From repository root:

~~~bash
npm run bootstrap
docker compose up -d postgres
npm run verify
~~~

Development processes:

~~~bash
dotnet run --project src/Chronicle.Api
dotnet run --project src/Chronicle.Worker
npm --prefix apps/web run dev
~~~

Bootstrap currently provides the runnable process/toolchain skeleton, locale routing, health/status endpoints, OpenAPI generation and smoke-test boundaries. It intentionally does **not** yet implement War API ingestion or the first Chronicle domain migration.

## Documentation

Agent/contributor execution rules are in [AGENTS.md](./AGENTS.md).

Authoritative working specifications live under [.work](./.work/README.md).

Start with:

- [.work/ARCHITECTURE.md](./.work/ARCHITECTURE.md)
- [.work/CORE_WAR_EXPERIENCE.md](./.work/CORE_WAR_EXPERIENCE.md)
- [.work/PRODUCT_SCOPE.md](./.work/PRODUCT_SCOPE.md)
- [.work/WAR_API_SEMANTICS.md](./.work/WAR_API_SEMANTICS.md)
- [.work/TIME_SEMANTICS.md](./.work/TIME_SEMANTICS.md)
- [.work/DATA_MODEL.md](./.work/DATA_MODEL.md)
- [.work/INGESTION.md](./.work/INGESTION.md)
- [.work/PUBLIC_API.md](./.work/PUBLIC_API.md)

## Product principle

~~~text
                     WAR HISTORY MODEL
                            |
                            v
                       WAR TIMELINE
                    central product
                            |
              +-------------+-------------+
              |                           |
              v                           v
         CURRENT WAR                  WAR REPLAY
           now                         selected time
~~~

Replay represents **observed history**, not an omniscient exact recording. Poll-bounded transition uncertainty and missing coverage are preserved and shown rather than invented away.
