from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
        # SQLAlchemy async engine exige o driver asyncpg explícito.
        if v.startswith("postgres://"):
            return "postgresql+asyncpg://" + v[len("postgres://"):]
        if v.startswith("postgresql://"):
            return "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v

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
