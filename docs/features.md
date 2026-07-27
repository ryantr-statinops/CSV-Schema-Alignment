# Features

## MVP features

### Sheet-native workflow

Users start from an existing Google Sheet. The extension adds menus, a sidebar, and controlled operations without requiring them to build Apps Script code.

### Project configuration in the Sheet

Configuration is stored in dedicated tabs or named ranges inside the user's file. This keeps the project portable and avoids a backend configuration store.

### Bounded compute operations

The extension can send a selected range or compact profile to the Go engine for fast computation. Each operation declares its input, output, timeout, and size limit.

### Result synchronization

Results are written back into the same spreadsheet with clear status markers, timestamps, and human-readable errors.

### Privacy-first behavior

The product must communicate when data is sent for transient computation and must never silently persist spreadsheet contents.

### Testable local workflow

Existing files in `input/` and `output/` are local fixtures. They should test the same transformations without requiring a live Google account.

## Deferred features

| Feature | Reason to defer |
|---|---|
| Central project database | Conflicts with the user-owned data model |
| Generic arbitrary code execution | Security and abuse risk |
| Durable jobs containing user payloads | Requires a new privacy decision |
| Multi-user collaboration service | Google Sheets already provides sharing |

## Success criteria

- A new user can complete the main workflow from a Sheet sidebar.
- No business payload is retained by the backend.
- Failures are visible and recoverable from the spreadsheet.
- The same operation can be tested using local fixtures.
