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

## Phase 1.5 — Apps Script complexity reduction

The current Apps Script has a large request router, repeated persistence logic,
cross-calling services, and UI files that mix state, rendering, and API calls.
Reduce that complexity before adding more product behavior.

- Extract a shared `DocumentStore` for JSON properties, defaults, and safe parsing.
- Replace the large `handleApiRequest` switch with a grouped action registry.
- Separate actions into auth, CRUD, sheet, template, data-entry, and activity modules.
- Standardize success and error response shapes with stable error codes.
- Separate domain logic from Spreadsheet/PropertiesService side effects.
- Reduce global mutable state and make service dependencies explicit where practical.
- Split large HTML files into clearer API, state, rendering, and interaction sections.
- Add focused tests for the store, router, response model, and critical use cases.
- Preserve existing public function names while migrating callers incrementally.

This phase is complete only when the existing UI behavior remains intact and the
main router can be tested without executing unrelated services.

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
