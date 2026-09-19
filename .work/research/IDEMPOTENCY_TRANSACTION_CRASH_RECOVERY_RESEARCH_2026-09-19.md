# Idempotency / Transaction / Crash-Recovery Research Synthesis — 2026-09-19

Status: **Research evidence, not authoritative architecture by itself**

This synthesis records the evidence used to harden Chronicle's durable worker protocol. Primary documentation defines guarantees. Reddit/Habr/engineering discussions are used only as operational evidence and failure-pattern review.

## Executive conclusions

1. PostgreSQL READ COMMITTED plus explicit row locking, unique constraints and deterministic operation IDs is sufficient for Chronicle's normal reconciliation path. SERIALIZABLE is not required globally.
2. PostgreSQL explicitly requires whole-transaction retry for serialization failures; deadlocks are also reasonable retry candidates. Error handling should key on SQLSTATE.
3. A connection loss during COMMIT has unknown outcome. EF Core documents the idempotency problem. PostgreSQL 18.6 exposes pg_xact_status(xid8) specifically including the disconnect-during-COMMIT use case. Chronicle still requires operation-ID reconciliation because an application process may die before retaining the xid.
4. FOR UPDATE SKIP LOCKED is appropriate for queue-like claim coordination, not general consistency.
5. Transactional outbox is at-least-once: a crash after effect success but before marking the row complete necessarily permits duplicate delivery. Idempotent handlers/dedup keys are mandatory.
6. LISTEN/NOTIFY is a wake-up optimization only. LISTEN registrations are session-bound and missed notifications are not durable work state.
7. POSIX write + rename is insufficient as a crash-durability protocol. fsync(file) and fsync(parent directory) are required around durable publication.
8. External CAS must be durable before PostgreSQL commits a reference. Orphan objects are the safe failure direction.
9. PostgreSQL + external replay archive are one recovery boundary. A PITR point referencing not-yet-replicated CAS is not a complete recovery point.
10. .NET BackgroundService graceful shutdown is useful but cannot be a correctness primitive because StopAsync may not run on abrupt process failure.

## Primary source matrix

### PostgreSQL 18.6

- PostgreSQL 18 documentation root: https://www.postgresql.org/docs/18/
- Concurrency control: https://www.postgresql.org/docs/18/mvcc.html
- Application-level consistency: https://www.postgresql.org/docs/18/applevel-consistency.html
- Serialization failure handling: https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html
- INSERT / ON CONFLICT: https://www.postgresql.org/docs/18/sql-insert.html
- Advisory lock functions: https://www.postgresql.org/docs/18/functions-admin.html
- Client timeouts including statement_timeout, transaction_timeout and lock_timeout: https://www.postgresql.org/docs/18/runtime-config-client.html
- COMMIT durability semantics: https://www.postgresql.org/docs/18/sql-commit.html
- non-durable settings / synchronous_commit risk: https://www.postgresql.org/docs/18/non-durability.html
- SQLSTATE appendix: https://www.postgresql.org/docs/18/errcodes-appendix.html
- Transaction ID/status functions including pg_xact_status: https://www.postgresql.org/docs/18/functions-info.html
- LISTEN: https://www.postgresql.org/docs/18/sql-listen.html

Important verified details:

- default isolation is READ COMMITTED;
- 40001 is serialization_failure;
- 40P01 is deadlock_detected;
- PostgreSQL docs require retrying the complete transaction for serialization failures;
- pg_xact_status can report committed/aborted/in-progress for sufficiently recent transactions and explicitly mentions disconnect during COMMIT;
- transaction_timeout exists and can bound whole transaction lifetime;
- synchronous_commit=off can acknowledge transactions before WAL is durably flushed and therefore is unsuitable for Chronicle's canonical durability paths;
- SKIP LOCKED is intended for queue-like consumers and yields an intentionally inconsistent view.

### EF Core / Npgsql / .NET

- EF Core connection resiliency and transaction commit failure: https://learn.microsoft.com/en-us/ef/core/miscellaneous/connection-resiliency
- Npgsql EF Core execution strategy: https://www.npgsql.org/efcore/misc/other.html
- .NET worker services: https://learn.microsoft.com/en-us/dotnet/core/extensions/workers
- ASP.NET Core hosted services / shutdown behavior: https://learn.microsoft.com/en-us/aspnet/core/fundamentals/host/hosted-services
- .NET HTTP resilience: https://learn.microsoft.com/en-us/dotnet/core/resilience/http-resilience
- HttpStandardResilienceOptions: https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.http.resilience.httpstandardresilienceoptions

Verified implications:

- EF Core explicitly warns that a connection drop during transaction commit leaves transaction state unknown and retry can duplicate/corrupt if the operation is not idempotent;
- Npgsql provides an execution strategy based on transient exception classification;
- BackgroundService StopAsync is graceful-shutdown behavior, not guaranteed after abrupt process failure;
- standard HTTP resilience supports retry/circuit-breaker/timeouts, but Chronicle should keep GET attempts auditable rather than hide provenance.

