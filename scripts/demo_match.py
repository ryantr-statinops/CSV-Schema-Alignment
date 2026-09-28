from __future__ import annotations

from pathlib import Path
import sys

sys.path.insert(0, "src")

try:
    sys.stdout.reconfigure(encoding="utf-8")
except AttributeError:
    pass

from schema_alignment import build_alignment_plan, export_aligned_csv


def main() -> None:
    input_dir = Path("input")
    csv_files = sorted(input_dir.glob("*.csv"))
    if len(csv_files) < 2:
        raise SystemExit("Need at least two CSV files in input/")

    plan = build_alignment_plan(csv_files)
    print(f"Alignment plan: {len(plan.files)} files, {len(plan.columns)} output columns")

    output_csv = Path("output") / "merged.csv"
    written_path = export_aligned_csv(plan, output_csv)
    print()
    print(f"Merged CSV written to: {written_path}")


if __name__ == "__main__":
    main()
