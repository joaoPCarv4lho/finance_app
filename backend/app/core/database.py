from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


def _to_async_dsn(url: str) -> str:
    """Ensure the SQLAlchemy async engine uses an async-capable driver.

    Railway's Postgres plugin (and most external providers) hand back a
    plain postgresql:// URL, which SQLAlchemy resolves to the sync psycopg2
    driver by default. This app is fully async, so force the asyncpg driver
    for Postgres URLs while leaving other schemes (e.g. sqlite+aiosqlite)
    untouched.
    """
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


engine = create_async_engine(_to_async_dsn(settings.DATABASE_URL), echo=False, future=True)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
