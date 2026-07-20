from __future__ import annotations

from difflib import SequenceMatcher

from .profiling import ColumnProfile


def header_similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, left, right).ratio()


def value_similarity(left: ColumnProfile, right: ColumnProfile) -> float:
    left_values = {value.strip().lower() for value in left.sample_values if value.strip()}
    right_values = {value.strip().lower() for value in right.sample_values if value.strip()}
    if not left_values or not right_values:
        return 0.0
    overlap = len(left_values & right_values)
    union = len(left_values | right_values)
    return overlap / union if union else 0.0


def datatype_similarity(left: ColumnProfile, right: ColumnProfile) -> float:
    return 1.0 if left.datatype == right.datatype else 0.0


def profile_similarity(left: ColumnProfile, right: ColumnProfile) -> float:
    return 1.0 - min(abs(left.average_length - right.average_length) / 50.0, 1.0)


def compare_columns(
    left_profiles: dict[str, ColumnProfile],
    right_profiles: dict[str, ColumnProfile],
):
    left_names = list(left_profiles.keys())
    right_names = list(right_profiles.keys())
    matrix: list[list[float]] = []
    for left_name in left_names:
        row: list[float] = []
        left = left_profiles[left_name]
        for right_name in right_names:
            right = right_profiles[right_name]
            score = (
                0.35 * header_similarity(left.normalized_name, right.normalized_name)
                + 0.35 * value_similarity(left, right)
                + 0.15 * datatype_similarity(left, right)
                + 0.15 * profile_similarity(left, right)
            )
            row.append(score)
        matrix.append(row)
    return matrix, (left_names, right_names)

