# Foxhole Chronicle — Idempotency, Transactions and Crash Recovery

Status: **Authoritative working specification — 2026-09-19**

This document defines the durable execution protocol for ingestion, reconciliation, transactional outbox work, reprocessing, external CAS publication, war sealing and crash recovery.

It complements:

- [INGESTION.md](./INGESTION.md)
- [DATA_MODEL.md](./DATA_MODEL.md)
- [DATA_LIFECYCLE.md](./DATA_LIFECYCLE.md)
- [TIME_SEMANTICS.md](./TIME_SEMANTICS.md)
- [OBJECTIVE_IDENTITY.md](./OBJECTIVE_IDENTITY.md)

Research basis: [research/IDEMPOTENCY_TRANSACTION_CRASH_RECOVERY_RESEARCH_2026-09-19.md](./research/IDEMPOTENCY_TRANSACTION_CRASH_RECOVERY_RESEARCH_2026-09-19.md).

## 1. Guarantee model

Chronicle does **not** claim exactly-once execution.

The v1 contract is:

- scheduling/fetch attempts: **at-least-once capable**;
- HTTP GET: may be repeated after timeout/worker loss;
- raw payload identity: exact-byte deduplication by SHA-256;
- canonical PostgreSQL mutation: **effectively-once per deterministic reconciliation operation** through unique constraints, endpoint fencing and idempotent transaction replay;
- outbox delivery: **at-least-once**;
- outbox effects: effectively-once only where the handler has a deterministic deduplication key or naturally idempotent target;
- sealed archive publication: effectively-once per war archive revision;
- reprocessing: repeatable and idempotent for the same input fingerprint + algorithm/version set.

No local wall-clock timestamp is an idempotency key.

## 2. Terminology and identities

Chronicle distinguishes:

| Concept | Meaning | Identity |
|---|---|---|
| logical collection job | one scheduled/triggered collection intent | deterministic job key |
| ingestion attempt | one worker ownership/execution attempt for a job | client-generated UUID |
| fetch | one HTTP exchange | client-generated UUID linked to attempt |
| payload | exact response bytes | source + SHA-256(original bytes) |
| representation validation | evidence that a representation was current at a validation instant | fetch ID + representation payload |
| semantic representation | versioned parser-level canonicalization | semantic fingerprint + version |
| reconciliation operation | one intended canonical DB mutation for accepted evidence | deterministic operation ID |
| canonical revision | monotonic accepted endpoint state revision | endpoint cursor revision |
| outbox job | durable downstream intent | job ID + deterministic dedup key |
| reprocessing run | one versioned replay intent | scope + input fingerprint + versions |
| sealing run | one archive revision construction intent | war + archive revision |

### 2.1 Logical job key

Scheduled collection jobs use a deterministic key derived from:

source + shard + endpoint semantic key + collection profile version + deterministic scheduled slot.

Immediate jobs use a deterministic trigger key when one exists, for example a war transition keyed by shard + new source war ID. Otherwise the scheduler persists a generated logical job ID **before** execution and retries that same ID.

requested_at, completed_at and captured_at MUST NOT define logical job identity.

### 2.2 Reconciliation operation ID

Before starting the reconciliation transaction the worker derives or persists one operation ID and reuses it for every retry of that same response/evidence.

The operation ID MUST be protected by a unique constraint. A retry that finds the operation already committed returns the committed result rather than applying the mutation again.

UUIDv7 is the default physical identifier for jobs/attempts/fetches because it is client-generated and index-friendly. Hash-derived IDs MAY be used only for truly deterministic identities. Business uniqueness remains enforced by explicit unique constraints, not by UUID shape.

## 3. Non-negotiable invariants

1. HTTP I/O, compression, external upload and heavy analytics MUST NOT run inside a PostgreSQL transaction.
2. A committed PostgreSQL reference to external CAS requires the object to be durably published first.
3. An orphan CAS object is acceptable; a committed DB reference to a missing CAS object is not.
4. Every canonical mutation that requires downstream work commits the outbox rows in the same PostgreSQL transaction.
5. A stale/expired job lease holder or stale endpoint-fence holder MUST NOT mutate canonical current state after newer ownership has been established.
6. Older/late evidence remains immutable evidence even when fenced from current-state mutation.
7. A 304 creates validation/coverage evidence but no duplicate payload or normalized observation.
8. Byte-identical 200 responses reuse payload identity.
9. Different bytes with the same semantic fingerprint remain distinct raw evidence but do not force semantic state mutation.
10. ETag is never durable content identity.
11. Unknown COMMIT outcome MUST be reconciled; it MUST NOT be blindly replayed as a new logical operation.
12. Outbox completion MUST occur after the effect, never before it.
13. Outbox handlers MUST tolerate duplicate execution.
14. LISTEN/NOTIFY MAY wake workers but MUST NOT be the durable queue.
15. Sealed manifests are immutable; late accepted corrections create revision N+1.
16. PostgreSQL restore is complete only when every referenced external replay payload required by that restore point is available and verified.
17. Retry classification uses SQLSTATE/typed exceptions, not error-message text.
18. Correctness MUST NOT depend on graceful shutdown.
19. Canonical ingestion/outbox/sealing transactions MUST remain crash-durable: PostgreSQL `fsync` stays enabled and `synchronous_commit=off` MUST NOT be used for these transactions.

