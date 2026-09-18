import pytest

from app.core.config import Settings


@pytest.mark.parametrize(
    "raw_url,expected_url",
    [
        (
            "postgres://user:pass@host:5432/db",
            "postgresql+asyncpg://user:pass@host:5432/db",
        ),
        (
            "postgresql://user:pass@host:5432/db",
            "postgresql+asyncpg://user:pass@host:5432/db",
        ),
        (
            "postgresql+asyncpg://user:pass@host:5432/db",
            "postgresql+asyncpg://user:pass@host:5432/db",
        ),
        (
            "sqlite+aiosqlite:///./finance_app.db",
            "sqlite+aiosqlite:///./finance_app.db",
        ),
        (
            "postgresql://user:pass@host:5432/db?sslmode=require",
            "postgresql+asyncpg://user:pass@host:5432/db",
        ),
        (
            "postgres://user:pass@host:5432/db?sslmode=require",
            "postgresql+asyncpg://user:pass@host:5432/db",
        ),
        (
            "postgres://user:pass@host:5432/db?application_name=finance-app",
            "postgresql+asyncpg://user:pass@host:5432/db?application_name=finance-app",
        ),
    ],
)
def test_database_url_normalizes_to_asyncpg_driver(raw_url, expected_url):
    settings = Settings(DATABASE_URL=raw_url, _env_file=None)
    assert settings.DATABASE_URL == expected_url
