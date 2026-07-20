from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import csv

from .assignment import align_columns
from .fusion import fuse_scores
from .profiling import profile_columns
from .similarity import compare_columns


@dataclass(slots=True)
class MatchResult:
    left_path: Path
    right_path: Path
    assignments: list[dict[str, Any]] = field(default_factory=list)
    similarity_matrix: list[list[float]] = field(default_factory=list)
    unmatched_left: list[str] = field(default_factory=list)
    unmatched_right: list[str] = field(default_factory=list)

    def to_text(self) -> str:
        lines = [
            f"Left: {self.left_path}",
            f"Right: {self.right_path}",
            "",
            "Assignments:",
        ]
        if not self.assignments:
            lines.append("  (none)")
        else:
            for item in self.assignments:
                lines.append(
                    f"  {item['left']} -> {item['right']}  score={item['score']:.3f}"
                )
        if self.unmatched_left:
            lines.extend(["", "Unmatched left:"])
            lines.extend(f"  - {name}" for name in self.unmatched_left)
        if self.unmatched_right:
            lines.extend(["", "Unmatched right:"])
            lines.extend(f"  - {name}" for name in self.unmatched_right)
        if self.similarity_matrix:
            lines.extend(["", "Similarity matrix:"])
            for row in self.similarity_matrix:
                lines.append("  " + ", ".join(f"{score:.3f}" for score in row))
        return "\n".join(lines)


def _read_csv_columns(path: Path) -> dict[str, list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        columns: dict[str, list[str]] = {name: [] for name in (reader.fieldnames or [])}
        for row in reader:
            for name in columns:
                columns[name].append(row.get(name, "") or "")
    return columns


def _read_csv_rows(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        rows = [{name: (row.get(name, "") or "") for name in fieldnames} for row in reader]
    return fieldnames, rows


def match_csv_files(left_csv: Path, right_csv: Path, sample_size: int = 20) -> MatchResult:
    left_columns = _read_csv_columns(left_csv)
    right_columns = _read_csv_columns(right_csv)

    left_profile = profile_columns(left_columns, sample_size=sample_size)
    right_profile = profile_columns(right_columns, sample_size=sample_size)

    matrix, _pairs = compare_columns(left_profile, right_profile)
    fused = fuse_scores(matrix)
    assignments, unmatched_left, unmatched_right = align_columns(
        list(left_profile.keys()),
        list(right_profile.keys()),
        fused,
    )

    return MatchResult(
        left_path=left_csv,
        right_path=right_csv,
        assignments=assignments,
        similarity_matrix=fused,
        unmatched_left=unmatched_left,
        unmatched_right=unmatched_right,
    )


def merge_csv_files(
    left_csv: Path,
    right_csv: Path,
    output_csv: Path,
    sample_size: int = 20,
) -> tuple[MatchResult, Path]:
    match_result = match_csv_files(left_csv, right_csv, sample_size=sample_size)
    left_fields, left_rows = _read_csv_rows(left_csv)
    right_fields, right_rows = _read_csv_rows(right_csv)

    right_to_left = {
        item["right"]: item["left"]
        for item in match_result.assignments
    }

    canonical_fields: list[str] = []
    for name in left_fields:
        if name not in canonical_fields:
            canonical_fields.append(name)
    for name in right_fields:
        canonical_name = right_to_left.get(name, name)
        if canonical_name not in canonical_fields:
            canonical_fields.append(canonical_name)

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["_source_file"] + canonical_fields)
        writer.writeheader()

        def write_rows(source_name: str, fields: list[str], rows: list[dict[str, str]]) -> None:
            for row in rows:
                merged: dict[str, str] = {"_source_file": source_name}
                for field in fields:
                    target_field = right_to_left.get(field, field) if source_name == right_csv.name else field
                    merged[target_field] = row.get(field, "")
                writer.writerow({name: merged.get(name, "") for name in ["_source_file"] + canonical_fields})

        write_rows(left_csv.name, left_fields, left_rows)
        write_rows(right_csv.name, right_fields, right_rows)

    return match_result, output_csv
