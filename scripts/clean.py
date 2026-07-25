import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / "output" / "merged.csv"
OUTPUT = ROOT / "output" / "cleaned.csv"
DEBUG = ROOT / "output" / "debug_headers.txt"

HEADER_MAP = {
    "NGÀY\nGHI NHẬN": "NGAY_GHI_NHAN",
    "MÃ TVV": "MA_TVV",
    "NGUỒN": "NGUON",
    "MÃ ĐĂNG KÝ": "MA_DANG_KY",
    "TÊN HỌC VIÊN": "TEN_HOC_VIEN",
    "Link Facebook": "LINK_FACEBOOK",
    "SĐT": "SDT",
    "TRƯỜNG": "TRUONG",
    "KHOÁ": "KHOA",
    "MÔN": "MON",
    "KHAI GIẢNG\n(dd/mm)": "KHAI_GIANG",
    "KÊNH HỌC": "KENH_HOC",
    "HỌC PHÍ": "HOC_PHI",
    "GHI CHÚ": "GHI_CHU",
    "Sheet_goc": "SHEET_GOC",
    "Dong_goc": "DONG_GOC",
    "TIẾN ĐỘ": "TIEN_DO",
}

ORIGINAL_MAPPING = [
    ("BÁO CÁO TUYỂN SINH", "NGÀY\nGHI NHẬN", "NGAY_GHI_NHAN"),
    ("BÁO CÁO TUYỂN SINH", "MÃ TVV", "MA_TVV"),
    ("BÁO CÁO TUYỂN SINH", "NGUỒN", "NGUON"),
    ("BÁO CÁO TUYỂN SINH", "MÃ ĐĂNG KÝ", "MA_DANG_KY"),
    ("BÁO CÁO TUYỂN SINH", "TÊN HỌC VIÊN", "TEN_HOC_VIEN"),
    ("BÁO CÁO TUYỂN SINH", "Link Facebook", "LINK_FACEBOOK"),
    ("BÁO CÁO TUYỂN SINH", "SĐT", "SDT"),
    ("BÁO CÁO TUYỂN SINH", "TRƯỜNG", "TRUONG"),
    ("BÁO CÁO TUYỂN SINH", "KHOÁ", "KHOA"),
    ("BÁO CÁO TUYỂN SINH", "MÔN", "MON"),
    ("BÁO CÁO TUYỂN SINH", "KHAI GIẢNG\n(dd/mm)", "KHAI_GIANG"),
    ("BÁO CÁO TUYỂN SINH", "KÊNH HỌC", "KENH_HOC"),
    ("BÁO CÁO TUYỂN SINH", "HỌC PHÍ", "HOC_PHI"),
    ("BÁO CÁO TUYỂN SINH", "GHI CHÚ", "GHI_CHU"),
    ("BÁO CÁO TUYỂN SINH", "Sheet_goc", "SHEET_GOC"),
    ("BÁO CÁO TUYỂN SINH", "Dong_goc", "DONG_GOC"),
    ("THỐNG KÊ KH TIỀM NĂNG", "Ngày ghi nhận", "NGAY_GHI_NHAN"),
    ("THỐNG KÊ KH TIỀM NĂNG", "NGUỒN", "NGUON"),
    ("THỐNG KÊ KH TIỀM NĂNG", "TIẾN ĐỘ", "TIEN_DO"),
    ("THỐNG KÊ KH TIỀM NĂNG", "TÊN HV", "TEN_HOC_VIEN"),
    ("THỐNG KÊ KH TIỀM NĂNG", "LINK FB", "LINK_FACEBOOK"),
    ("THỐNG KÊ KH TIỀM NĂNG", "SĐT", "SDT"),
    ("THỐNG KÊ KH TIỀM NĂNG", "TRƯỜNG", "TRUONG"),
    ("THỐNG KÊ KH TIỀM NĂNG", "MÔN", "MON"),
    ("THỐNG KÊ KH TIỀM NĂNG", "KHÓA", "KHOA"),
    ("THỐNG KÊ KH TIỀM NĂNG", "HÌNH THỨC", "KENH_HOC"),
    ("THỐNG KÊ KH TIỀM NĂNG", "HỌC PHÍ", "HOC_PHI"),
    ("THỐNG KÊ KH TIỀM NĂNG", "GHI CHÚ", "GHI_CHU"),
    ("THỐNG KÊ KH TIỀM NĂNG", "KHAI GIẢNG\n(dự kiến)", "KHAI_GIANG"),
    ("THỐNG KÊ KH TIỀM NĂNG", "Sheet_goc", "SHEET_GOC"),
    ("THỐNG KÊ KH TIỀM NĂNG", "Dong_goc", "DONG_GOC"),
]

