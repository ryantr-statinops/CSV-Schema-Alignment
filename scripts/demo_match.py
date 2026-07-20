from __future__ import annotations

from pathlib import Path
import sys

sys.path.insert(0, "src")

try:
    sys.stdout.reconfigure(encoding="utf-8")
except AttributeError:
    pass

from schema_alignment.pipeline import match_csv_files
from schema_alignment.pipeline import merge_csv_files


def main() -> None:
    input_dir = Path("input")
    csv_files = sorted(input_dir.glob("*.csv"))
    if len(csv_files) < 2:
        raise SystemExit("Need at least two CSV files in input/")

    result = match_csv_files(csv_files[0], csv_files[1])
    print(result.to_text())

    output_csv = Path("output") / "merged.csv"
    merge_result, written_path = merge_csv_files(csv_files[0], csv_files[1], output_csv)
    print()
    print(f"Merged CSV written to: {written_path}")
    print(f"Assignments used: {len(merge_result.assignments)}")


if __name__ == "__main__":
    main()