## 4. Durable ingestion state machines

Chronicle separates the logical job from attempts.

### 4.1 Logical job

States:

scheduled -> leased -> completed
                  -> retry_wait -> scheduled
                  -> quarantined
                  -> failed_terminal

blocked source/circuit conditions are represented by next_eligible_at/failure classification, not by inventing many processing states.

Durable fields include:

- id;
- job_key UNIQUE;
- source/shard/endpoint key;
- collection profile;
- scheduled_for;
- trigger_kind/trigger_key;
- state;
- next_eligible_at;
- lease_owner;
- lease_until;
- lease_generation bigint;
- attempt_count;
- last_error_class;
- created_at/updated_at.

Claiming a job increments `lease_generation` atomically. That generation fences ownership of **that logical job only**.

It is not the canonical endpoint mutation fence. A worker may execute the job only while its job generation remains current, and it may mutate canonical endpoint state only while it also owns the current endpoint `fence_token`.

### 4.2 Attempt

An attempt records execution evidence; it is not reused after ownership is lost.

States/outcomes:

- in_progress;
- http_failed;
- response_received;
- raw_durable;
- committed;
- duplicate_suppressed;
- stale_fenced;
- quarantined;
- abandoned.

Not every in-memory transition must be persisted. The durable checkpoints that matter are attempt creation, raw durability where externally observable, and final reconciliation outcome.

A lease expiry or process death leaves an in_progress attempt. Recovery marks it abandoned when a later owner proves the lease generation is obsolete.

### 4.3 Fetch

One source_fetch row represents one HTTP exchange. Transparent HTTP retries that hide exchanges from provenance SHOULD be avoided. If a resilience handler retries GET, each transport attempt MUST remain observable and attributable; the simpler v1 policy is one audited HTTP exchange per ingestion attempt followed by a new ingestion attempt on retry.

## 5. End-to-end ingestion protocol

### Phase A — schedule/claim transaction

Short READ COMMITTED transaction:

1. select eligible logical job using queue-style locking;
2. atomically set leased, lease_owner, lease_until and increment lease_generation;
3. insert ingestion_attempt with client-generated attempt ID and captured generation;
4. commit.

The claim transaction ends before HTTP.

### Phase B — HTTP and raw preparation

Outside PostgreSQL transaction:

1. issue conditional GET with endpoint ETag state;
2. enforce total timeout, attempt timeout and response-size limit;
3. on 304, retain headers/status and proceed to reconciliation;
4. on 200, read exact response bytes;
5. compute SHA-256 over original bytes;
6. compute parser/schema/semantic fingerprints as applicable;
7. if external storage is selected, publish the compressed CAS object durably;
8. if inline storage is selected, keep exact bytes for the reconciliation transaction.

The lease duration MUST exceed configured HTTP total timeout plus reconciliation margin. If the lease is renewed, renewal MUST require the same lease_generation.

### Phase C — raw-capture transaction

After the HTTP exchange is complete and any external CAS object is durably published, Chronicle crosses the raw-durable boundary in a short PostgreSQL transaction.

The raw-capture transaction MUST:

1. insert/reconcile `source_fetch` using its stable client-generated fetch ID;
2. upsert `source_payload` metadata and exact inline bytes, or the already-durable external CAS reference, for a 200 response;
3. set `representation_payload_id` for 200/304 as applicable;
4. preserve the attempt's `job_lease_generation` and `endpoint_fence_token` as provenance;
5. mark the attempt/raw checkpoint as `raw_durable`;
6. commit.

After this commit, a Worker crash MUST NOT erase the only Chronicle copy of a successfully received transient source response. A later stale fence may prevent canonical mutation, but it does not delete raw evidence.

The raw-capture transaction MUST NOT mutate endpoint current state, emit observed changes or enqueue canonical-state downstream work.

