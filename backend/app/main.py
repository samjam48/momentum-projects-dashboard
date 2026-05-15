from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.database import init_db
from app.routers.health import router as health_router
from app.routers.projects import router as projects_router
from app.routers.tasks import router as tasks_router
from app.routers.venture_category_labels import router as venture_category_labels_router
from app.routers.ventures import router as ventures_router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            origin.strip()
            for origin in settings.cors_origins.split(",")
            if origin.strip()
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router, prefix=settings.api_v1_prefix, tags=["health"])
    app.include_router(projects_router, prefix=settings.api_v1_prefix, tags=["projects"])
    app.include_router(tasks_router, prefix=settings.api_v1_prefix, tags=["tasks"])
    app.include_router(
        venture_category_labels_router,
        prefix=settings.api_v1_prefix,
        tags=["venture-category-labels"],
    )
    app.include_router(ventures_router, prefix=settings.api_v1_prefix, tags=["ventures"])
    return app


app = create_app()
