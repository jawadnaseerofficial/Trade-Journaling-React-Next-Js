import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import encrypt_dict
from app.core.deps import get_current_user
from app.core.errors import DomainError, NotFoundError
from app.db.models import Account, BrokerConnection, User
from app.db.session import get_session
from app.schemas.broker import BrokerCreateIn, BrokerOut, SyncResultOut
from app.services import broker_sync
from app.services.trade_service import create_trade

router = APIRouter(prefix="/brokers")


def _out(c: BrokerConnection) -> BrokerOut:
    return BrokerOut(
        id=str(c.id), broker=c.broker, label=c.label, status=c.status,
        last_sync_at=c.last_sync_at.strftime("%Y-%m-%dT%H:%M:%SZ") if c.last_sync_at else None,
    )


@router.get("", response_model=list[BrokerOut])
async def list_brokers(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    rows = (await session.execute(select(BrokerConnection).order_by(BrokerConnection.created_at))).scalars().all()
    return [_out(c) for c in rows]


@router.post("", response_model=BrokerOut, status_code=201)
async def create_broker(
    body: BrokerCreateIn,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if body.broker not in broker_sync.PROVIDERS:
        raise DomainError(
            f"Live sync isn't available for '{body.broker}' (no public retail API). "
            f"Use the File Upload tab with that broker's exported CSV."
        )
    conn = BrokerConnection(
        tenant_id=user.tenant_id, broker=body.broker, label=body.label or body.broker.title(),
        credentials_encrypted=encrypt_dict(body.credentials), status="active",
    )
    session.add(conn)
    await session.commit()
    return _out(conn)


@router.delete("/{broker_id}", status_code=204)
async def delete_broker(
    broker_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    conn = await session.get(BrokerConnection, uuid.UUID(broker_id))
    if conn is None or conn.tenant_id != user.tenant_id:
        raise NotFoundError("Connection not found")
    await session.delete(conn)
    await session.commit()


@router.post("/{broker_id}/sync", response_model=SyncResultOut)
async def sync_broker(
    broker_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    conn = await session.get(BrokerConnection, uuid.UUID(broker_id))
    if conn is None or conn.tenant_id != user.tenant_id:
        raise NotFoundError("Connection not found")
    try:
        execs = await broker_sync.fetch_activities(conn)
    except DomainError:
        conn.status = "error"
        await session.commit()
        raise
    except Exception as e:  # network/upstream
        conn.status = "error"
        await session.commit()
        raise DomainError(f"Sync failed: {e.__class__.__name__}")

    acct = (await session.execute(select(Account).where(Account.tenant_id == user.tenant_id))).scalars().first()
    grouped = broker_sync.group(execs)
    n_exec = 0
    for symbol, exs in grouped.items():
        for ex in exs:
            ex.symbol = symbol
        await create_trade(session, tenant_id=user.tenant_id, account_id=acct.id if acct else None,
                           symbol=symbol, asset_type="stock", execs=exs)
        n_exec += len(exs)
    conn.status = "active"
    conn.last_sync_at = datetime.now(timezone.utc)
    await session.commit()
    return SyncResultOut(imported_trades=len(grouped), imported_executions=n_exec)