### Phase D — canonical reconciliation transaction

Default isolation: READ COMMITTED.

The transaction MUST be short and MUST:

1. SET LOCAL lock_timeout, statement_timeout and transaction_timeout to worker-write limits;
2. lock the `endpoint_poll_state` row FOR UPDATE;
3. lock the endpoint cursor row FOR UPDATE;
4. verify `attempt.job_lease_generation == ingestion_job.lease_generation`;
5. verify `attempt.endpoint_fence_token == endpoint_poll_state.fence_token` and that the attempt is the current endpoint owner;
6. load the already raw-durable fetch/payload/representation evidence;
7. persist normalized observation only when required;
8. apply anomaly/quarantine rules;
9. apply canonical state mutation only if the evidence is current and accepted;
10. increment endpoint `canonical_revision` when canonical state changes;
11. persist coverage validation evidence;
12. insert observed changes/state intervals as applicable;
13. insert all required outbox jobs with deterministic dedup keys;
14. record `reconciliation_operation_id UNIQUE` with both job generation and endpoint fence token;
15. mark attempt/job final outcome;
16. release/advance endpoint scheduling state as required;
17. commit.

Heavy identity matching, aggregate rebuilds, model recomputation, offsite upload and export generation are outbox work unless they are both small and required to establish the immediate canonical invariant.

### 5.1 Initial timeout policy

Implementation MUST set timeouts per worker transaction with SET LOCAL rather than global postgresql.conf defaults.

Initial v1 starting values, to be load-tested:

- lock_timeout: 2s;
- statement_timeout: 15s for reconciliation/claim transactions;
- transaction_timeout: 30s for reconciliation transactions;
- shorter statement/transaction limits for queue claims where practical.

These are Chronicle operational defaults, not PostgreSQL guarantees. Production values require contention/load measurements.

## 6. Concurrency and fencing

### 6.1 Endpoint execution ownership

A durable `endpoint_poll_state` row owns scheduling/cache state and the endpoint-level execution fence for one semantic endpoint.

Key:

source + shard + endpoint_key + collection_profile_version.

Fields include:

- next_due_at;
- cache_eligible_at;
- ETag/cache state;
- current owner attempt;
- lease_until;
- `fence_token bigint`;
- failure/circuit state.

Acquiring or stealing endpoint ownership is a short transaction that locks this row, verifies the prior lease is absent/expired or otherwise releasable, increments `fence_token`, records the new owner attempt and commits. Renewal requires the same owner and same fence token. A stale owner cannot renew, release or mutate endpoint current state.

### 6.2 Endpoint cursor

A durable `endpoint_cursors` row serializes accepted canonical state per semantic endpoint but does not own worker execution leases.

Fields include:

- accepted_fetch_id;
- accepted_payload_id;
- accepted_semantic_fingerprint;
- accepted_source_version;
- accepted_source_last_updated_at;
- canonical_revision bigint;
- last_validated_at;
- last_changed_at.

The reconciliation transaction locks both `endpoint_poll_state` and `endpoint_cursors` in that documented order.

Job generation and endpoint fence token are deliberately independent:

`job lease generation != endpoint canonical mutation fence`.

### 6.3 Stale completion rule

If either:

- `attempt.job_lease_generation != current ingestion_job.lease_generation`; or
- `attempt.endpoint_fence_token != current endpoint_poll_state.fence_token` / current owner attempt;

then:

- persist/reconcile immutable fetch/payload evidence when safe;
- set attempt outcome stale_fenced;
- do not roll back canonical current state;
- do not emit current-state changes;
- do not advance coverage as if the stale attempt were the active scheduled validation unless coverage policy explicitly accepts the evidence.

This protects against a slow request completing after its lease expired and a newer owner completed.

### 6.4 Source revision regression

A current lease does not override source anomaly rules.

A map source version regression or equivalent source-order anomaly is retained as evidence and quarantined; it does not automatically roll canonical state backward.

### 6.5 Locks

Use row locks for resources already represented by durable rows: ingestion jobs, endpoint cursors, outbox jobs.

Use transaction-level advisory locks only for coarse application resources that do not map cleanly to one row, such as one sealing activation per war or one global activation of a reprocessing resolution. Session-level advisory locks SHOULD NOT be used for correctness-critical worker ownership.

All multi-row lock acquisition MUST use a documented stable order.

## 7. Transaction isolation

READ COMMITTED is the default for:

- job claims;
- fetch reconciliation with explicit endpoint cursor lock;
- outbox claims/completion;
- payload metadata upserts;
- ordinary canonical state mutation.

