from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path
from collections.abc import Mapping, Sequence

from .assignment import align_columns
from .fusion import fuse_scores
from .profiling import profile_columns
from .similarity import compare_columns


@dataclass(slots=True)
class PlannedColumn:
    name: str
    sources: dict[str, str | None] = field(default_factory=dict)
    confidence: dict[str, float | None] = field(default_factory=dict)


@dataclass(slots=True)
class AlignmentPlan:
    files: list[str]
    infer_schema: bool
    columns: list[PlannedColumn]

    def to_dict(self) -> dict[str, object]:
        return {
            "files": list(self.files),
            "infer_schema": self.infer_schema,
            "columns": [
                {
                    "name": column.name,
                    "sources": dict(column.sources),
                    "confidence": dict(column.confidence),
                }
                for column in self.columns
            ],
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, object]) -> AlignmentPlan:
        try:
            raw_files = data["files"]
            raw_infer_schema = data["infer_schema"]
            raw_columns = data["columns"]
            if not isinstance(raw_files, list) or not all(isinstance(path, str) for path in raw_files):
                raise ValueError("plan files must be a list of path strings")
            if not isinstance(raw_infer_schema, bool):
                raise ValueError("plan infer_schema must be a boolean")
            if not isinstance(raw_columns, list):
                raise ValueError("plan columns must be a list")
            columns: list[PlannedColumn] = []
            for index, raw_column in enumerate(raw_columns):
                if not isinstance(raw_column, Mapping):
                    raise ValueError(f"plan column {index} must be an object")
                name = raw_column.get("name")
                sources = raw_column.get("sources")
                confidence = raw_column.get("confidence")
                if not isinstance(name, str) or not isinstance(sources, Mapping) or not isinstance(confidence, Mapping):
                    raise ValueError(f"plan column {index} requires name, sources, and confidence mappings")
                if not all(isinstance(path, str) and (header is None or isinstance(header, str)) for path, header in sources.items()):
                    raise ValueError(f"plan column {index} has invalid source entries")
                if not all(isinstance(path, str) and (score is None or isinstance(score, (int, float))) for path, score in confidence.items()):
                    raise ValueError(f"plan column {index} has invalid confidence entries")
                columns.append(
                    PlannedColumn(
                        name=name,
                        sources=dict(sources),
                        confidence={path: score for path, score in confidence.items()},
                    )
                )
            return cls(files=list(raw_files), infer_schema=raw_infer_schema, columns=columns)
        except KeyError as error:
            raise ValueError(f"alignment plan is missing required field {error.args[0]!r}") from error


