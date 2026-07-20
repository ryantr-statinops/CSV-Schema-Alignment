from __future__ import annotations

from dataclasses import dataclass
from typing import Any


def align_columns(
    left_names: list[str],
    right_names: list[str],
    matrix: list[list[float]],
) -> tuple[list[dict[str, Any]], list[str], list[str]]:
    used_right: set[int] = set()
    assignments: list[dict[str, Any]] = []
    unmatched_left: list[str] = []

    for left_idx, left_name in enumerate(left_names):
        best_idx = None
        best_score = -1.0
        for right_idx, score in enumerate(matrix[left_idx] if left_idx < len(matrix) else []):
            if right_idx in used_right:
                continue
            if score > best_score:
                best_score = score
                best_idx = right_idx
        if best_idx is None:
            unmatched_left.append(left_name)
            continue
        used_right.add(best_idx)
        assignments.append(
            {
                "left": left_name,
                "right": right_names[best_idx],
                "score": best_score,
            }
        )

    unmatched_right = [name for idx, name in enumerate(right_names) if idx not in used_right]
    return assignments, unmatched_left, unmatched_right

