from __future__ import annotations


def fuse_scores(matrix: list[list[float]]) -> list[list[float]]:
    return [[max(0.0, min(1.0, value)) for value in row] for row in matrix]

