# Multi-file CSV schema alignment Python library

## Context

Replace the current two-CSV matching workflow as the repository's primary product with a Python library that aligns schemas for two or more CSV files and exports one vertically concatenated CSV. The library supports global schema inference with an editable plan, or a first-file reference mode; Google Sheets remains a separate future adapter, and the existing Apps Script code stays untouched in this change.

## Approach

0. Before code changes, create docs/plan/ and write a verbatim copy of the approved canonical plan to docs/plan/multi-csv-schema-alignment.md. This is the requested repository-visible plan; do not overwrite the existing docs/plan.md.
1. In [1msrc/schema_alignment/pipeline.py[0m, replace the two-file [1mmatch_csv_files[0m / [1mmerge_csv_files[0m flow and [1mMatchResult[0m with the public library API:
   - [1mbuild_alignment_plan(files: Sequence[str | Path], *, infer_schema: bool = True, sample_size: int = 20) -> AlignmentPlan[0m
   - [1mexport_aligned_csv(plan: AlignmentPlan, output_path: str | Path, *, include_source_file: bool = False) -> Path[0m
   - [1mAlignmentPlan.to_dict() -> dict[str, object][0m and [1mAlignmentPlan.from_dict(data: Mapping[str, object]) -> AlignmentPlan[0m for JSON-compatible review/edit/persistence. Define mutable slotted [1mAlignmentPlan[0m and [1mPlannedColumn[0m dataclasses. Plan fields: ordered absolute input paths, [1minfer_schema[0m, and ordered columns; each planned column has a mutable canonical [1mname[0m, a per-input-path [1msources[0m map whose value is an input header or [1mNone[0m, and per-input confidence scores (null for unmapped columns).
   - Reuse [1mprofile_columns[0m, [1mcompare_columns[0m, [1mfuse_scores[0m, [1malign_columns[0m, and [1mnormalize_header[0m. Keep the current weighted similarity and 0.35 minimum assignment confidence; do not add dependencies.
   - Parse input CSVs as UTF-8-with-BOM compatible, comma-delimited CSV using the existing [1mcsv[1m.DictReader[0m behavior. Require at least two distinct input paths, positive [1msample_size[0m, a header row, and unique headers per file; raise a clear [1mValueError[0m for these invalid inputs. Let filesystem errors retain their native exception and path.
   - For [1minfer_schema=True[0m, profile every file, score and one-to-one assign every pair of files with the existing comparator/assignment. Sort accepted pair edges by descending score, then input-file and header order; union groups only when they have no two columns from the same file. Every ungrouped source column is a singleton. Order output groups by their earliest input-file/header position; use that earliest header as the editable proposed name. This deterministic global grouping avoids choosing one file as the hidden reference.
   - For [1minfer_schema=False[0m, use the first file's headers and order as the reference; align every later file independently to the first via existing scores/assignment. Keep every unmatched later-file column as a separate appended planned output column, even if another later file has a normalized-equivalent extra; its source map is populated only for its originating file and rows from all other files are blank. Append extras in input-file/header order. The first reference file's unmatched fields do not occur in this mode because every reference field is itself an output column.
   - Ensure generated canonical names are unique: keep the proposed header when unique; for a collision append [1m [<source basename>][0m, then [1m #2[0m, [1m #3[0m, etc. until unique. Users may edit these names in the plan.
   - Validate edited plans before export: files/columns nonempty, unique output names, each source path belongs to plan.files, mapped input header exists, and one source header is not mapped to two output columns in the same file. Reject an output path resolving to any input path. Raise clear [1mValueError[0m; do not silently discard or overwrite data.
   - Export rows in input-file order and original row order. Map source values to planned output fields; fill absent source fields with empty strings. Output canonical columns in plan order, UTF-8, standard CSV quoting, and create the output parent directory as the existing merge path does. If [1minclude_source_file=True[0m, add [1m_source_file[0m as the first output field with the input basename for each row; default is false. If this reserved field name collides with a canonical name, raise [1mValueError[0m.
2. In [1msrc/schema_alignment/__init__.py[0m, export [1mAlignmentPlan[0m, [1mPlannedColumn[0m, [1mbuild_alignment_plan[0m, and [1mexport_aligned_csv[0m from the package. Remove the CLI-only [1m__all__[0m contract; update in-repository consumers rather than keeping aliases for the removed two-file API.
3. In [1msrc/schema_alignment/cli.py[0m, accept two or more positional CSV paths, retain [1m--output[0m and [1m--sample-size[0m (default 20), add [1m--no-infer-schema[0m and [1m--include-source-file[0m (default false), and route through the new public API. With [1m--output[0m export the generated plan; without it print the generated plan summary. Reject fewer than two inputs via argparse. The library plan API, rather than an interactive CLI, is the review/edit integration surface.
4. Migrate [1mscripts/demo_match.py[0m to pass every sorted CSV from [1minput/[0m through the new API and produce [1moutput/merged.csv[0m. Keep the existing useful error when fewer than two input CSVs are present. The existing Apps Script sources are retained unchanged; do not add an HTTP service or Go engine in this scope.
5. Add [1mtests/test_pipeline.py[0m using stdlib [1munittest[0m and temporary CSV fixtures. Cover a 3-file inferred group, first-file reference order and per-file extras at the far right with blanks for absent files, keeping same-normalized extras from different later files separate in reference mode, editable/JSON-roundtripped plans, vertical row concatenation and missing values, the opt-in source column, and input/plan validation errors. Replace no existing test suite; none exists for the Python package.
6. Replace the misleading SheetFlow/Go product framing in [1mREADME.md[0m and [1mdocs/index.md[0m, [1mdocs/architecture.md[0m, [1mdocs/features.md[0m, and [1mdocs/plan.md[0m with the Python library contract, both schema modes, the editable plan/export workflow, CSV output behavior, and the deferred Apps Script adapter boundary. Leave [1mappscript/[0m code unchanged and do not claim the Python library is already connected to Google Sheets.

## Critical files & anchors

- [1msrc/schema_alignment/pipeline.py[0m — current [1mMatchResult[0m and two-file read/match/merge pipeline to replace.
- [1msrc/schema_alignment/assignment.py[0m — retain exact (up to 8 columns) / greedy assignment behavior and its confidence threshold.
- [1msrc/schema_alignment/cli.py[0m — current two-positional-argument parser and calls to removed API.
- [1mscripts/demo_match.py[0m — only other in-repo caller of the removed API.
- [1mdocs/architecture.md[0m — currently promises an absent stateless Go backend; replace with actual library boundaries.

## Verification

- Run [1mPYTHONPATH=src python3 -m unittest discover -s tests -v[0m from repository root.
- Run [1mPYTHONPATH=src python3 -m schema_alignment.cli --help[0m and confirm multiple positional inputs and the new mode/provenance options appear.
- End-to-end smoke: create three temporary CSVs with headers [1mname,phone[0m; [1mfull_name,phone_number,region[0m; and [1mcontact_name,phone,extra[0m. Build a plan with [1minfer_schema=True[0m, rename one planned canonical field, serialize/deserialize the plan, export it, and assert the output contains one data row per input row with the renamed shared fields aligned and blank values where a source has no mapped column. Repeat with [1minfer_schema=False[0m and assert first-file columns stay first, later-file extras remain distinct at the far right, and absent-file rows are blank in those columns. Confirm [1m_source_file[0m is absent by default and present only when explicitly enabled.
- Run the demo against a temporary [1minput/[0m containing at least two CSVs and observe that it writes a multi-file merged CSV; no repository fixture files are required.

## Assumptions & contingencies

- CSV, not XLSX/Sheets, is the library's initial input and output format; use only Python standard library dependencies.
- Input list order is significant only for [1minfer_schema=False[0m reference selection, stable output order, and deterministic tie-breaking.
- The editable [1mAlignmentPlan[0m is the human-configuration boundary; no UI, persistent config store, HTTPS service, or Google authentication is part of this change.
- If the existing similarity/assignment code cannot accept empty-data columns, keep header comparison usable and assign such columns as unmatched singleton/extras rather than dropping them.
