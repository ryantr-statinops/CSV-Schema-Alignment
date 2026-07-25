import csv
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / "output" / "cleaned.csv"
OUTPUT = ROOT / "output" / "report.html"

MONTH_NAMES = {
    "01": "Tháng 1", "02": "Tháng 2", "03": "Tháng 3",
    "04": "Tháng 4", "05": "Tháng 5", "06": "Tháng 6",
    "07": "Tháng 7", "08": "Tháng 8", "09": "Tháng 9",
    "10": "Tháng 10", "11": "Tháng 11", "12": "Tháng 12",
}
MONTH_ORDER = ["01","02","03","04","05","06","07","08","09","10","11","12"]

def _month_key(d: str) -> str:
    parts = d.split("/")
    return parts[1] if len(parts) >= 2 else "00"

def _int(val: str) -> int:
    try:
        return int(val.strip())
    except (ValueError, AttributeError):
        return 0

def build() -> None:
    with INPUT.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    total = len(rows)
    left = [r for r in rows if r["_source_file"].startswith("BÁO")]
    right = [r for r in rows if "index" in r["_source_file"]]

    # -- helpers --
    def counter_for(col: str, source: list | None = None) -> Counter:
        src = source or rows
        return Counter(r[col] for r in src if r[col].strip())

    def revenue_for(source: list, group_col: str) -> dict[str, int]:
        rev: dict[str, int] = defaultdict(int)
        for r in source:
            k = r[group_col].strip()
            if k:
                rev[k] += _int(r["HOC_PHI"])
        return dict(rev)

    # ---- TVV (enrollment only) ----
    tvv_cnt = counter_for("MA_TVV", left)
    tvv_rev = revenue_for(left, "MA_TVV")
    tvv_rank = sorted(tvv_cnt.items(), key=lambda x: -x[1])

    # ---- MON ----
    mon_cnt = counter_for("MON", left)
    mon_top = mon_cnt.most_common(8)

    # ---- KENH_HOC ----
    kenh_cnt = counter_for("KENH_HOC", left)
    kenh_top = kenh_cnt.most_common(6)

    # ---- NGUON ----
    nguon_cnt = counter_for("NGUON", left)
    nguon_top = nguon_cnt.most_common(6)

    # ---- KHOA ----
    khoa_cnt = counter_for("KHOA", left)
    khoa_top = khoa_cnt.most_common(6)

    # ---- TRUONG ----
    truong_cnt = counter_for("TRUONG", left)
    truong_top = truong_cnt.most_common(8)

    # ---- Monthly ----
    mon_stats: dict[str, dict] = {}
    for mk in MONTH_ORDER:
        rows_in_month = [r for r in left if _month_key(r["NGAY_GHI_NHAN"].strip()) == mk]
        if rows_in_month:
            mon_stats[mk] = {
                "count": len(rows_in_month),
                "revenue": sum(_int(r["HOC_PHI"]) for r in rows_in_month),
            }

    # ---- Potential (right file) ----
    right_cnt = counter_for("MA_TVV", right)
    right_potential = sorted(right_cnt.items(), key=lambda x: -x[1])

    # ---- Maxes for bars ----
    max_mon = max((c for _, c in mon_top), default=1)
    max_kenh = max((c for _, c in kenh_top), default=1)
    max_nguon = max((c for _, c in nguon_top), default=1)
    max_khoa = max((c for _, c in khoa_top), default=1)
    max_tvv = max((c for _, c in tvv_rank), default=1)
    max_month = max((s["count"] for s in mon_stats.values()), default=1)

    def bar_html(val: int, mx: int, color: str = "#3b82f6") -> str:
        pct = val / mx * 100 if mx else 0
        return f'<div style="background:{color};width:{pct:.1f}%;height:18px;border-radius:3px;min-width:4px" title="{val}"></div>'

    # ---- Build HTML ----
    def _css() -> str:
        return """* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif; background:#f3f4f6; color:#1e293b; }
.topbar { background:#1e3a5f; color:#fff; padding:16px 32px; display:flex; align-items:center; justify-content:space-between; }
.topbar h1 { font-size:20px; font-weight:600; }
.topbar span { font-size:13px; opacity:.7; }
.container { max-width:1400px; margin:0 auto; padding:24px 32px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:16px; margin-bottom:24px; }
.kpi { background:#fff; border-radius:8px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.kpi .num { font-size:30px; font-weight:700; color:#1e3a5f; line-height:1.2; }
.kpi .num span { font-size:14px; font-weight:400; color:#64748b; }
.kpi .label { font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:.5px; margin-top:4px; }
.row { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
.col { background:#fff; border-radius:8px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.col-full { background:#fff; border-radius:8px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,.06); margin-bottom:16px; }
.col h2 { font-size:14px; font-weight:600; color:#1e3a5f; text-transform:uppercase; letter-spacing:.5px; margin-bottom:14px; padding-bottom:8px; border-bottom:2px solid #e2e8f0; }
table { width:100%; border-collapse:collapse; font-size:13px; }
th, td { padding:7px 8px; text-align:left; border-bottom:1px solid #f1f5f9; }
th { color:#64748b; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.3px; }
tr:hover td { background:#f8fafc; }
.num-col { text-align:right; font-variant-numeric:tabular-nums; }
.bar-row { display:flex; align-items:center; gap:8px; margin-bottom:5px; }
.bar-label { width:100px; font-size:12px; flex-shrink:0; text-align:right; color:#475569; }
.bar-val { width:50px; font-size:11px; color:#94a3b8; font-variant-numeric:tabular-nums; text-align:right; flex-shrink:0; }
.bar-track { flex:1; background:#e2e8f0; border-radius:3px; height:18px; }
.col3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:900px){ .row, .col3 { grid-template-columns:1fr; } }"""

    html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Báo Cáo Tuyển Sinh 2026 — Sixu Team</title>
