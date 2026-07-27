# Rebuild plan

## Phase 0 — Documentation and contract

- Establish the SheetFlow product boundary and privacy promise.
- Separate product docs from local fixtures and historical notes.
- Define the first operation and request/response contract.
- Record what data may leave the Sheet and what is never retained.

## Phase 1 — Apps Script client

- Identify current public functions and preserve compatible entry points where practical.
- Split UI, Sheet I/O, API client, configuration, and test helpers.
- Add a request wrapper with request IDs, timeout handling, and structured errors.
- Keep user configuration in spreadsheet tabs, named ranges, or Script Properties.

## Phase 2 — Stateless Go engine

- Create a small `net/http` service with `/healthz` and `/v1/compute`.
- Add operation allowlisting, payload limits, authentication, and timeouts.
- Implement computation handlers independently from transport code.
- Ensure logs contain metadata only and never request/response contents.
- Add unit tests and fixture-based integration tests.

## Phase 3 — End-to-end MVP

- Run one complete workflow from sidebar to Sheet result.
- Test empty, oversized, malformed, and retry scenarios.
- Document transient processing in the user guide.
- Add deployment and clasp release instructions.

## Explicit non-goals

- No central storage of spreadsheet data.
- No silent telemetry containing business values.
- No arbitrary remote execution.
- No durable queue containing user payloads in the MVP.