REPEATABLE READ is not the default and SHOULD be used only when a stable snapshot is explicitly required and write-conflict behavior is understood.

SERIALIZABLE MAY be used for rare cross-row invariants where explicit locking/unique constraints would be more complex. The whole transaction must then be retryable on SQLSTATE 40001.

Deadlock SQLSTATE 40P01 is retryable only by replaying the complete transaction.

Unique violation 23505 is not generically retryable. For known idempotency/arbiter constraints it is a reconciliation signal; elsewhere it is an error until classified.

## 8. Unknown COMMIT outcome

A network failure while COMMIT is in progress can leave the client unable to know whether PostgreSQL committed.

Chronicle protocol:

1. every raw-capture transaction uses stable client-generated fetch/payload identities, and every canonical reconciliation transaction has a client-known `reconciliation_operation_id`;
2. before COMMIT, the worker MAY read pg_current_xact_id() and keep xid8 in attempt telemetry;
3. if CommitAsync throws because the connection is lost, classify commit_outcome_unknown;
4. reconnect;
5. first query the committed operation by reconciliation_operation_id;
6. if present, treat the operation as committed and load its result;
7. if absent and the xid8 is available, pg_xact_status(xid8) MAY be used as a diagnostic/fast-path while status is retained;
8. if status is committed, re-read by operation ID and alert on invariant violation if missing;
9. if status is aborted, retry the same logical operation ID;
10. if status is in progress, wait with a bounded reconciliation deadline;
11. if pg_xact_status returns NULL/unknown, operation-ID reconciliation remains authoritative: retry the same operation through unique constraints and endpoint fencing, never create a new logical operation.

The process MUST NOT assume that a CommitAsync exception means rollback.

Unknown COMMIT on the raw-capture transaction is reconciled first by the stable `source_fetch.id` and payload uniqueness. Unknown COMMIT on canonical reconciliation is reconciled by `reconciliation_operation_id`. Neither path creates a new logical identity merely because the client lost the connection.

EF Core execution strategies MUST NOT blindly rerun a transaction delegate that can create a second logical operation. Client-generated keys and deterministic operation IDs are mandatory for retryable write delegates.

## 9. Retry classification

Retry the complete DB transaction for:

- 40001 serialization_failure;
- 40P01 deadlock_detected;
- connection/transient failures when commit is known not to have happened;
- lock/statement timeout only when the operation remains safe and retry budget permits.

Reconcile before retry for:

- connection loss around COMMIT;
- statement_completion_unknown/ambiguous completion;
- any provider exception where transaction outcome cannot be proven.

Do not generic-retry:

- schema/constraint bugs;
- parser deterministic failures;
- payload integrity failure;
- permanent 4xx source response;
- source anomaly/quarantine;
- unknown SQLSTATE classes without classification.

Retries use bounded exponential backoff with jitter and preserve the same logical operation identity.

## 10. External CAS durability protocol

### 10.1 POSIX/local filesystem

For a new content-addressed object:

1. derive final path only from validated lowercase SHA-256 plus controlled prefix;
2. create a temp file on the same filesystem/directory tree;
3. stream compressed bytes while hashing/verifying original identity metadata;
4. flush application buffers;
5. fsync the temp file;
6. atomically publish without overwriting a different object;
7. fsync the containing directory after publication;
8. verify expected stored size/checksum metadata;
9. only then allow a PostgreSQL transaction to reference the object.

Atomic rename alone is not a durability guarantee. Directory fsync is required for durable directory entry publication on POSIX semantics.

Concurrent writers of the same hash converge on the same final object. Existing-object success requires integrity verification; a mismatched object at a hash path is a critical corruption/collision incident, never an overwrite.

### 10.2 Object storage

For S3-compatible storage, use deterministic hash keys and conditional create/If-None-Match where the selected provider gives equivalent semantics.

A successful PUT/CompleteMultipartUpload is not treated as proof of Chronicle content identity until checksum/size verification required by the adapter succeeds. ETag MUST NOT be assumed to equal MD5, especially for multipart/encrypted/provider-specific behavior.

### 10.3 Orphan GC

CAS GC is mark/sweep with a grace period.

An object is deletable only if:

- older than configured grace period;
- no source_payload/archive_artifact reference exists;
- no in-flight CAS publication marker protects it;
- no sealing/reprocessing run references it;
- offsite/restore policy does not require retention.

GC is idempotent. Missing referenced objects are integrity failures, not GC opportunities.

## 11. 304 and coverage protocol

304:

