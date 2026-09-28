# CSV Schema Alignment

A dependency-free Python library for aligning headers across two or more CSV files and exporting one vertically concatenated CSV.

## Schema modes

- **Global inference** (default): compares every file pair and groups compatible columns without selecting one file as a hidden reference. Groups follow earliest file/header order; the earliest header is the proposed canonical name.
- **First-file reference**: retains the first file's headers and order, aligns each later file to it, then appends each unmatched later-file header as its own column. Extras from different files are not merged, even when normalized headers are equivalent.

Both modes produce an editable AlignmentPlan; rename or otherwise edit its columns, then persist/review it with to_dict() and from_dict() before export.

## Library usage

    from schema_alignment import build_alignment_plan, export_aligned_csv
    plan = build_alignment_plan(["customers.csv", "leads.csv"])
    plan.columns[0].name = "Customer name"
    export_aligned_csv(plan, "output/combined.csv", include_source_file=True)

Import AlignmentPlan, PlannedColumn, build_alignment_plan, and export_aligned_csv from schema_alignment. Inputs are stored as absolute paths. Inputs are comma-delimited UTF-8/UTF-8-BOM CSV files with unique headers; at least two distinct files and a positive sample size are required. Similarity uses the existing weighted header/value/profile scoring and 0.35 assignment threshold.

Output rows retain input-file order and each file's row order. Unmapped fields are empty. Output is UTF-8 CSV with standard quoting; parent directories are created. _source_file is omitted unless explicitly requested, and a conflicting canonical name is rejected.

## CLI

Two or more CSVs may be passed positionally:

    PYTHONPATH=src python3 -m schema_alignment.cli --help
    PYTHONPATH=src python3 -m schema_alignment.cli first.csv second.csv third.csv
    PYTHONPATH=src python3 -m schema_alignment.cli --no-infer-schema --include-source-file --output output/merged.csv first.csv second.csv

Without --output, the CLI prints the generated plan as JSON. The library plan API is the review/edit integration surface; the CLI does not provide interactive plan editing.

## Development

    PYTHONPATH=src python3 -m unittest discover -s tests -v
    python3 scripts/demo_match.py

appscript/ remains a separate codebase. A Google Sheets adapter is deferred; this library does not connect to Sheets or send data to a service.
