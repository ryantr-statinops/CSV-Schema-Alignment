# Architecture

    Two or more CSV paths
            │
            ▼
    Python CSV reader and column profiler
            │ weighted pairwise similarities + one-to-one assignment
            ▼
    AlignmentPlan (editable names, source mappings, confidence scores)
            │ validate mappings, then export
            ▼
    UTF-8 vertically concatenated CSV

## Python library boundary

build_alignment_plan(files, infer_schema=True, sample_size=20) reads comma-delimited UTF-8/UTF-8-BOM CSV files and creates an ordered plan. Global inference compares each pair, then merges accepted edges only when a group contains at most one column per file. Reference mode uses the first file's headers and aligns every later file independently; unmatched later columns remain separate appended outputs.

The plan stores ordered absolute input paths and ordered PlannedColumn objects. Each planned column has an editable canonical name, a per-file source header or None, and per-file confidence (None when unmapped). to_dict() and from_dict() provide JSON-compatible review and persistence. Export validates names and mappings, rejects output/input path collisions, preserves source row ordering, and fills absent sources with empty strings.

Scoring reuses column profiling, weighted comparison, score fusion, existing assignment behavior, and the 0.35 minimum assignment confidence. The implementation uses only the Python standard library.

## Adapter boundary

appscript/ sources are retained unchanged. A Google Sheets adapter could later translate Sheet data into the library's input/output contract, but no adapter, HTTP endpoint, Go engine, or Sheets connection is implemented here. The Python library reads and writes local CSV paths only.
