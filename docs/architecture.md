# Architecture

```text
Google Sheet owned by user
        │ read/write
        ▼
Apps Script Library + sidebar
        │ HTTPS request with bounded payload
        ▼
Stateless Go Engine
        │ ephemeral computation only
        ▼
Response written back to the same Google Sheet
```

The backend is not a database and is not the system of record. It must not persist spreadsheet contents, request bodies, or derived business data.

## Responsibilities

| Component | Responsibility |
|---|---|
| Apps Script | Menus, sidebar, spreadsheet reads/writes, user-facing errors |
| Go engine | Validation, computation, orchestration, bounded retries |
| Google Sheet | User-owned source of truth and result surface |
| Local fixtures | Reproducible tests and sample workflows |
| Observability | Request ID, duration, status, and error class only |

## Request lifecycle

1. Apps Script reads only the ranges required by the selected operation.
2. It sends a versioned request with an operation name and request ID.
3. The Go engine validates the schema and applies a strict timeout and size cap.
4. Computation happens in memory.
5. The response contains results or a structured error.
6. Apps Script writes the result to the user's spreadsheet.

## Privacy constraints

- Never log request or response bodies.
- Never persist business data in a database, queue, object store, or cache.
- Keep payloads in memory and discard them after the request.
- Prefer Sheet-native execution when data must never leave Google Sheets.

## Initial API

```http
POST /v1/compute
```

```json
{
  "operation": "schema.align",
  "request_id": "uuid",
  "input": {}
}
```

Operations must be allowlisted. Arbitrary code execution and generic proxying are outside the MVP boundary.
