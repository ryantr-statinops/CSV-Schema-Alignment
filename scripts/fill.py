import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MERGED = ROOT / "output" / "merged.csv"
MAPPING = ROOT / "scripts" / "schema" / "index_TVV.txt"


def load_tvv_mapping(path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    with path.open(encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            ten = row["TÊN TVV"].strip()
            ma = row["MÃ TVV"].strip()
            result[ten] = ma
    return result


def find_tvv_code(sheet_goc: str, mapping: dict[str, str]) -> str:
    prefix = "TVV "
    if not sheet_goc.startswith(prefix):
        return ""
    name_part = sheet_goc[len(prefix):].strip()
    for ten, ma in mapping.items():
        if name_part in ten or ten in name_part:
            return ma
    return ""


def fill() -> None:
    mapping = load_tvv_mapping(MAPPING)

    with MERGED.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    ngay_col = "NGÀY\nGHI NHẬN"
    khai_col = "KHAI GIẢNG\n(dd/mm)"
    tvv_col = "MÃ TVV"
    sheet_col = "Sheet_goc"

    tvv_filled = 0
    ngay_from_khai = 0
    ngay_ffill = 0
    last_ngay = ""

    for row in rows:
        # --- TVV ---
        if tvv_col in row and not row[tvv_col].strip():
            code = find_tvv_code(row.get(sheet_col, ""), mapping)
            if code:
                row[tvv_col] = code
                tvv_filled += 1

        # --- NGÀY ---
        if ngay_col in row and not row[ngay_col].strip():
            khai = row.get(khai_col, "").strip()
            if khai:
                row[ngay_col] = khai
                ngay_from_khai += 1
            elif last_ngay:
                row[ngay_col] = last_ngay
                ngay_ffill += 1

        if row.get(ngay_col, "").strip():
            last_ngay = row[ngay_col].strip()

    with MERGED.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Filled MÃ TVV: {tvv_filled} rows")
    print(f"Filled NGÀY GHI NHẬN from KHAI GIẢNG: {ngay_from_khai} rows")
    print(f"Filled NGÀY GHI NHẬN (forward-fill): {ngay_ffill} rows")


if __name__ == "__main__":
    fill()
