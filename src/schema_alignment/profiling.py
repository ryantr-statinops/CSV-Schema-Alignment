from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from .normalization import normalize_header


@dataclass(slots=True)
class ColumnProfile:
    name: str
    normalized_name: str
    sample_values: list[str]
    null_ratio: float
    unique_ratio: float
    average_length: float
    datatype: str


def _detect_datatype(values: Iterable[str]) -> str:
    non_empty = [value for value in values if value.strip()]
    if not non_empty:
        return "empty"
    if all(value.isdigit() for value in non_empty):
        return "integer"
    return "text"


def profile_columns(columns: dict[str, list[str]], sample_size: int = 20) -> dict[str, ColumnProfile]:
    profiles: dict[str, ColumnProfile] = {}
    for name, values in columns.items():
        sample = values[:sample_size]
        non_empty = [value for value in sample if value.strip()]
        null_ratio = 0.0 if not sample else (len(sample) - len(non_empty)) / len(sample)
        unique_ratio = 0.0 if not non_empty else len(set(non_empty)) / len(non_empty)
        average_length = 0.0 if not non_empty else sum(len(v) for v in non_empty) / len(non_empty)
        profiles[name] = ColumnProfile(
            name=name,
            normalized_name=normalize_header(name),
            sample_values=sample,
            null_ratio=null_ratio,
            unique_ratio=unique_ratio,
            average_length=average_length,
            datatype=_detect_datatype(sample),
        )
    return profiles