- source_fetch.payload_id = NULL;
- source_fetch.representation_payload_id = previously accepted payload;
- no duplicate normalized observation;
- no duplicate semantic mutation;
- create/upsert idempotent validation evidence for the fetch;
- extend coverage only according to coverage policy and the validated representation;
- update endpoint last_validated_at if the attempt is not stale-fenced.

Byte-identical 200:

- points to existing source_payload identity;
- retains new fetch/HTTP metadata;
- may update representation validation/coverage;
- does not duplicate normalized facts.

Different bytes, same semantic fingerprint:

- retains distinct raw payload evidence;
- records new representation/fetch;
- may update source metadata;
- does not force item-level/canonical mutation.

## 12. Transactional outbox

### 12.1 Required fields

outbox_jobs:

- id uuid PK;
- kind text;
- dedup_key text;
- ordering_key text NULL;
- input_fingerprint char(64) NULL;
- payload jsonb;
- state text;
- available_at timestamptz;
- priority integer;
- attempt_count integer;
- max_attempts integer;
- lease_owner text NULL;
- lease_until timestamptz NULL;
- lease_generation bigint;
- last_error_class text NULL;
- created_at/updated_at/completed_at.

Unique(kind, dedup_key).

Partial claim index SHOULD cover pending/retry rows ordered by available_at/priority.

### 12.2 Claim

Claim in a short READ COMMITTED transaction using FOR UPDATE SKIP LOCKED and update the selected rows to processing with a new lease_generation. Commit before executing the side effect.

SKIP LOCKED is queue coordination, not a general consistency mechanism.

### 12.3 Execute and complete

Run the handler outside the claim transaction.

Completion transaction updates the row only when id + lease_generation still match. A stale worker cannot complete or mutate ownership after a lease steal.

If the effect and outbox row are both in the same PostgreSQL database, the handler SHOULD commit result + outbox completion atomically when practical.

For external effects, duplicate execution is expected after crash between effect success and completion update. Therefore each handler requires one of:

- deterministic target key/conditional create;
- consumer dedup key;
- naturally idempotent operation;
- explicit inbox/effect ledger.

### 12.4 Ordering

v1 does not promise global outbox ordering.

Jobs that depend on a particular canonical version carry input_fingerprint/revision and no-op when stale.

If strict per-war/per-objective order becomes necessary, it MUST be encoded explicitly with ordering_key + sequence/fence; created_at ordering alone is not sufficient.

### 12.5 Wake-up

LISTEN/NOTIFY MAY wake an outbox poller after commit. Workers MUST still poll on startup and periodically because notifications are session-oriented, not a durable queue.

## 13. Reprocessing/versioning

A reprocessing run identity includes:

- scope;
- immutable input set/fingerprint;
- parser/normalizer version;
- semantic fingerprint version;
- matcher/taxonomy/identity resolution version where relevant;
- time semantics version + war_time_revision;
- metric/model versions.

Same identity is idempotent.

New outputs coexist with old outputs until activation.

Activation of a new resolution/version MUST be one short transaction that:

1. verifies run completed;
2. acquires the scope activation lock/fence;
3. writes active version pointer/revision;
4. enqueues targeted dependent invalidations;
5. commits.

Live ingestion continues against the currently active version. Reprocessing never edits immutable raw evidence.

## 14. War sealing

### 14.1 State machine

active -> soft_closed -> sealing -> sealed
                         -> sealing_failed -> sealing

A sealing run has a stable run ID and target archive revision.

Only one active sealing run per war/revision is allowed.

### 14.2 Protocol

1. reserve archive revision N in PostgreSQL;
2. acquire war sealing fence/advisory transaction lock for state transition;
3. snapshot required version/revision/input fingerprint set;
4. generate exports/manifests outside long DB transactions;
5. publish each external artifact durably by content hash;
6. verify referenced raw payload/offsite prerequisites;
7. build canonical manifest bytes and hash;
8. final short transaction locks the archive revision, verifies the sealing fence/input versions still match, inserts artifact references, stores manifest/hash, marks sealed and commits;
9. release/no-op stale work.

If inputs change before final commit, sealing run is stale and MUST restart/revise; it MUST NOT publish an internally inconsistent manifest.

Late accepted corrections after sealed create revision N+1. Revision N is immutable.

## 15. Backup/PITR and external raw archive consistency

PostgreSQL + external replay archive form one recovery boundary.

payload_replicas MUST distinguish:

- object uploaded;
- object verified;
- replica_verified_at;
- destination/failure domain.

A DB recovery point is fully recoverable only through a **recovery watermark** for which every external payload referenced at or before that point and required for replay has a verified offsite replica.

