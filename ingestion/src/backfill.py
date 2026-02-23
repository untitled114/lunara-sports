"""CLI entry point for historical data backfill.

Usage:
    python -m src.backfill --start 2025-10-22 --end 2026-02-19   # Full season
    python -m src.backfill --game 401584901                       # Single game PBP
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import date

import structlog

from src.collectors.historical import HistoricalLoader
from src.config import Settings
from src.producers.kafka_producer import KafkaProducer

logger = structlog.get_logger(__name__)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill historical NBA data")
    parser.add_argument("--start", type=str, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", type=str, help="End date (YYYY-MM-DD)")
    parser.add_argument("--game", type=str, help="Single game ID to backfill PBP")
    args = parser.parse_args()

    settings = Settings()
    producer = KafkaProducer(settings)
    loader = HistoricalLoader(settings, producer)

    if args.game:
        logger.info("backfill.single_game", game_id=args.game)
        await loader.load_game(args.game)
    elif args.start and args.end:
        start = date.fromisoformat(args.start)
        end = date.fromisoformat(args.end)
        logger.info("backfill.date_range", start=str(start), end=str(end))
        await loader.load_date_range(start, end)
    else:
        parser.print_help()
        return

    producer.flush(timeout=10.0)
    logger.info("backfill.done")


if __name__ == "__main__":
    asyncio.run(main())