def _read_csv_columns(path: Path) -> tuple[list[str], dict[str, list[str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames is None:
            raise ValueError(f"CSV file has no header row: {path}")
        headers = list(reader.fieldnames)
        if not headers:
            raise ValueError(f"CSV file has no header row: {path}")
        if len(headers) != len(set(headers)):
            raise ValueError(f"CSV file has duplicate headers: {path}")
        columns = {header: [] for header in headers}
        for row in reader:
            for header in headers:
                columns[header].append(row.get(header, "") or "")
    return headers, columns


def _pair_assignments(
    left_profiles: dict[str, object], right_profiles: dict[str, object]
) -> list[dict[str, object]]:
    matrix, _ = compare_columns(left_profiles, right_profiles)  # type: ignore[arg-type]
    scores = fuse_scores(matrix)
    assignments, _, _ = align_columns(list(left_profiles), list(right_profiles), scores)
    return assignments


def _empty_column(name: str, files: list[str]) -> PlannedColumn:
    return PlannedColumn(
        name=name,
        sources={path: None for path in files},
        confidence={path: None for path in files},
    )


def _assign_unique_names(columns: list[PlannedColumn], origins: list[str]) -> None:
    used: set[str] = set()
    for column, origin in zip(columns, origins):
        proposed = column.name
        candidate = proposed
        if candidate in used:
            candidate = f"{proposed} [{Path(origin).name}]"
            suffix = 2
            while candidate in used:
                candidate = f"{proposed} [{Path(origin).name}] #{suffix}"
                suffix += 1
        column.name = candidate
        used.add(candidate)


def _build_global_plan(
    files: list[str], headers: list[list[str]], columns_by_file: list[dict[str, list[str]]], sample_size: int
) -> list[PlannedColumn]:
    profiles = [profile_columns(columns, sample_size=sample_size) for columns in columns_by_file]
    nodes = [(file_index, header_index) for file_index, names in enumerate(headers) for header_index in range(len(names))]
    parent = {node: node for node in nodes}
    members = {node: {node[0]} for node in nodes}
    confidence: dict[tuple[int, int], float] = {}

    def root(node: tuple[int, int]) -> tuple[int, int]:
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = parent[node]
        return node

    edges: list[tuple[float, int, int, int, int]] = []
    for left_index in range(len(files)):
        for right_index in range(left_index + 1, len(files)):
            for match in _pair_assignments(profiles[left_index], profiles[right_index]):
                left_header = str(match["left"])
                right_header = str(match["right"])
                score = float(match["score"])
                edges.append((score, left_index, headers[left_index].index(left_header), right_index, headers[right_index].index(right_header)))
    edges.sort(key=lambda edge: (-edge[0], edge[1], edge[2], edge[3], edge[4]))
    for score, left_file, left_header, right_file, right_header in edges:
        left_node = (left_file, left_header)
        right_node = (right_file, right_header)
        left_root, right_root = root(left_node), root(right_node)
        if left_root == right_root or members[left_root] & members[right_root]:
            continue
        # Root choice is deterministic and independent of the edge traversal's object identity.
        if left_root > right_root:
            left_root, right_root = right_root, left_root
        parent[right_root] = left_root
        members[left_root] |= members.pop(right_root)
        confidence[left_node] = max(confidence.get(left_node, 0.0), score)
        confidence[right_node] = max(confidence.get(right_node, 0.0), score)

    groups: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for node in nodes:
        groups.setdefault(root(node), []).append(node)
    ordered_groups = sorted(groups.values(), key=lambda group: min(group))
    result: list[PlannedColumn] = []
    origins: list[str] = []
    for group in ordered_groups:
        group.sort()
        earliest_file, earliest_header = group[0]
        planned = _empty_column(headers[earliest_file][earliest_header], files)
        for file_index, header_index in group:
            path = files[file_index]
            planned.sources[path] = headers[file_index][header_index]
            planned.confidence[path] = 1.0 if (file_index, header_index) == (earliest_file, earliest_header) else confidence.get((file_index, header_index))
        result.append(planned)
        origins.append(files[earliest_file])
    _assign_unique_names(result, origins)
    return result


def _build_reference_plan(
    files: list[str], headers: list[list[str]], columns_by_file: list[dict[str, list[str]]], sample_size: int
) -> list[PlannedColumn]:
    profiles = [profile_columns(columns, sample_size=sample_size) for columns in columns_by_file]
    planned: list[PlannedColumn] = []
    origins: list[str] = []
    reference_headers = headers[0]
    for header_index, header in enumerate(reference_headers):
        column = _empty_column(header, files)
        column.sources[files[0]] = header
        column.confidence[files[0]] = 1.0
        planned.append(column)
        origins.append(files[0])

    for file_index in range(1, len(files)):
        assignments = _pair_assignments(profiles[0], profiles[file_index])
        matched = {str(item["right"]) for item in assignments}
        for item in assignments:
            source = str(item["right"])
            target = str(item["left"])
            target_column = next(column for column in planned if column.sources[files[0]] == target)
            target_column.sources[files[file_index]] = source
            target_column.confidence[files[file_index]] = float(item["score"])
        for header in headers[file_index]:
            if header in matched:
                continue
            extra = _empty_column(header, files)
            extra.sources[files[file_index]] = header
            extra.confidence[files[file_index]] = 1.0
            planned.append(extra)
            origins.append(files[file_index])
    _assign_unique_names(planned, origins)
    return planned


def build_alignment_plan(
    files: Sequence[str | Path], *, infer_schema: bool = True, sample_size: int = 20
) -> AlignmentPlan:
    if sample_size <= 0:
        raise ValueError("sample_size must be a positive integer")
    paths = [Path(path).expanduser().resolve() for path in files]
    if len(paths) < 2:
        raise ValueError("at least two input CSV files are required")
    if len(set(paths)) != len(paths):
        raise ValueError("input CSV paths must be distinct")
    absolute_files = [str(path) for path in paths]
    headers: list[list[str]] = []
    columns_by_file: list[dict[str, list[str]]] = []
    for path in paths:
        file_headers, file_columns = _read_csv_columns(path)
        headers.append(file_headers)
        columns_by_file.append(file_columns)
    planned = (
        _build_global_plan(absolute_files, headers, columns_by_file, sample_size)
        if infer_schema
        else _build_reference_plan(absolute_files, headers, columns_by_file, sample_size)
    )
    return AlignmentPlan(files=absolute_files, infer_schema=infer_schema, columns=planned)


def _validate_plan(plan: AlignmentPlan, output_path: Path) -> list[list[str]]:
    if not plan.files:
        raise ValueError("alignment plan must contain at least one input file")
    if len(set(plan.files)) != len(plan.files):
        raise ValueError("alignment plan input files must be distinct")
    if not plan.columns:
        raise ValueError("alignment plan must contain at least one output column")
    names = [column.name for column in plan.columns]
    if any(not isinstance(name, str) for name in names):
        raise ValueError("output column names must be strings")
    if len(names) != len(set(names)):
        raise ValueError("output column names must be unique")
    resolved_files = [Path(path).expanduser().resolve() for path in plan.files]
    if len(set(resolved_files)) != len(resolved_files):
        raise ValueError("alignment plan input files must be distinct")
    resolved_output = output_path.expanduser().resolve()
    if resolved_output in resolved_files:
        raise ValueError("output path must not resolve to an input CSV path")
    headers_by_file: list[list[str]] = []
    for path in resolved_files:
        headers, _ = _read_csv_columns(path)
        headers_by_file.append(headers)
    used: list[set[str]] = [set() for _ in plan.files]
    file_indexes = {path: index for index, path in enumerate(plan.files)}
    for column in plan.columns:
        for source_path, source_header in column.sources.items():
            if source_path not in file_indexes:
                raise ValueError(f"source path is not listed in plan.files: {source_path}")
            if source_header is None:
                continue
            index = file_indexes[source_path]
            if source_header not in headers_by_file[index]:
                raise ValueError(f"source header {source_header!r} does not exist in {source_path}")
            if source_header in used[index]:
                raise ValueError(f"source header {source_header!r} is mapped to multiple output columns in {source_path}")
            used[index].add(source_header)
    return headers_by_file


def export_aligned_csv(
    plan: AlignmentPlan, output_path: str | Path, *, include_source_file: bool = False
) -> Path:
    output = Path(output_path)
    if include_source_file and any(column.name == "_source_file" for column in plan.columns):
        raise ValueError("canonical column name '_source_file' conflicts with the reserved source field")
    _validate_plan(plan, output)
    fieldnames = (["_source_file"] if include_source_file else []) + [column.name for column in plan.columns]
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()
        for file_path in plan.files:
            with Path(file_path).open("r", encoding="utf-8-sig", newline="") as input_stream:
                reader = csv.DictReader(input_stream)
                for row in reader:
                    out_row: dict[str, str] = {}
                    if include_source_file:
                        out_row["_source_file"] = Path(file_path).name
                    for column in plan.columns:
                        source_header = column.sources.get(file_path)
                        out_row[column.name] = (row.get(source_header, "") or "") if source_header is not None else ""
                    writer.writerow(out_row)
    return output