Operational rules:

- monitor oldest unverified referenced payload age;
- normal target remains <5m replication lag, alert >15m;
- do not claim RPO <=15m unless both WAL archive and required external payload verification satisfy that window;
- after PITR, scan restored DB external references and verify existence/decompression/original SHA-256 in the recovery archive;
- CAS objects newer than restored DB are harmless orphans;
- restored DB references to unavailable CAS are a degraded/failed recovery condition.

Restore drills MUST test PostgreSQL recovery and DB-to-CAS referential completeness together.

## 16. Data model — v1 MUST

Required durable relations:

- ingestion_jobs;
- ingestion_attempts;
- source_fetches;
- source_payloads;
- payload_replicas;
- endpoint_poll_state;
- endpoint_cursors;
- reconciliation_operations;
- outbox_jobs;
- reprocessing_runs;
- war_archive_revisions;
- archive_artifacts.

Key constraints:

- ingestion_jobs.job_key UNIQUE;
- source_payloads(source_id, content_hash) UNIQUE;
- endpoint_poll_state semantic endpoint key UNIQUE;
- endpoint_cursors semantic endpoint key UNIQUE;
- reconciliation_operations.operation_id UNIQUE;
- outbox_jobs(kind, dedup_key) UNIQUE;
- war_archive_revisions(war_id, revision) UNIQUE;
- archive_artifacts(war_archive_revision_id, artifact_kind, content_hash) UNIQUE or equivalent artifact identity.

State CHECK constraints SHOULD be explicit rather than unconstrained free text once migrations are implemented.

Foreign-key deletion SHOULD default to RESTRICT for provenance/evidence chains. Immutable evidence MUST NOT cascade-delete because a derived object is removed.

## 17. .NET 10 / Npgsql / EF Core implementation

Use EF Core for ordinary relational mapping/migrations and unit-of-work changes.

Use targeted raw SQL where PostgreSQL semantics are the point:

- FOR UPDATE SKIP LOCKED claims;
- endpoint cursor locking;
- advisory transaction locks;
- SET LOCAL worker timeouts;
- high-volume/bulk operations where measured;
- pg_current_xact_id()/pg_xact_status diagnostics.

Write transactions use client-generated IDs before SaveChanges.

ExecutionStrategy retry delegates MUST recreate DbContext/transaction state for a full retry and MUST preserve logical operation IDs.

CancellationToken cancellation stops waiting/work; it does not prove rollback after an ambiguous COMMIT. Cancellation around CommitAsync therefore follows unknown-commit reconciliation.

BackgroundService graceful shutdown SHOULD stop claiming new work, cancel bounded HTTP/CPU work and allow short DB commits to finish where possible. Correctness still relies on leases/fencing because StopAsync is not guaranteed on process failure.

## 18. Reference SQL / implementation patterns

These are reference shapes; concrete migrations may adjust names/types while preserving invariants.

### 18.1 Claim logical ingestion work

~~~sql
WITH picked AS (
    SELECT id
    FROM ingestion_jobs
    WHERE state IN ('scheduled', 'retry_wait')
      AND next_eligible_at <= now()
      AND (lease_until IS NULL OR lease_until < now())
    ORDER BY next_eligible_at, scheduled_for, id
    FOR UPDATE SKIP LOCKED
    LIMIT @batch_size
)
UPDATE ingestion_jobs j
SET state = 'leased',
    lease_owner = @worker_id,
    lease_until = now() + @lease_duration,
    lease_generation = j.lease_generation + 1,
    attempt_count = j.attempt_count + 1,
    updated_at = now()
FROM picked
WHERE j.id = picked.id
RETURNING j.*;
~~~

Attempt creation occurs in the same claim transaction using the returned generation.

### 18.2 Reconciliation fence

~~~sql
SELECT *
FROM endpoint_cursors
WHERE id = @endpoint_cursor_id
FOR UPDATE;
~~~

Then verify:

~~~text
attempt.lease_generation == endpoint_cursor.lease_generation
and logical job still owns that generation
~~~

If not, persist only safe immutable evidence and classify stale_fenced.

The reconciliation operation ledger is inserted with a stable client-generated operation ID. A unique conflict on that exact operation ID means "load committed result", not "invent another operation".

### 18.3 Outbox claim

