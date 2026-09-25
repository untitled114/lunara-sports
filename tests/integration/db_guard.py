"""Safety guard for the destructive integration-test database fixture.

The fixture runs ``DROP SCHEMA public CASCADE``. It must never reach a real
database, so it refuses any DSN that is not a local host plus a dedicated,
non-production database name.
"""

from __future__ import annotations

from urllib.parse import parse_qs, urlsplit

ALLOWED_HOSTS = frozenset({"localhost", "127.0.0.1"})
FORBIDDEN_DATABASES = frozenset({"lunara", "sportsuite", "postgres"})


class UnsafeTestDatabaseError(RuntimeError):
    """The DSN could point at a database the tests must not wipe."""


def assert_safe_test_dsn(dsn: str) -> None:
    """Raise ``UnsafeTestDatabaseError`` unless ``dsn`` is a local, dedicated test DB."""
    parts = urlsplit(dsn)
    if parts.scheme not in {"postgresql", "postgres"}:
        raise UnsafeTestDatabaseError(f"unsupported DSN scheme {parts.scheme!r}")
    hostport = parts.netloc.rpartition("@")[2]
    if "," in hostport:
        raise UnsafeTestDatabaseError("multi-host DSNs are refused")
    if "host" in parse_qs(parts.query):
        raise UnsafeTestDatabaseError(
            "host override in the DSN query string is refused"
        )
    if parts.hostname not in ALLOWED_HOSTS:
        raise UnsafeTestDatabaseError(
            f"refusing to wipe a database on host {parts.hostname!r}; "
            f"only {sorted(ALLOWED_HOSTS)} are allowed"
        )
    database = parts.path.lstrip("/")
    if not database:
        raise UnsafeTestDatabaseError("the DSN must name a dedicated test database")
    if database.lower() in FORBIDDEN_DATABASES:
        raise UnsafeTestDatabaseError(
            f"refusing to wipe database {database!r}; use a dedicated one such as 'lunara_it'"
        )
