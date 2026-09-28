# CSV Schema Alignment

This repository's primary product is a Python library for aligning schemas from two or more CSV files and vertically concatenating their rows into one CSV. The library has no network service, persistent data store, or Google authentication.

## Workflow

1. Build an AlignmentPlan with global inference or first-file reference mode.
2. Review, rename, or edit planned output columns; serialize with to_dict() for JSON-compatible persistence, and restore with from_dict().
3. Export the plan to UTF-8 CSV. Rows remain in input-file order and original row order; unmapped values are blank.

The CLI prints the generated plan summary or exports it with --output. Programmatic plan review/editing uses the library API.

## Repository boundaries

- src/schema_alignment/: Python alignment, editable plan, and CSV export.
- scripts/demo_match.py: local multi-file example using sorted CSV files in input/.
- appscript/: retained Apps Script sources; untouched by this change and not connected to the Python library.
- Google Sheets integration: a future adapter, not current behavior.

See architecture.md, features.md, and plan.md.
