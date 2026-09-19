# ADR — Idempotent ingestion, transaction boundaries and crash recovery

Status: **Accepted — 2026-09-19**

## Context

Chronicle collects transient public source state that may be impossible to retrieve again. The worker also spans PostgreSQL, external content-addressed raw storage, offsite replication and derived work. Process death, network interruption and duplicate execution are normal failure modes, not exceptional architecture cases.

The previous specifications selected hybrid raw storage and PostgreSQL transactional outbox but did not fully define unknown-COMMIT handling, stale-worker fencing, durable worker states or crash-point recovery.

## Decision

Chronicle adopts the protocol in [IDEMPOTENCY_RECOVERY.md](../IDEMPOTENCY_RECOVERY.md).

Core decisions:

1. no exactly-once claim;
2. logical collection jobs are separate from attempts and HTTP fetches;
3. deterministic job/reconciliation identities and unique constraints provide idempotency;
4. HTTP/external storage are outside PostgreSQL transactions;
5. external CAS is durably published before DB references commit;
6. canonical reconciliation uses short READ COMMITTED transactions with explicit endpoint cursor locking;
7. lease_generation fences stale workers;
8. unknown COMMIT is reconciled by operation ID, with PostgreSQL pg_xact_status as optional supplemental evidence;
9. downstream work uses PostgreSQL transactional outbox with at-least-once handlers;
10. LISTEN/NOTIFY is wake-up only;
11. reprocessing and sealing are versioned, idempotent and fenced;
12. complete PITR recovery verifies DB-to-CAS referential completeness.

## Consequences

Positive:

- retries and worker crashes cannot silently duplicate canonical facts;
- stale responses cannot roll current state backward;
- no distributed transaction/2PC is required between PostgreSQL and CAS;
- orphan external objects are safe and collectible;
- outbox duplicate delivery is explicit and testable;
- sealing and reprocessing have deterministic recovery behavior.

Costs:

- more durable metadata rows for jobs/attempts/operations;
- handlers must carry dedup/fingerprint semantics;
- fault-injection testing becomes a production gate;
- CAS adapters must implement real durability/integrity semantics rather than plain file write/PUT wrappers.

## Rejected alternatives

- timestamp-based idempotency;
- transaction spanning HTTP/CAS;
- PostgreSQL 2PC for CAS coordination;
- session advisory locks as durable ownership;
- global SERIALIZABLE isolation by default;
- broker introduction solely to obtain an exactly-once claim;
- LISTEN/NOTIFY as durable queue;
- mutable sealed manifests.
