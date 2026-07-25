from __future__ import annotations

import re
import unicodedata


_ABBREVIATIONS = {
    "sdt": "so dien thoai",
    "sđt": "so dien thoai",
    "hv": "hoc vien",
    "fb": "facebook",
    "tvv": "tu van vien",
}

_SYNONYM_MAP = {
    "hinh thuc": "kenh hoc",
}


def remove_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def normalize_header(text: str) -> str:
    cleaned = remove_accents(text).lower()
    cleaned = re.sub(r"[^\w\s]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    tokens = [_ABBREVIATIONS.get(token, token) for token in cleaned.split()]
    normalized = " ".join(tokens)
    return _SYNONYM_MAP.get(normalized, normalized)

