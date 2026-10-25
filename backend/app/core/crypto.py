import json

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

_fernet = Fernet(settings.ENCRYPTION_KEY.encode())


def encrypt_dict(data: dict) -> str:
    return _fernet.encrypt(json.dumps(data).encode()).decode()


def decrypt_dict(token: str) -> dict:
    try:
        return json.loads(_fernet.decrypt(token.encode()).decode())
    except (InvalidToken, ValueError):
        return {}