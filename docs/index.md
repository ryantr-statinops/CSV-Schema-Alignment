# SheetFlow

SheetFlow is a privacy-first Google Sheets extension for running structured workflows and compute-heavy operations without taking ownership of the user's data.

## Product principle

The user's Google Sheet remains the source of truth. Apps Script reads and writes the spreadsheet; the optional Go engine performs short-lived computation and returns the result. The backend does not store business data.

## Product boundaries

- `appscript/`: Google Sheets client, UI integration, and thin SDK.
- `backend/`: stateless compute and orchestration service.
- Google Sheets: user-owned data layer.
- `input/` and `output/`: local test fixtures and generated artifacts.

## MVP

1. Open a SheetFlow-enabled Google Sheet.
2. Select an operation from the sidebar.
3. Read only the required range from the user's spreadsheet.
4. Validate and process the request.
5. Write the result back to the same spreadsheet.
6. Show clear status and error messages.

See [architecture.md](architecture.md), [features.md](features.md), and [plan.md](plan.md).
