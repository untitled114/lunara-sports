"""The destructive fixture's DSN guard (runs without a database)."""

from __future__ import annotations

import pytest

from tests.integration.db_guard import UnsafeTestDatabaseError, assert_safe_test_dsn


@pytest.mark.parametrize(
    "dsn",
    [
        "postgresql://postgres:postgres@localhost:55433/lunara_it",
        "postgresql://u:p@127.0.0.1:5432/lunara_it",
        "postgres://u@localhost/some_scratch_db",
    ],
)
def test_accepts_local_dedicated_database(dsn):
    assert_safe_test_dsn(dsn)


@pytest.mark.parametrize(
    ("dsn", "reason"),
    [
        # prod-like: the real Lunara DB on the sport-suite-main box
        ("postgresql://lunara_app:x@127.0.0.1:5500/lunara", "lunara"),
        ("postgresql://mlb_user:x@localhost:5500/sportsuite", "sportsuite"),
        ("postgresql://postgres:postgres@localhost:5432/postgres", "postgres"),
        ("postgresql://postgres:postgres@localhost:5432/LUNARA", "LUNARA"),
        ("postgresql://u:p@129.80.171.19:5500/lunara_it", "host"),
        ("postgresql://u:p@db.example.com/lunara_it", "host"),
        ("postgresql://u:p@/lunara_it?host=/var/run/postgresql", "host"),
        ("postgresql://u:p@localhost/lunara_it?host=10.0.0.5", "host"),
        ("postgresql://u:p@localhost:1,10.0.0.5:2/lunara_it", "multi-host"),
        ("postgresql://u:p@localhost:5432/", "dedicated"),
        ("postgresql://u:p@localhost:5432", "dedicated"),
        ("mysql://u:p@localhost/lunara_it", "scheme"),
        ("", "scheme"),
    ],
)
def test_refuses_unsafe_dsn(dsn, reason):
    with pytest.raises(UnsafeTestDatabaseError, match=reason):
        assert_safe_test_dsn(dsn)