<style>
{_css()}
</style>
</head>
<body>
<div class="topbar">
  <h1>BÁO CÁO TUYỂN SINH 2026</h1>
  <span>Sixu Team • CSV Schema Alignment Pipeline</span>
</div>
<div class="container">

<!-- KPI -->
<div class="kpi-grid">
  <div class="kpi"><div class="num">{total}</div><div class="label">Tổng dòng dữ liệu</div></div>
  <div class="kpi"><div class="num">{len(left)} <span>| {len(right)}</span></div><div class="label">Ghi nhận | Tiềm năng</div></div>
  <div class="kpi"><div class="num">{len(tvv_cnt)}</div><div class="label">Tổng số TVV</div></div>
  <div class="kpi"><div class="num">{sum(tvv_cnt.values())}</div><div class="label">Học viên đã ghi nhận</div></div>
  <div class="kpi"><div class="num">{sum(tvv_rev.values()):,}</div><div class="label">Tổng doanh thu (VND)</div></div>
  <div class="kpi"><div class="num">{sum(right_cnt.values())}</div><div class="label">Khách hàng tiềm năng</div></div>
</div>

<!-- Monthly + MON -->
<div class="row">
  <div class="col">
    <h2>Xu hướng theo tháng</h2>"""
    for mk in MONTH_ORDER:
        s = mon_stats.get(mk)
        if not s:
            continue
        cnt, rev = s["count"], s["revenue"]
        html += f"""<div class="bar-row">
  <div class="bar-label">{MONTH_NAMES[mk]}</div>
  <div class="bar-track">{bar_html(cnt, max_month, "#1e3a5f")}</div>
  <div class="bar-val">{cnt}</div>
  <div class="bar-val" style="width:80px">{rev:,.0f}</div>
</div>"""
    html += """</div>
  <div class="col">
    <h2>Môn học</h2>"""
    for mon, cnt in mon_top:
        html += f"""<div class="bar-row">
  <div class="bar-label">{mon}</div>
  <div class="bar-track">{bar_html(cnt, max_mon, "#6366f1")}</div>
  <div class="bar-val">{cnt}</div>
</div>"""
    html += """</div>
</div>

<!-- TVV + Potential -->
<div class="row">
  <div class="col">
    <h2>TVV — Ghi nhận (Database)</h2>
    <table>
      <tr><th>Mã TVV</th><th class="num-col">HS</th><th class="num-col">Doanh thu</th><th class="num-col">TB/HS</th></tr>"""
    for ma, cnt in tvv_rank:
        rev = tvv_rev.get(ma, 0)
        avg = rev // cnt if cnt else 0
        html += f"<tr><td>{ma}</td><td class='num-col'>{cnt}</td><td class='num-col'>{rev:,}</td><td class='num-col'>{avg:,}</td></tr>"
    html += """</table>
  </div>
  <div class="col">
    <h2>TVV — Tiềm năng (Index)</h2>
    <table>
      <tr><th>Mã TVV</th><th class="num-col">Số lượng</th></tr>"""
    for ma, cnt in right_potential:
        html += f"<tr><td>{ma}</td><td class='num-col'>{cnt}</td></tr>"
    html += """</table>
  </div>
</div>

<!-- Kênh học + Nguồn + Khoá -->
<div class="col3">
  <div class="col">
    <h2>Kênh học</h2>"""
    for kh, cnt in kenh_top:
        html += f"""<div class="bar-row">
  <div class="bar-label">{kh}</div>
  <div class="bar-track">{bar_html(cnt, max_kenh, "#10b981")}</div>
  <div class="bar-val">{cnt}</div>
</div>"""
    html += """</div>
  <div class="col">
    <h2>Nguồn</h2>"""
    for ng, cnt in nguon_top:
        html += f"""<div class="bar-row">
  <div class="bar-label">{ng}</div>
  <div class="bar-track">{bar_html(cnt, max_nguon, "#f59e0b")}</div>
  <div class="bar-val">{cnt}</div>
</div>"""
    html += """</div>
  <div class="col">
    <h2>Loại khoá</h2>"""
    for kh, cnt in khoa_top:
        html += f"""<div class="bar-row">
  <div class="bar-label">{kh}</div>
  <div class="bar-track">{bar_html(cnt, max_khoa, "#ec4899")}</div>
  <div class="bar-val">{cnt}</div>
</div>"""
    html += """</div>
</div>

<!-- Top trường -->
<div class="col-full">
  <h2>Top trường</h2>
  <table>
    <tr><th>Trường</th><th class="num-col">Số lượng</th></tr>"""
    for tr, cnt in truong_top:
        html += f"<tr><td>{tr}</td><td class='num-col'>{cnt}</td></tr>"
    html += """</table>
</div>

<!-- Footer -->
<div style="text-align:center;padding:20px;color:#94a3b8;font-size:11px">
  Generated by CSV Schema Alignment Pipeline • """ + f"{total} rows from 2 sources • {len(left)} enrollments + {len(right)} leads" + """
</div>
</div>
</body>
</html>"""

    OUTPUT.write_text(html, encoding="utf-8")
    print(f"Report: {OUTPUT}")


if __name__ == "__main__":
    build()