~~~sql
WITH picked AS (
    SELECT id
    FROM outbox_jobs
    WHERE state IN ('pending', 'retry')
      AND available_at <= now()
      AND (lease_until IS NULL OR lease_until < now())
    ORDER BY priority DESC, available_at, id
    FOR UPDATE SKIP LOCKED
    LIMIT @batch_size
)
UPDATE outbox_jobs o
SET state = 'processing',
    lease_owner = @worker_id,
    lease_until = now() + @lease_duration,
    lease_generation = o.lease_generation + 1,
    attempt_count = o.attempt_count + 1,
    updated_at = now()
FROM picked
WHERE o.id = picked.id
RETURNING o.*;
~~~

Commit the claim before handler execution.

Completion:

~~~sql
UPDATE outbox_jobs
SET state = 'completed',
    completed_at = now(),
    lease_owner = NULL,
    lease_until = NULL,
    updated_at = now()
WHERE id = @id
  AND state = 'processing'
  AND lease_generation = @claimed_generation;
~~~

Affected rows must equal one. Zero rows means ownership was lost; the stale worker must not acknowledge the job.

### 18.4 Unknown COMMIT pseudocode

~~~text
operationId = stable client-generated ID
xid = null

begin transaction
  lock endpoint cursor
  verify generation
  apply idempotent writes using operationId
  xid = SELECT pg_current_xact_id()
  COMMIT

if commit acknowledgement is lost:
  reconnect
  if reconciliation_operations contains operationId:
      return committed result

  if xid is available:
      status = SELECT pg_xact_status(xid)
      if status == 'committed':
          re-read operationId; missing ledger row is an invariant alert
      if status == 'in progress':
          bounded wait/recheck
      if status == 'aborted':
          retry same operationId

  retry/reconcile same operationId through unique constraints and fencing
~~~

A new operation ID MUST NOT be generated for this retry.

### 18.5 .NET transaction skeleton

~~~csharp
var operationId = existingOrNewStableOperationId;

return await retryPolicy.ExecuteAsync(async ct =>
{
    await using var db = dbContextFactory.CreateDbContext();
    await using var tx = await db.Database.BeginTransactionAsync(
        IsolationLevel.ReadCommitted, ct);

    await db.Database.ExecuteSqlRawAsync(
        "SET LOCAL lock_timeout = '2s'; " +
        "SET LOCAL statement_timeout = '15s'; " +
        "SET LOCAL transaction_timeout = '30s';", ct);

    // SELECT endpoint cursor FOR UPDATE using targeted raw SQL.
    // Verify lease_generation.
    // Insert reconciliation operation using operationId.
    // Upsert payload/fetch evidence.
    // Apply accepted canonical mutation.
    // Insert deduplicated outbox rows.

    var xid = await ReadCurrentXidAsync(db, ct);

    try
    {
        await tx.CommitAsync(ct);
        return Committed(operationId);
    }
    catch (Exception ex) when (CouldBeUnknownCommit(ex))
    {
        return await ReconcileUnknownCommitAsync(operationId, xid, ct);
    }
});
~~~

The actual retry wrapper MUST distinguish "known rollback/transient" from "unknown commit". It MUST NOT wrap an ambiguous commit in a generic blind replay.

### 18.6 POSIX CAS publish pseudocode

~~~text
hash = sha256(original_bytes)
final = controlled_path(hash)
temp = create_temp_same_filesystem(final)

write_zstd(temp, original_bytes)
flush_user_buffers(temp)
fsync(temp)
publish_atomically_if_absent(temp, final)
fsync(parent_directory(final))
verify_stored_object(final, expected_metadata)

only now may PostgreSQL commit storage_ref = final
~~~

If final already exists, verify it and reuse it. Never replace mismatched content at a hash path.

## 19. Observability

Low-cardinality metrics:

- ingestion_claim_total{endpoint_kind,outcome};
- ingestion_retry_total{class};
- ingestion_unknown_commit_total;
- ingestion_duplicate_suppressed_total{kind};
- ingestion_stale_fenced_total{endpoint_kind};
- db_transaction_retry_total{sqlstate_class};
- db_deadlock_total;
- db_lock_timeout_total;
- outbox_depth{kind,state};
- outbox_oldest_age_seconds{kind};
- outbox_lease_expired_total{kind};
- outbox_poison_total{kind};
- cas_orphan_candidates;
- cas_missing_reference_total;
- cas_integrity_failure_total;
- raw_replica_lag_seconds;
- sealing_retry_total;
- restore_reference_failure_total.

Do not use job IDs, payload hashes, objective IDs, trace IDs or raw error text as metric labels.

Logs/traces SHOULD carry:

logical_job_id, attempt_id, fetch_id, reconciliation_operation_id, outbox_job_id, lease_generation, archive_revision, trace/span IDs and payload hash as structured fields.

