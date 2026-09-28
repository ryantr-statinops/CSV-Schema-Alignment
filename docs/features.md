# Features

## Available

### Multi-file schema planning

Build an editable plan for two or more CSV files. Global inference groups columns using all file pairs while preventing two columns from one input from entering the same group. First-file reference mode retains that file's header order, maps later files independently, and appends unmatched later-file columns separately.

### Reviewable plans

AlignmentPlan and PlannedColumn are mutable slotted dataclasses. Canonical names can be edited before export. to_dict() / from_dict() support JSON-compatible review and persistence. Per-input mappings identify the source header or None; confidence is None for unmapped sources.

### Vertical CSV export

Export uses the plan's output-column order, input-file order, and original row order. Unmapped source fields produce blank cells. Output uses UTF-8 and standard CSV quoting, and parent directories are created. A leading _source_file basename field is optional and off by default.

### Validation

The library requires at least two distinct inputs, positive sample size, a header row, and unique input headers. Export checks nonempty inputs/columns, unique canonical names, valid per-file headers, no repeated source-header mapping in a file, and no output path equal to an input path.

### Local demo and CLI

The CLI accepts multiple positional CSV files, supports global/reference mode selection, plan-summary output, and CSV export. scripts/demo_match.py reads all sorted CSV files from input/ and writes output/merged.csv.

## Deferred

- Google Sheets adapter and Apps Script integration.
- Any HTTP service, Go engine, authentication, or remote computation.
- XLSX and non-CSV formats.
- Interactive plan editing in the CLI; the Python plan API is the editing surface.
