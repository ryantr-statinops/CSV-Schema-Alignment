from __future__ import annotations

import argparse
import json
from pathlib import Path

from . import build_alignment_plan, export_aligned_csv


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Align schemas across multiple CSV files.")
    parser.add_argument("csv_files", nargs="+", type=Path, help="Two or more input CSV files")
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional path to write the vertically concatenated aligned CSV",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=20,
        help="Number of rows to sample from each column when computing value similarity",
    )
    parser.add_argument(
        "--no-infer-schema",
        action="store_true",
        help="Use the first input file's headers and order as the reference schema",
    )
    parser.add_argument(
        "--include-source-file",
        action="store_true",
        help="Add each input basename in a leading _source_file field",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if len(args.csv_files) < 2:
        parser.error("at least two input CSV files are required")

    plan = build_alignment_plan(
        args.csv_files,
        infer_schema=not args.no_infer_schema,
        sample_size=args.sample_size,
    )
    if args.output:
        output_csv = export_aligned_csv(plan, args.output, include_source_file=args.include_source_file)
        print(json.dumps(plan.to_dict(), ensure_ascii=False, indent=2))
        print()
        print(f"Aligned CSV written to: {output_csv}")
        return
    print(json.dumps(plan.to_dict(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
