from pydantic import BaseModel, Field

from app.schemas.dashboard import CamelModel


class BrokerCreateIn(BaseModel):
    broker: str = Field(min_length=2)
    label: str = Field(default="")
    credentials: dict


class BrokerOut(CamelModel):
    id: str
    broker: str
    label: str
    status: str
    last_sync_at: str | None = None


class SyncResultOut(CamelModel):
    imported_trades: int
    imported_executions: int