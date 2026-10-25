import json

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    DEBUG: bool = True
    CORS_ORIGINS: str = '["http://localhost:3000"]'
    JWT_SECRET: str = "dev-secret-change-in-production"
    ENCRYPTION_KEY: str = "dev-encryption-key-change-me-AAAAAAAAAAAAAAAAAAA="

    @property
    def cors_origins_list(self) -> list[str]:
        return json.loads(self.CORS_ORIGINS)


settings = Settings()