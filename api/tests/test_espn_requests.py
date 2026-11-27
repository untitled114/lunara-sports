"""What the ESPN client asks for: the cache key, the URL and the parameters of each request
the leaders, Stats and Players pages depend on (the cache is patched; nothing is fetched)."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from src.services import espn_client, stats_service


async def test_roster_request():
    with patch.object(espn_client, "_cached_get", AsyncMock(return_value={})) as get:
        await espn_client.get_roster(18)
    key, url, _ttl = get.call_args.args[:3]
    assert key == "espn:roster:v2:18"
    assert url.endswith("/teams/18/roster")


async def test_qualified_leaders_request():
    with patch.object(espn_client, "_cached_get", AsyncMock(return_value={})) as get:
        await espn_client.get_qualified_leaders(2027, "offensive.avgPoints", 500)
    key, url = get.call_args.args[:2]
    params = get.call_args.kwargs["params"]
    assert key == "espn:leaders:q:2027:offensive.avgPoints:500"
    assert url == espn_client.BYATHLETE_URL
    assert (params["isqualified"], params["limit"], params["sort"], params["season"]) == (
        "true",
        "500",
        "offensive.avgPoints:desc",
        "2027",
    )


async def test_all_player_stats_request():
    with patch.object(espn_client, "_cached_get", AsyncMock(return_value={})) as get:
        await espn_client.get_all_player_stats(2027)
    key, url = get.call_args.args[:2]
    params = get.call_args.kwargs["params"]
    assert key == "espn:players:all:2027"
    assert url == espn_client.BYATHLETE_URL
    assert (params["isqualified"], params["limit"], params["seasontype"]) == ("false", "600", "2")


async def test_no_season_yet_gives_empty_answers():
    with patch.object(stats_service, "choose_regular_season", AsyncMock(return_value=None)):
        cat = await stats_service.get_category_leaders("pts")
        table = await stats_service.get_player_table()
    assert (cat.category, cat.rows, cat.qualified) == ("pts", [], 0)
    assert (table.total, table.rows, table.sort) == (0, [], "pts")