## 20. Crash matrix

| Crash point | Durable state | Recovery |
|---|---|---|
| before claim commit | job scheduled | another worker claims |
| after claim commit, before HTTP | leased attempt in_progress | lease expires; new generation; old attempt abandoned |
| request sent, response unknown | same | retry GET after lease recovery; no claim of observed state |
| response received before raw durability | only attempt durable | response may be lost; retry; coverage gap remains honest |
| external temp write | unreferenced temp | cleanup after grace |
| CAS finalized before DB tx | orphan final object | reuse by hash or GC after grace/reference scan |
| DB tx before commit | no visible partial state | rollback on connection/session loss |
| commit sent, connection lost | outcome unknown | operation-ID reconciliation; optional pg_xact_status |
| commit succeeded, process dies before local ACK | committed operation/outbox visible | retry discovers operation already committed |
| outbox claimed, before effect | processing lease | lease expiry and retry |
| effect succeeds, before outbox completion | effect may exist, job processing | retry same dedup key/idempotent effect |
| offsite upload succeeds, before DB verify mark | remote object may exist | verify deterministic object and mark on retry |
| sealing artifacts published, final DB commit fails | orphan/unreferenced artifacts | reuse by hash or GC later |
| PITR restores DB older than CAS | extra CAS objects | harmless orphans |
| PITR restores DB newer than available offsite CAS | missing required evidence | recovery fails/degraded; choose earlier safe watermark |

## 21. Fault-injection acceptance tests

Before production, automated/integration tests MUST cover:

1. kill -9 after every durable ingestion transition;
2. kill connection immediately before/during/after COMMIT;
3. verify unknown commit resolves without duplicate canonical mutation;
4. two workers claim same logical job;
5. lease expires during slow HTTP and old response completes later;
6. out-of-order/stale generation cannot roll back endpoint state;
7. duplicate byte-identical 200;
8. different bytes/same semantic fingerprint;
9. 304 with valid prior representation;
10. 304 without a resolvable prior representation -> integrity/reconciliation failure;
11. map source version regression quarantine;
12. disk full/ENOSPC during temp/CAS publication;
13. corrupted existing CAS object at expected hash path;
14. concurrent writers publish same CAS hash;
15. outbox effect succeeds then worker dies before completion;
16. poison outbox retries reach terminal/dead-letter state without blocking unrelated work;
17. matcher/time-semantics reprocessing concurrent with live ingestion;
18. sealing run invalidated by new accepted input revision;
19. offsite archive outage and lag recovery;
20. PITR restore followed by complete DB-to-CAS verification.

Use real PostgreSQL integration tests (Testcontainers) for transaction/locking semantics. Toxiproxy or equivalent fault injection MAY be used for network cuts. Filesystem tests SHOULD include process kill and ENOSPC scenarios on Linux.

## 22. Rejected patterns

Chronicle MUST NOT:

- use captured_at/request time as the idempotency key;
- advertise exactly-once processing;
- hold a DB transaction open around HTTP or external storage;
- commit an external CAS reference before durable object publication;
- blindly retry an ambiguous COMMIT;
- rely on store-generated IDs for retryable logical operations;
- mark outbox done before its effect;
- treat LISTEN/NOTIFY as durable delivery;
- use ETag as payload identity;
- let stale lease holders update canonical state;
- use a lease without generation/fencing;
- delete newly orphaned CAS immediately;
- mutate a sealed manifest in place;
- treat successful backup creation as equivalent to a verified restore;
- restore PostgreSQL without validating external replay references;
- catch every exception and retry it generically;
- introduce PostgreSQL 2PC merely to coordinate Chronicle CAS/outbox work.

## 23. Production acceptance gate

The worker protocol is production-ready only when:

1. deterministic logical job and reconciliation operation identities are implemented;
2. endpoint cursor fencing prevents stale completion rollback;
3. reconciliation transaction boundaries match this specification;
4. unknown COMMIT is fault-injection tested;
5. CAS local publication uses durable file + directory semantics or an equivalently verified object-store adapter;
6. outbox is at-least-once with idempotent handlers and lease fencing;
7. reprocessing activation is versioned and atomic;
8. sealing is revisioned, idempotent and fenced;
9. PITR recovery uses a DB+CAS completeness check;
10. telemetry exposes duplicate suppression, stale fencing, unknown commit, outbox age, CAS integrity and recovery failures;
11. kill -9/network/disk-full/restore drills pass without duplicate canonical facts or silent missing evidence;
12. canonical write paths have not disabled PostgreSQL fsync/synchronous commit durability.
