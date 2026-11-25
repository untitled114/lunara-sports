"""The destructive fixture's DSN guard (runs without a database)."""

from __future__ import annotations

import pytest

from tests.integration.db_guard import UnsafeTestDatabaseError, assert_safe_test_dsn


@pytest.mark.parametrize(
    "dsn",
    [
        "postgresql://postgres:postgres@localhost:55433/lunara_it",
        "postgresql://u:p@127.0.0.1:5432/lunara_it",
        "postgres://u@localhost/some_scratch_test",
        "postgresql://u:p@localhost:55434/LUNARA_IT",
    ],
)
def test_accepts_local_dedicated_database(dsn):
    assert_safe_test_dsn(dsn)


@pytest.mark.parametrize(
    ("dsn", "reason"),
    [
        # databases that are never throwaway: the application's own and the server's default
        ("postgresql://app:x@127.0.0.1:5432/playbyplay", "playbyplay"),
        ("postgresql://app:x@localhost:5432/analytics", "_it"),
        ("postgresql://postgres:postgres@localhost:5432/postgres", "postgres"),
        ("postgresql://postgres:postgres@localhost:5432/PLAYBYPLAY", "PLAYBYPLAY"),
        ("postgresql://u:p@203.0.113.10:5432/lunara_it", "host"),
        ("postgresql://u:p@db.example.com/lunara_it", "host"),
        ("postgresql://u:p@/lunara_it?host=/var/run/postgresql", "host"),
        ("postgresql://u:p@localhost/lunara_it?host=198.51.100.5", "host"),
        ("postgresql://u:p@localhost:1,198.51.100.5:2/lunara_it", "multi-host"),
        ("postgresql://u:p@localhost:5432/", "dedicated"),
        ("postgresql://u:p@localhost:5432", "dedicated"),
        # a local name without the _it/_test suffix is not provably throwaway
        ("postgresql://u:p@localhost:5432/some_scratch_db", "_it"),
        ("postgresql://u:p@localhost:5432/lunara_dev", "_it"),
        ("postgresql://u:p@localhost:5432/playbyplay", "_it"),
        ("postgresql://u:p@localhost:5432/_it", "_it"),
        ("mysql://u:p@localhost/lunara_it", "scheme"),
        ("", "scheme"),
    ],
)
def test_refuses_unsafe_dsn(dsn, reason):
    with pytest.raises(UnsafeTestDatabaseError, match=reason):
        assert_safe_test_dsn(dsn)
