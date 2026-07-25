import csv
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / "output" / "cleaned.csv"
OUTPUT = ROOT / "output" / "dedup_debug.csv"


def dedup() -> None:
    with INPUT.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    by_sdt: dict[str, list[int]] = defaultdict(list)
    by_name: dict[str, list[int]] = defaultdict(list)

    for i, row in enumerate(rows):
        phone = row.get("SDT", "").strip()
        if phone:
            by_sdt[phone].append(i)
        name = row.get("TEN_HOC_VIEN", "").strip().lower()
        if name:
            by_name[name].append(i)

    dup_fieldnames = fieldnames + ["DUPLICATE_SDT", "DUPLICATE_NAME"]
    dup_sdt: set[int] = set()
    dup_name: set[int] = set()

    for phone, indices in by_sdt.items():
        if len(indices) > 1:
            dup_sdt.update(indices)

    for name, indices in by_name.items():
        if len(indices) > 1:
            dup_name.update(indices)

    with OUTPUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=dup_fieldnames)
        writer.writeheader()
        for i, row in enumerate(rows):
            row["DUPLICATE_SDT"] = "YES" if i in dup_sdt else ""
            row["DUPLICATE_NAME"] = "YES" if i in dup_name else ""
            writer.writerow(row)

    cross_file_sdt = 0
    cross_file_name = 0
    for phone, indices in by_sdt.items():
        if len(indices) > 1:
            files = {rows[idx]["_source_file"][:5] for idx in indices}
            if len(files) > 1:
                cross_file_sdt += 1
    for name, indices in by_name.items():
        if len(indices) > 1:
            files = {rows[idx]["_source_file"][:5] for idx in indices}
            if len(files) > 1:
                cross_file_name += 1

    stats = (
        f"\n=== DEDUP STATS ===\n"
        f"Total rows: {len(rows)}\n"
        f"Duplicate by SDT: {len(dup_sdt)} rows ({cross_file_sdt} groups cross-file)\n"
        f"Duplicate by Name: {len(dup_name)} rows ({cross_file_name} groups cross-file)\n"
        f"Unique SDTs: {len(by_sdt)}\n"
        f"Unique Names: {len(by_name)}\n"
    )
    print(stats)
    with OUTPUT.open("a", encoding="utf-8") as f:
        f.write(stats)

    print(f"Output: {OUTPUT}")


if __name__ == "__main__":
    dedup()
