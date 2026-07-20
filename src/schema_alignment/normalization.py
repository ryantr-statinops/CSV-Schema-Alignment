from __future__ import annotations

import re
import unicodedata


_ABBREVIATIONS = {
    "sdt": "so_dien_thoai",
    "sđt": "so_dien_thoai",
    "hv": "hoc_vien",
    "fb": "facebook",
}


def remove_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def normalize_header(text: str) -> str:
    cleaned = remove_accents(text).lower()
    cleaned = re.sub(r"[^\w\s]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    tokens = [ _ABBREVIATIONS.get(token, token) for token in cleaned.split() ]
    return " ".join(tokens)

