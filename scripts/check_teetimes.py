#!/usr/bin/env python3
"""
tee-times v0 — check open tee times at 4 public Dallas courses.

Source: Kenna / TeeItUp public API (phx-api-be-east-1b.kenna.io).
No auth, no browser, no 2FA. Pure JSON over HTTPS.

Usage: check_teetimes.py [days_out]
  days_out: how many days ahead to poll (default 3, max 7)

Output:
  - stdout: Markdown digest for Discord
  - ~/tee-times/output/cache/tee-YYYY-MM-DD.json: raw response cache
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

OUTPUT_DIR = os.path.expanduser("~/tee-times/output")
CACHE_DIR = os.path.join(OUTPUT_DIR, "cache")
os.makedirs(CACHE_DIR, exist_ok=True)

# Course registry. Format: display name|booking-engine-slug|facilityId
# All four run on TeeItUp / Kenna; one API key with x-be-alias namespace.
COURSES = [
    ("Irving Golf Club",        "irving-golf-club",          3186),
    ("Prairie Lakes",           "prairie-lakes-golf-course", 1311),
    ("Golf Ranch Richardson",   "golf-ranch-richardson",     18438),
    ("Duck Creek Golf Club",    "duck-creek-golf-club",      10769),
    # v1.1 additions — recon 2026-06-22
    ("Cedar Crest",             "cedar-crest-golf-club",     5287),
    ("Tangle Ridge",            "tangle-ridge-golf-club",    846),
    ("Riverside (Grand Prairie)","riverside-golf-club",      2338),
    ("Oak Hollow",              "oak-hollow-golf-course",    42),
    ("Coyote Ridge",            "coyote-ridge-golf-club",    1261),
]

CURL_BASE = [
    "curl", "-sS", "-m", "8",
    "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
    "-H", "accept: application/json, text/plain, */*",
]


def fetch(date_str: str, name: str, slug: str, fid: int) -> Optional[dict]:
    """Hit the Kenna teetimes API for one course/date. Returns parsed JSON or None."""
    cmd = CURL_BASE + [
        "-H", f"x-be-alias: {slug}",
        "-H", f"referer: https://{slug}.book.teeitup.com/",
        f"https://phx-api-be-east-1b.kenna.io/v2/tee-times?date={date_str}&facilityIds={fid}",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    except subprocess.TimeoutExpired:
        return None
    if result.returncode != 0 or not result.stdout.strip():
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return None


def best_rate(slot: dict) -> Tuple[Optional[dict], Optional[float]]:
    """Pick cheapest non-member public rate. Kenna uses multiple fee fields."""
    candidates = []
    for r in slot.get("rates", []):
        nm = (r.get("name") or "").lower()
        if "member" in nm:
            continue
        fee = None
        for field in ("greenFeeCart", "greenFeeWalking", "greenFeeRiding", "greenFee"):
            v = r.get(field)
            if isinstance(v, (int, float)) and v > 0:
                fee = v
                break
        if fee is not None:
            candidates.append((fee, r))
    if not candidates:
        for r in slot.get("rates", []):
            if "member" not in (r.get("name") or "").lower():
                return r, None
        return None, None
    candidates.sort(key=lambda x: x[0])
    return candidates[0][1], candidates[0][0]


def fmt_time_ct(iso_utc: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_utc.replace("Z", "+00:00"))
        ct = dt.astimezone(timezone(timedelta(hours=-5)))  # CDT = UTC-5
        s = ct.strftime("%I:%M %p").lower()
        s = s.replace("am", "a").replace("pm", "p").lstrip("0")
        return s
    except Exception:
        return iso_utc


def fmt_date(s: str) -> str:
    try:
        return datetime.strptime(s, "%Y-%m-%d").strftime("%a %b %-d")
    except Exception:
        return s


def main() -> int:
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    days = max(1, min(days, 7))
    today = datetime.now()
    pulled_at = today.strftime("%-I:%M %p").lower().lstrip("0")

    # Fetch all days in parallel-ish (sequential but quick — sub-second per call)
    records = []
    fetch_failed = []
    for i in range(1, days + 1):
        dt = (today + timedelta(days=i)).strftime("%Y-%m-%d")
        cache_file = os.path.join(CACHE_DIR, f"tee-{dt}.json")
        with open(cache_file, "w") as cf:
            for name, slug, fid in COURSES:
                data = fetch(dt, name, slug, fid)
                if data is None:
                    fetch_failed.append(f"{name}@{dt}")
                    continue
                rec = {
                    "course": name,
                    "slug": slug,
                    "facility_id": fid,
                    "date": dt,
                    "facilities": data,
                }
                cf.write(json.dumps(rec) + "\n")
                records.append(rec)

    # Group by date
    by_date: dict[str, list] = {}
    for r in records:
        by_date.setdefault(r["date"], []).append(r)

    # Render Markdown
    lines = []
    lines.append(f"# ⛳ Dallas open tee times — {fmt_date(today.strftime('%Y-%m-%d'))}")
    lines.append("")
    lines.append(
        f"_Next {days} days · {len(COURSES)} public courses · polled {pulled_at} CT · "
        f"via TeeItUp/Kenna_"
    )
    lines.append("")

    total_open = 0
    total_priced = 0
    for date_str in sorted(by_date.keys()):
        lines.append(f"## {fmt_date(date_str)}")
        for cd in by_date[date_str]:
            slots = []
            for fac in cd.get("facilities", []):
                slots = fac.get("teetimes", [])
            lines.append(f"### {cd['course']}")
            if not slots:
                lines.append("_no times returned_")
                lines.append("")
                continue
            rows = []
            for s in slots:
                rate, fee = best_rate(s)
                if rate is None:
                    continue
                total_priced += 1
                t = fmt_time_ct(s.get("teetime", ""))
                fee_s = f"${fee/100:.0f}" if fee else "—"
                booked = s.get("bookedPlayers") or 0
                max_p = s.get("maxPlayers") or 4
                open_n = max(0, max_p - booked)
                if open_n >= 1:
                    total_open += 1
                mark = "✓" if open_n >= 1 else "·"
                holes = rate.get("holes", 18)
                hstr = f" {holes}H" if holes == 9 else ""
                rows.append((t, fee_s, open_n, mark, hstr, max_p, booked))
            if not rows:
                lines.append("_all slots member-only or rate unavailable_")
                lines.append("")
                continue
            for t, fee_s, open_n, mark, hstr, max_p, booked in rows:
                slots_part = f"{open_n}/{max_p}" if max_p != 4 else f"{open_n} open"
                lines.append(f"- {mark} `{t}`  {fee_s:>5}  {slots_part}{hstr}")
            lines.append("")

    lines.append(
        f"__{total_open}/{total_priced} priced slots open · "
        f"book at <course>.book.teeitup.com_"
    )
    if fetch_failed:
        lines.append("")
        lines.append(f"_⚠ fetch failed for: {', '.join(fetch_failed)}_")

    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())