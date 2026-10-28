import asyncio
import json
import logging
import os
import shutil
import socket
import subprocess
from datetime import datetime, timezone
from typing import Any

try:
    from aiokafka import AIOKafkaProducer  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    AIOKafkaProducer = None  # type: ignore[assignment]


logger = logging.getLogger(__name__)

_producer: Any = None
_bootstrap = ""
_failures = 0
_MAX_FAILURES = 3


def _is_port_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=0.5):
            return True
    except OSError:
        return False


def _popen_kwargs() -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
        "close_fds": True,
    }

    if os.name == "nt":
        kwargs["creationflags"] = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    else:
        kwargs["start_new_session"] = True

    return kwargs


def _launch_local_kafka_if_needed(bootstrap: str) -> None:
    """
    Best-effort local developer convenience only.

    Must never crash the API process.
    """
    try:
        if not bootstrap:
            return

        first = bootstrap.split(",")[0].strip()

        if "://" in first:
            first = first.split("://", 1)[1]

        host, _, addr = first.partition(":")

        try:
            port = int(addr) if addr else 19092
        except ValueError:
            port = 19092

        if _is_port_open(host or "127.0.0.1", port):
            return

        redpanda_bin = shutil.which("redpanda")

        if redpanda_bin:
            try:
                subprocess.Popen(
                    [
                        redpanda_bin,
                        "start",
                        "--overprovisioned",
                        "--smp=1",
                        "--memory=1G",
                        "--reserve-memory=0M",
                        "--node-id=0",
                        "--check=false",
                        "--kafka-addr=PLAINTEXT://0.0.0.0:9092,OUTSIDE://0.0.0.0:19092",
                        "--advertise-kafka-addr=PLAINTEXT://localhost:9092,OUTSIDE://localhost:19092",
                        "--set=redpanda.empty_seed_starts_cluster=true",
                    ],
                    **_popen_kwargs(),
                )
            except Exception:
                return

            return

        kafka_home = os.getenv("KAFKA_HOME")

        if kafka_home:
            kafka_bin = os.path.join(kafka_home, "bin", "kafka-server-start.sh")
            config = os.path.join(kafka_home, "config", "server.properties")

            if os.path.exists(kafka_bin) and os.path.exists(config):
                try:
                    subprocess.Popen(
                        [kafka_bin, config],
                        **_popen_kwargs(),
                    )
                except Exception:
                    return
    except Exception:
        return


async def start_kafka() -> None:
    """
    Start Kafka producer if KAFKA_BOOTSTRAP_SERVERS is set.

    Fail-open:
    - no bootstrap => disabled
    - aiokafka missing => disabled
    - broker unreachable => disabled
    - backend must still boot
    """
    global _producer, _bootstrap, _failures

    _producer = None
    _failures = 0

    _bootstrap = (os.getenv("KAFKA_BOOTSTRAP_SERVERS") or "").strip()

    try:
        _launch_local_kafka_if_needed(_bootstrap)
    except Exception:
        pass

    if not _bootstrap:
        logger.info("Kafka disabled: KAFKA_BOOTSTRAP_SERVERS not set")
        return

    if AIOKafkaProducer is None:
        logger.warning("Kafka disabled: aiokafka package not available")
        return

    try:
        _producer = AIOKafkaProducer(
            bootstrap_servers=_bootstrap,
            request_timeout=5.0,
            linger_ms=50,
            max_request_size=1_048_576,
        )

        await asyncio.wait_for(_producer.start(), timeout=5.0)
        logger.info("Kafka producer enabled")
    except Exception as exc:
        logger.warning("Kafka producer disabled fail-open: %s", exc)
        _producer = None


async def stop_kafka() -> None:
    global _producer, _failures

    if _producer is None:
        return

    try:
        await asyncio.wait_for(_producer.stop(), timeout=5.0)
    except Exception:
        pass
    finally:
        _producer = None
        _failures = 0


async def publish_event(topic: str, payload: dict[str, Any]) -> bool:
    """
    Publish one event.

    Never raises.
    Returns True only if broker accepted the event.
    """
    global _producer, _failures

    if _producer is None:
        return False

    try:
        raw = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")

        await asyncio.wait_for(
            _producer.send_and_wait(topic, raw),
            timeout=3.0,
        )

        _failures = 0
        return True
    except Exception as exc:
        _failures += 1

        logger.warning("Kafka publish failed topic=%s error=%s", topic, exc)

        if _failures >= _MAX_FAILURES:
            logger.warning("Kafka producer disabled after repeated failures")
            _producer = None

        return False


def _topic(env_name: str, default: str) -> str:
    return (os.getenv(env_name) or default).strip() or default


async def emit_trade_event(
    event_type: str,
    tenant_id: Any,
    trade_id: Any = None,
    **data: Any,
) -> bool:
    topic = _topic("KAFKA_TOPIC_TRADE_EVENTS", "trade-events")

    payload = {
        "event": event_type,
        "tenant_id": str(tenant_id),
        "trade_id": str(trade_id) if trade_id is not None else None,
        "data": data,
        "ts": datetime.now(timezone.utc).isoformat(),
    }

    return await publish_event(topic, payload)


async def emit_import_event(
    event_type: str,
    tenant_id: Any,
    import_id: Any = None,
    **data: Any,
) -> bool:
    topic = _topic("KAFKA_TOPIC_IMPORT_EVENTS", "import-events")

    payload = {
        "event": event_type,
        "tenant_id": str(tenant_id),
        "import_id": str(import_id) if import_id is not None else None,
        "data": data,
        "ts": datetime.now(timezone.utc).isoformat(),
    }

    return await publish_event(topic, payload)