from app.schemas.dashboard import CamelModel


class AccountOut(CamelModel):
    id: str
    name: str
    broker: str
    timezone: str