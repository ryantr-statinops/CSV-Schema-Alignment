from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

from .normalization import normalize_header

_DATE_RE = re.compile(r"^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$")
_PHONE_RE = re.compile(r"^0\d{9,10}$")
_URL_RE = re.compile(r"^https?://", re.IGNORECASE)
_PRICE_RE = re.compile(r"^[\d.]+$")


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
    non_empty_strs = [v for v in non_empty if v.strip()]
    if all(_DATE_RE.match(v) for v in non_empty_strs):
        return "date"
    if all(_PHONE_RE.match(v) for v in non_empty_strs):
        return "phone"
    if all(_URL_RE.match(v) for v in non_empty_strs):
        return "url"
    if all(v.isdigit() for v in non_empty_strs):
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

