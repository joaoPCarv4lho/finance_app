from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    """Application configuration, loaded from environment variables / .env."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # App
    PROJECT_NAME: str = "Finance App API"
    API_V1_PREFIX: str = "/api/v1"

    # Database. Defaults to a local SQLite file so the app runs without extra
    # infrastructure; docker-compose overrides this with PostgreSQL.
    DATABASE_URL: str = "sqlite+aiosqlite:///./finance_app.db"

    @field_validator("DATABASE_URL")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        # Railway expõe o Postgres gerenciado como postgres(ql)://, mas o
        # SQLAlchemy async engine exige o driver asyncpg explícito. Também
        # removemos "sslmode" da query string (ex.: quando a URL vem de
        # DATABASE_PUBLIC_URL), pois o asyncpg não aceita esse parâmetro
        # estilo libpq — ele usa "ssl" em vez disso.
        v = v.strip()
        url = make_url(v)

        driver_needs_rewrite = url.drivername.lower() in ("postgres", "postgresql")
        has_sslmode = "sslmode" in url.query

        if not driver_needs_rewrite and not has_sslmode:
            return v

        if driver_needs_rewrite:
            url = url.set(drivername="postgresql+asyncpg")
        if has_sslmode:
            query = {k: val for k, val in url.query.items() if k != "sslmode"}
            url = url.set(query=query)

        return url.render_as_string(hide_password=False)

    # Security / JWT
    SECRET_KEY: str = "change-me-in-production-please-use-a-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # CORS: comma-separated list of allowed origins.
    BACKEND_CORS_ORIGINS: str = "*"

    @property
    def cors_origins(self) -> list[str]:
        if self.BACKEND_CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
