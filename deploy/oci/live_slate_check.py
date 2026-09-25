"""Go/no-go load check against a live ESPN slate (spec decision 10).

The 2026-09-24 benchmark, made reusable: fetch today's live games from the ESPN
scoreboard, poll every game's ``/summary`` once per second for ``--seconds`` (default
90) with gzip and httpx's default User-Agent (ESPN answers 403 to browser UAs), and
measure whole-box CPU from /proc/stat over the same window.

PASS requires 0 non-200 responses (with ``--via-ingestion`` the requests go through the
ingestion service's EspnHttp, so a direct block the proxy recovered counts as 200), a
slowest polling round under 1.0 s, and box CPU under 15%.

Run on the box, with the ingestion venv (it has httpx):

    /opt/lunara/ingestion/.venv/bin/python /opt/lunara/deploy/live_slate_check.py
    /opt/lunara/ingestion/.venv/bin/python /opt/lunara/deploy/live_slate_check.py \\
        --via-ingestion   # reads ESPN_PROXY_URL from the environment

Exit status: 0 PASS, 1 FAIL, 2 no live games to measure.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import statistics
import sys
import time
from collections import Counter
from datetime import datetime
from zoneinfo import ZoneInfo

ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
ET = ZoneInfo("America/New_York")
MAX_ROUND_S = 1.0
MAX_CPU_PCT = 15.0
HEADERS = {"Accept-Encoding": "gzip"}  # no User-Agent override, on purpose


def _pct(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, round(q * (len(ordered) - 1))))
    return ordered[idx]


def summarize(
    *,
    codes: dict[int, int],
    latencies: list[float],
    rounds: list[float],
    cpu_seconds: float,
    wall_seconds: float,
    cores: int,
    via_ingestion: bool = False,
) -> dict:
    """Apply the spec's pass rules to one run's measurements."""
    total = sum(codes.values())
    non_200 = total - codes.get(200, 0)
    cpu_pct = (
        100.0 * cpu_seconds / (wall_seconds * cores) if wall_seconds and cores else 0.0
    )
    round_max = max(rounds) if rounds else 0.0

    reasons = []
    if total == 0:
        reasons.append("no-requests")
    if non_200:
        reasons.append("non-200")
    if round_max >= MAX_ROUND_S:
        reasons.append("round>1s")
    if cpu_pct >= MAX_CPU_PCT:
        reasons.append("cpu>=15%")

    return {
        "pass": not reasons,
        "reasons": reasons,
        "mode": "via-ingestion" if via_ingestion else "direct",
        "requests": total,
        "codes": {str(k): v for k, v in sorted(codes.items())},
        "non_200": non_200,
        "latency_p50_ms": round(_pct(latencies, 0.50) * 1000, 1),
        "latency_p99_ms": round(_pct(latencies, 0.99) * 1000, 1),
        "rounds": len(rounds),
        "round_median_s": round(statistics.median(rounds), 3) if rounds else 0.0,
        "round_max_s": round(round_max, 3),
        "cpu_pct": round(cpu_pct, 2),
        "wall_seconds": round(wall_seconds, 1),
        "cores": cores,
    }


def read_cpu_busy_seconds(path: str = "/proc/stat") -> float:
    """Whole-box busy CPU seconds since boot (all cores), from the aggregate cpu line."""
    with open(path) as fh:
        fields = fh.readline().split()
    # cpu user nice system idle iowait irq softirq steal guest guest_nice
    values = [int(v) for v in fields[1:9]]
    idle = values[3] + values[4]
    return (sum(values) - idle) / os.sysconf("SC_CLK_TCK")


def live_game_ids(scoreboard: dict, include_all: bool = False) -> list[str]:
    """IDs of in-progress events (state "in"); every event when include_all is set."""
    ids = []
    for event in scoreboard.get("events", []):
        state = event.get("status", {}).get("type", {}).get("state")
        if include_all or state == "in":
            ids.append(str(event["id"]))
    return ids


async def _run(args: argparse.Namespace) -> int:
    import httpx

    if args.via_ingestion:
        sys.path.insert(0, args.ingestion_dir)
        from src.http.espn import EspnHttp  # noqa: PLC0415 - optional, box-only import

        http = EspnHttp(os.environ.get("ESPN_PROXY_URL", ""))

        async def get(url: str, params: dict) -> httpx.Response:
            return await http.get(url, params=params)

        closer = http.aclose
    else:
        client = httpx.AsyncClient(timeout=10.0, headers=HEADERS)

        async def get(url: str, params: dict) -> httpx.Response:
            return await client.get(url, params=params)

        closer = client.aclose

    try:
        date = args.date or datetime.now(ET).strftime("%Y%m%d")
        sb = await get(f"{ESPN_BASE}/scoreboard", {"dates": date})
        sb.raise_for_status()
        games = live_game_ids(sb.json(), include_all=args.all_games)
        print(
            f"{date}: {len(games)} game(s) to poll: {' '.join(games) or '-'}",
            flush=True,
        )
        if not games:
            return 2

        codes: Counter[int] = Counter()
        latencies: list[float] = []
        rounds: list[float] = []

        async def one(game_id: str) -> None:
            t0 = time.perf_counter()
            try:
                resp = await get(f"{ESPN_BASE}/summary", {"event": game_id})
                codes[resp.status_code] += 1
            except httpx.HTTPError:
                codes[0] += 1  # transport failure counts as non-200
            latencies.append(time.perf_counter() - t0)

        cpu0, wall0 = read_cpu_busy_seconds(), time.monotonic()
        deadline = wall0 + args.seconds
        while time.monotonic() < deadline:
            r0 = time.monotonic()
            await asyncio.gather(*(one(g) for g in games))
            rounds.append(time.monotonic() - r0)
            await asyncio.sleep(max(0.0, 1.0 - (time.monotonic() - r0)))
        cpu1, wall1 = read_cpu_busy_seconds(), time.monotonic()
    finally:
        await closer()

    result = summarize(
        codes=dict(codes),
        latencies=latencies,
        rounds=rounds,
        cpu_seconds=cpu1 - cpu0,
        wall_seconds=wall1 - wall0,
        cores=os.cpu_count() or 1,
        via_ingestion=args.via_ingestion,
    )
    result["date"] = date
    result["games"] = len(games)
    result["checked_at"] = datetime.now(ET).isoformat(timespec="seconds")
    print(json.dumps(result, indent=2))
    print("PASS" if result["pass"] else f"FAIL: {', '.join(result['reasons'])}")
    return 0 if result["pass"] else 1


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument(
        "--seconds", type=float, default=90.0, help="polling window (default 90)"
    )
    p.add_argument(
        "--date", help="YYYYMMDD scoreboard date (default: today, America/New_York)"
    )
    p.add_argument(
        "--all-games",
        action="store_true",
        help="poll every event on the scoreboard, not only live ones (smoke test only)",
    )
    p.add_argument(
        "--via-ingestion",
        action="store_true",
        help="request through ingestion's EspnHttp (proxy fallback from ESPN_PROXY_URL)",
    )
    p.add_argument("--ingestion-dir", default="/opt/lunara/ingestion")
    return asyncio.run(_run(p.parse_args(argv)))


if __name__ == "__main__":
    sys.exit(main())