_PRICE_RE = re.compile(r"[^\d]")
_PHONE_RE = re.compile(r"^0?\d{9,10}$")


def clean_price(raw: str) -> str:
    digits = _PRICE_RE.sub("", raw)
    return digits if digits else raw


def clean_phone(raw: str) -> str:
    raw = raw.strip()
    m = _PHONE_RE.search(raw)
    return m.group() if m else raw


def clean() -> None:
    with INPUT.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        src_fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    dst_fieldnames = ["_source_file"]
    for col in src_fieldnames:
        if col == "_source_file":
            continue
        dst = HEADER_MAP.get(col, col)
        if dst not in dst_fieldnames:
            dst_fieldnames.append(dst)

    ngay_col = "NGÀY\nGHI NHẬN"
    khai_col = "KHAI GIẢNG\n(dd/mm)"
    hocphi_col = "HỌC PHÍ"
    sdt_col = "SĐT"

    with OUTPUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=dst_fieldnames)
        writer.writeheader()
        for row in rows:
            out = {"_source_file": row.get("_source_file", "")}
            for src_col, dst_col in HEADER_MAP.items():
                val = row.get(src_col, "")
                if src_col == hocphi_col:
                    val = clean_price(val)
                elif src_col == sdt_col:
                    val = clean_phone(val)
                out[dst_col] = val
            writer.writerow(out)

    source_tag = "BÁO CÁO TUYỂN SINH"
    source_tag2 = "THỐNG KÊ KH TIỀM NĂNG"
    with DEBUG.open("w", encoding="utf-8") as f:
        f.write("=" * 90 + "\n")
        f.write(f"{'FILE 1':^90}\n")
        f.write(f"{source_tag:^90}\n")
        f.write("=" * 90 + "\n")
        f.write(f"{'Original Header':35s} {'→ Clean Header':25s}\n")
        f.write("-" * 90 + "\n")
        seen = set()
        for src, orig, dst in ORIGINAL_MAPPING:
            if source_tag in src and orig not in seen:
                f.write(f"{orig:35s} → {dst:25s}\n")
                seen.add(orig)

        f.write("\n")
        f.write("=" * 90 + "\n")
        f.write(f"{'FILE 2':^90}\n")
        f.write(f"{source_tag2:^90}\n")
        f.write("=" * 90 + "\n")
        f.write(f"{'Original Header':35s} {'→ Matched (Canonical)':35s} {'→ Clean':20s}\n")
        f.write("-" * 90 + "\n")
        seen2 = set()
        for src, orig, dst in ORIGINAL_MAPPING:
            if source_tag2 in src and orig not in seen2:
                matched_col = None
                for k, v in HEADER_MAP.items():
                    if v == dst and k != dst:
                        matched_col = k
                        break
                match_str = matched_col if matched_col else "(unmatched)"
                f.write(f"{orig:35s} → {match_str:35s} → {dst:20s}\n")
                seen2.add(orig)

        f.write("\n")
        f.write("=" * 90 + "\n")
        f.write(f"{'UNMATCHED COLUMNS':^90}\n")
        f.write("=" * 90 + "\n")
        unmatched_left = [orig for src, orig, _ in ORIGINAL_MAPPING if source_tag in src and orig not in seen]
        for col in unmatched_left:
            f.write(f"  {col:35s} (file 1, no counterpart)\n")
        f.write("\n")
        unmatched_right = [orig for src, orig, _ in ORIGINAL_MAPPING if source_tag2 in src and orig not in seen2]
        for col in unmatched_right:
            f.write(f"  {col:35s} (file 2, no counterpart)\n")

    print(f"Cleaned: {OUTPUT}")
    print(f"Debug:   {DEBUG}")


if __name__ == "__main__":
    clean()
