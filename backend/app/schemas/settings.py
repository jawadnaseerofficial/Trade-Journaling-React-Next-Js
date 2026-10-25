from pydantic import Field

from app.schemas.dashboard import CamelModel


class ProfilePatch(CamelModel):
    display_name: str | None = None
    avatar: str | None = None
    chart_style: str | None = None
    theme_pref: str | None = None


class EmailPatch(CamelModel):
    email: str = Field(min_length=3, max_length=255)


class TenantPatch(CamelModel):
    name: str = Field(min_length=1, max_length=120)


class PasswordPatch(CamelModel):
    current_password: str
    new_password: str


class ProfileOut(CamelModel):
    id: str
    email: str
    display_name: str | None
    avatar: str
    chart_style: str
    theme_pref: str
    tenant_name: str
    created_at: str