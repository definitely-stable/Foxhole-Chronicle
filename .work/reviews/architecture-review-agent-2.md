План уже собран на правильной базе: отдельный Next.js frontend, ASP.NET Core API, ingestion worker, PostgreSQL, без Kafka/Redis/Kubernetes и прочего преждевременного усложнения. Стек на 19 сентября 2026 менять не требуется: Next.js 16.3.3 действительно текущий Active LTS security release, React 19.3 актуален, Node 24 — LTS, .NET 10.0.12 — активный LTS, PostgreSQL 18.6 — stable, ECharts 6.1 актуален. ([nextjs.org](https://nextjs.org/blog?utm_source=chatgpt.com "Next.js by Vercel - The React Framework | Next.js by Vercel - The React Framework"))

Основная переработка нужна не в технологиях, а в модели данных и semantics.

### Что я бы изменил

| ПриоритетСейчасЧто сделать |                                                     |                                                                     |
| -------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| **P0**                     | Daily aggregation после UTC day close               | Ввести отдельно `war_day` и `calendar_date_utc`                     |
| **P0**                     | `WarEvent` выглядит как событие с точным временем   | Хранить **observed change interval**, а не выдуманное время события |
| **P0**                     | `ObjectiveState/map_objects` без стратегии identity | Ввести собственный стабильный `objective_key`                       |
| **P0**                     | war идентифицируется в основном номером             | Канонический ключ: `shard + warId`; `warNumber` только display      |
| **P0**                     | polling задаётся фиксированными 1–5 минутами        | Перейти на **cache-header/ETag-driven scheduler**                   |
| **P0**                     | raw snapshots без retention policy                  | Content-addressed snapshots + dedup + retention                     |
| **P0**                     | партиционирование по `war_id` уже в плане           | Вообще убрать partitioning из v1                                    |
| **P0**                     | несколько потенциальных cache layers                | Явно определить один caching contract                               |
| **P0**                     | `DerivedMetric` слишком универсален                 | Ввести registry метрик + специализированные rollups                 |
| **P0**                     | исторический импорт FoxholeStats                    | Сделать versioned bootstrap dataset, а не runtime dependency        |
| **P1**                     | Domain/Application довольно тяжёлые                 | Упростить backend под vertical slices                               |
| **P1**                     | нет полноценного CI/deployment/backup раздела       | Добавить его до начала реализации                                   |
| **P1**                     | API описан только URL'ами                           | Добавить pagination/range/resolution/cache semantics/OpenAPI        |
| **P1**                     | performance targets частично технические            | Добавить freshness/data-quality SLO и Web Vitals                    |

Ниже — почему это важно.

---

## 1. Самая важная ошибка — время

Сейчас указано:

```text
Daily aggregation → after UTC day close
```

а весь Compare строится вокруг:

```text
Day 1
Day 2
...
```

Это две разные системы времени.

War API отдельно отдаёт `conquestStartTime`, а war report — `dayOfWar`. То есть день войны не обязан начинаться в 00:00 UTC. ([GitHub](https://github.com/clapfoot/warapi/blob/master/README.md "warapi/README.md at master · clapfoot/warapi · GitHub"))

Нужны две оси:

```text
war_day
war_elapsed_seconds

calendar_date_utc
captured_at
```

Например:

```text
War 140
conquest_start = 2026-08-25 17:00 UTC

War Day 1:
17:00 → следующий день 17:00

Calendar 2026-08-25:
00:00 → 24:00 UTC
```

`Daily Chronicle` я бы вообще адресовал так:

```text
/war/140/day/17
```

а не главным образом по календарной дате.

Календарная дата остаётся для поиска и внешнего контекста.

---

## 2. `WarEvent` надо переименовать в `ObservedEvent`

Это критично для честности Chronicle.

Pipeline сейчас:

```text
snapshot A
↓
snapshot B
↓
DIFF
↓
EVENT
```

Но если объект был Colonial в 14:01 и Warden в 14:03, мы знаем только:

```text
change ∈ (14:01, 14:03]
```

Мы **не знаем**, что capture произошёл в 14:02:17.

War API dynamic map data содержит текущее состояние, `lastUpdated` и version, но не журнал всех произошедших между снимками событий. ([GitHub](https://github.com/clapfoot/warapi/blob/master/README.md "warapi/README.md at master · clapfoot/warapi · GitHub"))

Поэтому модель лучше сделать примерно такой:

```text
ObservedEvent

id
war_id
region_id
objective_key

event_type

previous_observed_at
current_observed_at
detected_at

previous_state
current_state

detector_version
confidence
```

UI тогда пишет:

```text
Captured by Colonials
Observed between 14:01–14:03 UTC
```

а не:

```text
Captured at 14:02
```

Это резко повышает доверие к Chronicle.

---

## 3. У War API нет стабильного ID map item

Официальная схема map item содержит:

```text
teamId
iconType
x
y
flags
```

но никакого `objectiveId`. ([GitHub](https://github.com/clapfoot/warapi/blob/master/README.md "warapi/README.md at master · clapfoot/warapi · GitHub"))

Поэтому вот эти сущности:

```text
ObjectiveState
map_objects
map_object_states
```

пока архитектурно недоопределены.

Chronicle должен сам создать идентичность:

```text
objective_key
region_id
canonical_x
canonical_y
objective_family
```

Static map data используется как anchor.

Dynamic item сопоставляется с canonical objective.

И обязательно:

```text
identity_algorithm_version
```

потому что алгоритм сопоставления может потом измениться.

Иначе diff engine однажды решит, что Town Base T1 → Town Base T2 означает уничтожение одного объекта и появление другого.

---

## 4. Канонический War ID — не `warNumber`

Официальный `/worldconquest/war` возвращает и:

```text
warId
warNumber
```

а War API имеет Live-1, Live-2 и Live-3 endpoints. ([GitHub](https://github.com/clapfoot/warapi/blob/master/README.md "warapi/README.md at master · clapfoot/warapi · GitHub"))

Поэтому БД:

```text
wars

id                  internal UUID
shard               live1
source_war_id       official warId
war_number          140
```

и UNIQUE:

```text
(shard, source_war_id)
```

а не просто:

```text
war_number
```

URL `/war/140` можно оставить удобным alias для primary shard.

---

## 5. Polling лучше полностью переделать

Сейчас:

```text
War state          1–5 min
War reports        5 min
Dynamic maps       2–5 min
Static maps        once per war
```

А официальный API специально говорит использовать cache headers и ETag/`If-None-Match`; при отсутствии изменений возвращается `304`. ([GitHub](https://github.com/clapfoot/warapi/blob/master/README.md?utm_source=chatgpt.com "warapi/README.md at master · clapfoot/warapi · GitHub"))

Я бы сделал:

```text
Fetch endpoint
      ↓
read Cache-Control / ETag
      ↓
calculate next_allowed_fetch
      ↓
apply Chronicle minimum interval
      ↓
fetch
      ↓
304 → only fetch metadata
200 → hash body
      ↓
same hash → no fact processing
changed → normalize
```

То есть не:

```text
every 2 minutes forever
```

а:

```text
server cache policy
+
Chronicle freshness policy
```

Это и дешевле, и корректнее по отношению к API.

---

## 6. Raw snapshot нужен, но не каждый payload навсегда

Сама идея:

```text
FETCH
→ RAW SNAPSHOT
→ NORMALIZATION
```

очень правильная.

Но нужен lifecycle.

Я бы хранил:

```text
source_fetches

endpoint
fetched_at
http_status
etag
cache_control
source_last_updated_at
content_hash
payload_id?
```

и:

```text
source_payloads

content_hash PK
payload jsonb
first_seen_at
```

Новый payload сохраняется **только если hash изменился**.

Дополнительно можно задать:

```text
raw hot retention       90 days
normalized facts        forever
daily/war aggregates    forever
important source anchors forever
```

Для начала JSONB + PostgreSQL достаточно. S3/MinIO тут не нужны.

---

## 7. Партиционирование сейчас преждевременно

Раздел:

> `region_samples partition by war_id`

я бы из реализации v1 убрал.

PostgreSQL 18 спокойно переварит этот объём с индексами:

```text
(war_id, region_id, captured_at)

(war_id, captured_at)

(region_id, captured_at)
```

плюс BRIN по большим append-only временным таблицам, когда это действительно потребуется.

Partition-per-war создаст:

```text
DDL на каждую войну
больше migrations
больше maintenance
сложнее generic queries
сложнее testing
```

без заметной выгоды на старте.

Я бы записал в ADR:

> Partitioning postponed until measured query/storage data proves a need.

---

## 8. Aggregation нужно сделать умнее

Сейчас:

```text
5m
→ hourly
→ daily
```

Правильное направление, но нельзя применять один тип aggregation ко всем данным.

Например casualty delta:

```text
SUM
```

rate:

```text
avg
max
p95
```

cumulative:

```text
last
```

objective activity:

```text
count
distinct objectives
```

Для визуализации я бы ещё добавил динамический chart downsampling.

Например backend получает:

```text
GET timeline
width≈1400px
```

и отдаёт не 50 000 точек, а условно ≤1500–2500 репрезентативных точек.

Для spikes лучше min/max/LTTB-style downsampling, а не просто среднее — иначе самый кровавый пятиминутный промежуток может исчезнуть.

---

## 9. `DerivedMetric` надо превратить в настоящий metric system

Сейчас уже хорошо предусмотрены:

```text
metric_version
algorithm_version
```

Я бы развил это в:

```text
metric_definitions

metric_key
version
unit
description
formula
window
required_inputs
coverage_requirement
algorithm_hash
```

Например:

```text
casualties_per_hour@1
activity_index@2
volatility@1
war_pace_percentile@3
```

И результат:

```text
metric_values

metric_definition_id
war_id
region_id?
period_start
period_end

value
sample_count
coverage_ratio
confidence
```

Особенно это нужно для:

```text
Activity Index
Volatility
Turning Point
Historical Percentile
War Pace
```

Иначе спустя год никто, включая ИИ-агента, не вспомнит, что означало `activity_index = 78`.

---

## 10. Historical baseline требует понятия coverage

В плане уже хорошо указано:

> Recorded since WCxxx

для метрик, которые Chronicle не имеет для старых войн.

Я бы сделал это системным свойством:

```text
coverage

metric
war
coverage_start
coverage_end
expected_samples
actual_samples
coverage_ratio
quality
```

Тогда Chronicle сможет честно сказать:

```text
Most volatile region
Recorded since WC140
Coverage: 98.7%
```

а historical percentile сможет автоматически исключить войны с недостаточными данными.

---

## 11. FoxholeStats — только immutable bootstrap

Текущий план уже правильно говорит, что сайт не должен обращаться к FoxholeStats на каждый пользовательский запрос.

Я бы пошёл ещё дальше.

Не:

```text
FoxholeStatsHistoricalImporter
ежедневно скрейпит сайт
```

а:

```text
historical-bootstrap/
  foxholestats-wars-2026-09-19.json
  manifest.json
```

где manifest:

```text
source_url
retrieved_at
sha256
parser_version
source_class = community_historical
```

Импорт выполняется как controlled migration/import.

После этого Chronicle живёт самостоятельно.

Это особенно важно, потому что по вашей же source policy FoxholeStats относится к secondary sources, а официальный War API предназначен именно для текущего World Conquest.

---

## 12. Frontend caching сейчас надо определить строже

Здесь потенциально появляется сразу четыре слоя:

```text
ASP.NET
Next.js
TanStack Query
browser
```

и потом каждый считает, что его данные свежие.

Next.js self-hosting действительно имеет встроенный cache/ISR и на одном persistent instance нормально работает без Redis; shared cache нужен уже при нескольких instances. ([nextjs.org](https://nextjs.org/docs/app/guides/self-hosting?utm_source=chatgpt.com "Guides: Self-Hosting | Next.js"))

ASP.NET Core 10 также имеет встроенный Output Cache с tagging/revalidation и stampede protection. ([Microsoft Learn](https://learn.microsoft.com/en-us/aspnet/core/performance/caching/output?view=aspnetcore-10.0\&utm_source=chatgpt.com "Output caching middleware in ASP.NET Core | Microsoft Learn"))

Поэтому для v1 я бы зафиксировал:

```text
PostgreSQL
   ↓
ASP.NET
   ↓
OutputCache
   ↓
Next.js RSC / page cache
   ↓
browser
```

А TanStack Query использовать **только** там, где есть client-side live/interactivity:

```text
Watch Mode
live events
interactive compare
client filters
```

Не нужно грузить через TanStack Query обычную SSR-страницу `/war/140`.

---

## 13. Caddy должен давать один origin

Я бы сделал routing:

```text
https://chronicle.example.com/*
        ↓
       Caddy

/api/* ─────────→ Chronicle.Api

everything else → Next.js
```

Тогда browser работает:

```text
GET /api/v1/...
```

без CORS вообще.

А Next Server Components внутри Docker network могут ходить напрямую:

```text
http://chronicle-api:8080
```

Это чище, чем:

```text
browser
→ Next BFF
→ ASP.NET
```

для каждого API-запроса.

Next остаётся presentation/SSR, как и предусмотрено планом.

---

## 14. Я бы немного упростил backend projects

Сейчас:

```text
Api
Worker
Domain
Application
Infrastructure
Contracts
```

Для такого read-heavy проекта есть риск получить Clean Architecture ради Clean Architecture.

`SourceSnapshot`, `DailyAggregate`, `DerivedMetric` — это не особо богатые DDD aggregates.

Я бы сделал либо текущую структуру, но без Repository/UoW/mediator boilerplate, либо даже:

```text
Chronicle.Api
Chronicle.Worker
Chronicle.Core
Chronicle.Infrastructure
```

А внутри `Core` — vertical slices:

```text
Wars/
Regions/
Chronicle/
Records/
Analytics/
Events/
```

Например:

```text
Analytics/
  GetWarTimeline.cs
  CompareWars.cs
  CalculateWarPace.cs
  DetectTurningPoints.cs
```

Для AI-agent разработки это значительно проще.

`Chronicle.Contracts` тоже необязателен: ASP.NET генерирует OpenAPI, а frontend получает TypeScript types/client из OpenAPI.

То есть один контракт вместо двух вручную синхронизируемых моделей.

---

## 15. REST оставить

Здесь я ничего бы не менял.

```text
REST
не GraphQL
```

для read-heavy public analytics API — разумный выбор.

Но расширил бы contract:

```text
GET /api/v1/wars/{war}/timeline
    ?metric=casualties
    &from=...
    &to=...
    &resolution=auto
```

и:

```text
resolution=auto|5m|1h|1d
```

По умолчанию именно `auto`.

Events:

```text
?after=<cursor>
&limit=100
&type=capture
&region=Deadlands
```

Для Watch Mode на первом этапе достаточно conditional polling. WebSocket/SignalR я бы не добавлял.

Если потом нужен настоящий push — SSE проще и достаточен.

---

## 16. Performance SLO надо немного исправить

Сейчас:

```text
TTFB cached <300 ms
API p95 <250 ms
dashboard initial <2 s
chart interaction 60 fps
```

Я бы заменил часть на более измеримые пользовательские показатели:

```text
cached TTFB p75       <300 ms
API read p95          <250 ms

LCP p75               <2.5 s
INP p75               <200 ms
CLS p75               <0.1

chart initial dataset <2500 visible points

current-data lag p95  <2 × collection interval
aggregate lag         <5 min
```

Последние два для Chronicle даже важнее обычного uptime.

Пользователю бесполезен сайт с `99.9% availability`, если над графиком написано `Updated 47 minutes ago`.

---

## 17. Не хватает operational блока

Это крупнейшая дырка после data semantics.

`OpenTelemetry` указан, но самого эксплуатационного плана нет.

Минимальный production contract я бы сделал таким:

```text
CI
────────────────────────
dotnet format/check
dotnet test
integration tests + Testcontainers

tsc
eslint
vitest
playwright smoke

OpenAPI compatibility check
EF migration validation

docker build
container vulnerability scan


DEPLOY
────────────────────────
database backup
migration job
API
Worker
Web
health checks


OBSERVABILITY
────────────────────────
ingestion_last_success
ingestion_lag
source_304_ratio
source_failures
events_detected
aggregation_lag
db_size
api_latency
api_errors


BACKUP
────────────────────────
nightly PostgreSQL backup
off-site copy
retention
periodic restore test
```

Особенно backup.

Исторические данные Chronicle со временем станут ценнее самого кода.

---

# Как я бы изменил итоговую архитектуру

Не радикально. Вот такой вариант выглядит лучше:

```text
                         INTERNET
                            │
                            ▼
                          Caddy
                   TLS / routing / limits
                            │
             ┌──────────────┴──────────────┐
             │                             │
          Next.js                    ASP.NET API
       SSR / RSC / UI             REST / analytics
             │                             │
             └──────────────┬──────────────┘
                            │
                       PostgreSQL
                            ▲
                            │
                     Ingestion Worker
                            │
              ┌─────────────┴─────────────┐
              │                           │
       Official War API          Historical bootstrap
              │                           │
       ETag/cache headers          immutable import
              │
              ▼
        Source snapshots
              │
        normalization
              │
       observations/facts
              │
           diff
              │
      observed events
              │
          rollups
              │
      derived analytics
```

Главное отличие от текущего плана — Chronicle хранит не «что точно произошло», а цепочку:

```text
source
→ observation
→ normalized fact
→ observed change
→ derived interpretation
```

Это намного сильнее как аналитический продукт.

---

# Что из текущего плана я бы точно оставил

`Next.js + ASP.NET Core + PostgreSQL + ECharts`, modular monolith, отдельный Worker, отсутствие Redis/Kafka/Kubernetes/GraphQL/TimescaleDB, ETag ingestion, source transparency, backend aggregation, cardless analytical UI и принцип `Official / Historical / Derived` — всё это удачные решения.

Особенно не стал бы сейчас добавлять Redis. Для единственного Next/API instance его отсутствие обосновано: Next.js официально нормально использует локальный cache при single-instance self-hosting, а ASP.NET Output Cache по умолчанию также работает in-process. Redis понадобится только после реальной горизонтальной репликации. ([nextjs.org](https://nextjs.org/docs/app/guides/self-hosting?utm_source=chatgpt.com "Guides: Self-Hosting | Next.js"))

### Итог

Если сократить всё до наиболее важных изменений, перед началом кодирования я бы обязательно исправил **6 вещей**: `war_day` вместо UTC-only aggregation; `ObservedEvent` с временным интервалом; стабильную identity model для War API map items; `shard + warId` как идентичность войны; header-driven ingestion вместо жёстких polling intervals; убрать partitioning из v1.

После этого добавить metric registry, coverage model, чёткую cache architecture, immutable historical bootstrap и CI/backup/observability.

Тогда план станет не просто хорошим ТЗ на сайт, а достаточно строгой спецификацией, чтобы ИИ-агент мог начать писать `ARCHITECTURE.md`, schema и ingestion pipeline без необходимости через несколько этапов переделывать фундамент.