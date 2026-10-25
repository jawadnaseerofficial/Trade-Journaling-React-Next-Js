import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("tradejournaling")


class DomainError(Exception):
    code = "domain_error"
    status = 400

    def __init__(self, detail: str, **meta):
        self.detail = detail
        self.meta = meta


class NotFoundError(DomainError):
    code = "not_found"
    status = 404


class UnauthorizedError(DomainError):
    code = "unauthorized"
    status = 401


class EmailTakenError(DomainError):
    code = "email_taken"
    status = 409


class InvalidCredentialsError(DomainError):
    code = "invalid_credentials"
    status = 401


class TenantMismatchError(DomainError):
    code = "tenant_mismatch"
    status = 403


class RateLimitedError(DomainError):
    code = "rate_limited"
    status = 429


def problem(status: int, code: str, detail: str, correlation_id: str | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={
            "type": f"https://tradejournaling.dev/errors/{code}",
            "title": code,
            "status": status,
            "detail": detail,
            "correlation_id": correlation_id,
        },
        media_type="application/problem+json",
    )


def register_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def domain_handler(req: Request, exc: DomainError):
        return problem(exc.status, exc.code, exc.detail, getattr(req.state, "correlation_id", None))

    # FastAPI's default 422 returns detail as an ARRAY of objects -> the UI stringified it to
    # "[object Object],[object Object]". Flatten to a readable "field: reason; ..." string so
    # every validation error anywhere in the app is legible (and never an object blob again).
    @app.exception_handler(RequestValidationError)
    async def validation_handler(req: Request, exc: RequestValidationError):
        parts: list[str] = []
        for e in exc.errors():
            loc = ".".join(str(x) for x in e.get("loc", []) if x not in ("body", "query", "path", "header"))
            msg = e.get("msg", "invalid")
            parts.append(f"{loc}: {msg}" if loc else str(msg))
        return problem(422, "validation_error", "; ".join(parts) or "Invalid request", str(uuid.uuid4()))

    @app.exception_handler(Exception)
    async def unhandled_handler(req: Request, exc: Exception):
        cid = str(uuid.uuid4())
        logger.exception("unhandled_error", extra={"correlation_id": cid})
        return problem(500, "internal", "An unexpected error occurred.", cid)