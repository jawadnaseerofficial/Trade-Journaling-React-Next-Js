import inspect
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.cache import is_enabled as redis_is_enabled
from app.core.cache import start_redis, stop_redis
from app.core.config import settings
from app.core.errors import register_handlers


logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:%(name)s:%(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await start_redis()

    if redis_is_enabled():
        logger.info("Redis is enabled")
    else:
        logger.warning("Redis is disabled")

    yield

    await stop_redis()


app = FastAPI(
    title="tradeJournaling API",
    version="0.1.0",
    docs_url="/docs" if settings.DEBUG else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_handlers(app)
app.include_router(api_router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "redis": redis_is_enabled(),
    }


@app.get("/debug/schema")
async def debug_schema():
    from app.schemas.report import FiltersIn

    test = FiltersIn(
        accounts=None,
        symbols=None,
        playbooks=None,
        sides=None,
        statuses=None,
    )

    return {
        "filters_file": inspect.getsourcefile(FiltersIn),
        "filters_module": FiltersIn.__module__,
        "has_list_validator": hasattr(FiltersIn, "_normalize_list_filters"),
        "test_none_result": test.model_dump(),
    }