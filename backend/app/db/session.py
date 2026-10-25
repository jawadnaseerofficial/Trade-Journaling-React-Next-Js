import ssl
from collections.abc import AsyncIterator

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.tenant import get_tenant

ssl_ctx = ssl.create_default_context()

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args={"ssl": ssl_ctx},
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


@event.listens_for(Session, "after_begin")
def _apply_row_level_security(session: Session, transaction, connection) -> None:
    tenant_id = get_tenant()
    if tenant_id:
        # set_config safely accepts bound parameters, unlike SET LOCAL
        connection.execute(
            text("SELECT set_config('app.tenant_id', :tid, true)"), 
            {"tid": tenant_id}
        )


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session