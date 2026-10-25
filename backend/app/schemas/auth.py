from pydantic import BaseModel, EmailStr, Field

from app.schemas.dashboard import CamelModel


class AuthIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class UserOut(CamelModel):
    id: str
    email: str
    tenant_id: str


class TokenOut(CamelModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut