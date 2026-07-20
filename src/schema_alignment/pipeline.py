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
        return "\n".join(lines)


def _read_csv_columns(path: Path) -> dict[str, list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        columns: dict[str, list[str]] = {name: [] for name in (reader.fieldnames or [])}
        for row in reader:
            for name in columns:
                columns[name].append(row.get(name, "") or "")
    return columns


def match_csv_files(left_csv: Path, right_csv: Path, sample_size: int = 20) -> MatchResult:
    left_columns = _read_csv_columns(left_csv)
    right_columns = _read_csv_columns(right_csv)

    left_profile = profile_columns(left_columns, sample_size=sample_size)
    right_profile = profile_columns(right_columns, sample_size=sample_size)

    matrix, pairs = compare_columns(left_profile, right_profile)
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