### Linux/POSIX durability

- fsync(2): https://man7.org/linux/man-pages/man2/fsync.2.html
- rename(2): https://man7.org/linux/man-pages/man2/rename.2.html

Verified implication: fsync(file) does not itself guarantee that the containing directory entry is durable; directory fsync is needed for that publication boundary.

### Object storage

- S3 conditional writes: https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html
- enforcing conditional writes: https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes-enforce.html
- CompleteMultipartUpload: https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html

These are adapter evidence, not a guarantee for every S3-compatible provider. Chronicle must verify the semantics of the selected provider.

### pgBackRest

- User guide: https://pgbackrest.org/user-guide.html
- command reference: https://pgbackrest.org/command.html

Relevant details:

- WAL archive is required for PITR;
- archive checks verify required WAL availability for backup consistency;
- repository verify exists;
- asynchronous archive queue limits can deliberately break the WAL archive stream if exceeded, so that condition must alert as loss of PITR continuity rather than be treated as ordinary lag.

### OpenTelemetry

- .NET metrics: https://opentelemetry.io/docs/languages/dotnet/metrics/
- .NET metric best practices: https://opentelemetry.io/docs/languages/dotnet/metrics/best-practices/
- 2026 cardinality guidance: https://opentelemetry.io/blog/2026/cardinality-limits-in-opentelemetry/

Operational implication: IDs/hashes belong in logs/traces, not metric dimensions.

## Community / operational evidence

These sources are not normative guarantees.

### Habr

- File crash durability discussion: https://habr.com/ru/articles/803347/
  - useful practical explanation of temp-write/fsync/rename/directory-fsync patterns.
- Transactional Outbox production discussion: https://habr.com/ru/companies/otus/articles/967974/
  - reinforces SKIP LOCKED worker claims.
- Idempotency pipeline article: https://habr.com/ru/articles/1080814/
  - correctly highlights that outbox moves the duplicate-delivery problem to the consumer/handler.
- Outbox ordering analysis: https://habr.com/ru/articles/1072066/
  - useful warning that concurrent workers do not imply strict aggregate ordering.

### Reddit

- r/PostgreSQL: Postgres message queue discussion: https://www.reddit.com/r/PostgreSQL/comments/1edct6o/
  - community experience supports SKIP LOCKED + optional notify for modest workloads and warns that notifications are not durable delivery.
- r/PostgreSQL: using Postgres as a message queue: https://www.reddit.com/r/PostgreSQL/comments/zvwu0x/
  - practical consensus: table state is durable truth; NOTIFY is a wake-up.
- r/dotnet: EF Core retries and transactions: https://www.reddit.com/r/dotnet/comments/1m24r2u/
  - useful evidence that retry scope and DbContext/transaction recreation are common implementation traps.
- r/softwarearchitecture transactional outbox discussion: https://www.reddit.com/r/softwarearchitecture/comments/v7lmvi/
  - clearly identifies crash-after-send-before-mark-complete duplicate risk.
- r/devops restore testing 2026: https://www.reddit.com/r/devops/comments/1v0m5nh/
  - operational evidence that automated restore drills are often missing despite backup success.
- r/PostgreSQL backup discussion 2026: https://www.reddit.com/r/PostgreSQL/comments/1v69ku3/
  - current community preference evidence for pgBackRest and actual restore validation, not a product guarantee.

## Chronicle engineering decisions

The following are Chronicle decisions built on the evidence above, not direct upstream guarantees:

- one logical collection job is separate from attempts/fetches;
- scheduled slot is part of logical job identity but request/capture timestamps are not;
- endpoint lease_generation is the stale-worker fencing token;
- endpoint cursor row is the canonical serialization point for one semantic endpoint;
- READ COMMITTED + explicit cursor lock is the default reconciliation isolation;
- initial SET LOCAL worker limits are lock_timeout 2s, statement_timeout 15s, transaction_timeout 30s, pending load calibration;
- one audited HTTP exchange per ingestion attempt is preferred to hidden transport retries;
- unknown COMMIT correctness is operation-ID-first; pg_xact_status is supplemental;
- outbox does not promise global ordering; revision/input fingerprints make stale jobs no-op;
- strict ordering, if later required, must be explicit per ordering key;
- CAS GC is delayed mark/sweep with in-flight protection;
- sealing uses immutable archive revisions and a final fenced commit;
- complete DR uses a recovery watermark that includes verified external payload availability.

## Rejected interpretations

- exactly-once execution: unsupported;
- CommitAsync exception == rollback: false;
- ETag == content hash: false;
- successful rename == durable file publication: insufficient;
- successful outbox send == safe to mark before effect: false;
- LISTEN/NOTIFY == durable queue: false;
- backup job success == tested recovery: false;
- pg_xact_status alone == universal unknown-commit recovery: insufficient because xid may be unavailable after process death.
