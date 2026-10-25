import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select, text

from app.core.security import hash_password
from app.core.tenant import set_tenant
from app.db.models import Account, Tenant, Trade, User
from app.db.session import SessionLocal

DEMO_TENANT_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")
DEFAULT_ACCOUNT_ID = uuid.UUID("00000000-0000-4000-8000-0000000000a1")
DEMO_EMAIL = "demo@tradejournaling.app"
DEMO_PASSWORD = "password123"

SYMBOLS = ["AMD", "GOOG", "NVDA", "TSLA", "SPY"]
PLAN = [
    (3, 105, 4), (4, 101, 5), (5, -248, 6), (6, -241, 4),
    (9, -149, 3), (10, -289, 5), (11, 104, 2), (12, 31, 4), (13, -90, 5),
]


def split_total(total: int, count: int) -> list[int]:
    base, rem = divmod(total, count)
    return [base + (1 if i < rem else 0) for i in range(count)]


def _dt(days_ago: int, hour: int) -> datetime:
    d = datetime.now(timezone.utc).date() - timedelta(days=days_ago)
    return datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=hour)


async def main() -> None:
    async with SessionLocal() as s:
        set_tenant(str(DEMO_TENANT_ID))
        await s.execute(text("SELECT set_config('app.tenant_id', :tid, true)"), {"tid": str(DEMO_TENANT_ID)})

        if await s.get(Tenant, DEMO_TENANT_ID) is None:
            s.add(Tenant(id=DEMO_TENANT_ID, name="Demo Tenant"))
        if await s.get(Account, DEFAULT_ACCOUNT_ID) is None:
            s.add(Account(id=DEFAULT_ACCOUNT_ID, tenant_id=DEMO_TENANT_ID, name="Webull Main PA", broker="webull", timezone="US/Eastern"))
        if (await s.execute(select(User).where(User.email == DEMO_EMAIL))).scalar_one_or_none() is None:
            s.add(User(tenant_id=DEMO_TENANT_ID, email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD)))

        if (await s.execute(select(Trade.id).limit(1))).first():
            await s.execute(text("UPDATE trades SET account_id = :aid WHERE account_id IS NULL"), {"aid": str(DEFAULT_ACCOUNT_ID)})
            await s.commit()
            print("Trades already seeded — ensured tenant/account/user.")
        else:
            rows: list[Trade] = []
            for i, (sym, pnl) in enumerate([("AMD", 78), ("AMD", -30), ("GOOG", 81)]):
                rows.append(Trade(tenant_id=DEMO_TENANT_ID, account_id=DEFAULT_ACCOUNT_ID, symbol=sym, asset_type="stock",
                                  qty=Decimal(10), status="closed", open_date=_dt(1, 9 + i), close_date=_dt(1, 10 + i), net_pnl=Decimal(pnl)))
            for days_ago, total, count in PLAN:
                for i, pnl in enumerate(split_total(total, count)):
                    rows.append(Trade(tenant_id=DEMO_TENANT_ID, account_id=DEFAULT_ACCOUNT_ID, symbol=SYMBOLS[i % len(SYMBOLS)],
                                      asset_type="stock", qty=Decimal(5), status="closed", open_date=_dt(days_ago, 9 + i),
                                      close_date=_dt(days_ago, 10 + i), net_pnl=Decimal(pnl)))
            rows.append(Trade(tenant_id=DEMO_TENANT_ID, account_id=DEFAULT_ACCOUNT_ID, symbol="NVDA", asset_type="stock",
                              qty=Decimal(4), status="open", open_date=_dt(0, 9), close_date=None, net_pnl=Decimal("42.50")))
            s.add_all(rows)
            await s.commit()
            print(f"Seeded {len(rows)} trades.")
        print(f"Demo login: {DEMO_EMAIL} / {DEMO_PASSWORD}")


asyncio.run(main())