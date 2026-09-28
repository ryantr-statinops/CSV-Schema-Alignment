# Product plan

## Current: Python CSV alignment library

- Align schemas for two or more comma-delimited CSV files using global inference or first-file reference mode.
- Expose an editable AlignmentPlan with canonical names, per-input source headers, confidence scores, and JSON-compatible serialization.
- Export vertically concatenated UTF-8 CSV, preserving file and row order, filling unmapped cells with blanks, and optionally adding _source_file.
- Provide a multi-file CLI and local demo.
- Keep implementation dependency-free and validate input and edited-plan mappings before export.

## Integration boundary

The Python library reads and writes CSV paths. Existing appscript/ code remains unchanged and is not connected to the library. A Google Sheets adapter is future work and requires a separate integration design; no Go backend or HTTP service is part of the current product.

## Explicit non-goals

- XLSX, Google Sheets, or network-backed inputs/outputs in the current library.
- Interactive CLI plan editing; use the mutable plan API and its JSON-compatible representation.
- Remote computation, central data storage, or Google authentication.
