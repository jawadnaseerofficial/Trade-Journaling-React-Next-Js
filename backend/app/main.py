from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import settings
from app.core.errors import register_handlers
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="tradeJournaling API",
    version="0.1.0",
    docs_url="/docs" if settings.DEBUG else None,
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