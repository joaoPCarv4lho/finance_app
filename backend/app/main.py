from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401  ensure all models are registered on Base.metadata
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # For simplicity we create tables on startup. In production, use Alembic
    # migrations (alembic is included in requirements) instead.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description=(
        "API de gestão financeira simples e intuitiva. Foca em duas métricas: "
        "quanto você pode gastar com segurança e o progresso rumo ao primeiro "
        "investimento. Documentação OpenAPI disponível em /docs e /redoc."
    ),
    lifespan=lifespan,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["health"])
async def root():
    return {"status": "ok", "service": settings.PROJECT_NAME, "docs": "/docs"}


@app.get("/health", tags=["health"])
async def health():
    return {"status": "healthy"}
