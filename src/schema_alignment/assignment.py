from __future__ import annotations

from itertools import permutations
from typing import Any


def align_columns(
    left_names: list[str],
    right_names: list[str],
    matrix: list[list[float]],
    min_confidence: float = 0.35,
) -> tuple[list[dict[str, Any]], list[str], list[str]]:
    left_count = len(left_names)
    right_count = len(right_names)
    if left_count == 0 or right_count == 0:
        return [], list(left_names), list(right_names)

    # Exact maximum-weight assignment for small matrices.
    # This keeps the implementation dependency-free for now.
    if max(left_count, right_count) <= 8:
        return _exact_alignment(left_names, right_names, matrix, min_confidence=min_confidence)

    return _greedy_alignment(left_names, right_names, matrix, min_confidence=min_confidence)


def _exact_alignment(
    left_names: list[str],
    right_names: list[str],
    matrix: list[list[float]],
    min_confidence: float,
) -> tuple[list[dict[str, Any]], list[str], list[str]]:
    left_count = len(left_names)
    right_count = len(right_names)
    best_score = float("-inf")
    best_pairs: list[tuple[int, int]] = []

    if left_count <= right_count:
        for cols in permutations(range(right_count), left_count):
            score = sum(matrix[i][cols[i]] for i in range(left_count))
            if score > best_score:
                best_score = score
                best_pairs = list(enumerate(cols))
    else:
        for rows in permutations(range(left_count), right_count):
            score = sum(matrix[rows[j]][j] for j in range(right_count))
            if score > best_score:
                best_score = score
                best_pairs = [(rows[j], j) for j in range(right_count)]

    used_left = set()
    used_right = set()
    assignments: list[dict[str, Any]] = []
    for left_idx, right_idx in best_pairs:
        score = matrix[left_idx][right_idx]
        if score < min_confidence:
            continue
        used_left.add(left_idx)
        used_right.add(right_idx)
        assignments.append(
            {
                "left": left_names[left_idx],
                "right": right_names[right_idx],
                "score": score,
            }
        )

    unmatched_left = [name for idx, name in enumerate(left_names) if idx not in used_left]
    unmatched_right = [name for idx, name in enumerate(right_names) if idx not in used_right]
    return assignments, unmatched_left, unmatched_right


def _greedy_alignment(
    left_names: list[str],
    right_names: list[str],
    matrix: list[list[float]],
    min_confidence: float,
) -> tuple[list[dict[str, Any]], list[str], list[str]]:
    used_right: set[int] = set()
    assignments: list[dict[str, Any]] = []
    unmatched_left: list[str] = []

    left_order = sorted(
        range(len(left_names)),
        key=lambda i: max(matrix[i]) if i < len(matrix) and matrix[i] else -1.0,
        reverse=True,
    )

    for left_idx in left_order:
        left_name = left_names[left_idx]
        row = matrix[left_idx] if left_idx < len(matrix) else []
        best_idx = None
        best_score = -1.0
        for right_idx, score in enumerate(row):
            if right_idx in used_right:
                continue
            if score > best_score:
                best_score = score
                best_idx = right_idx
        if best_idx is None or best_score < min_confidence:
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
