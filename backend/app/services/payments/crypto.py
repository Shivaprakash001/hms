from __future__ import annotations

import base64
import hashlib
import json
import os
from typing import Any, Dict

from cryptography.fernet import Fernet, InvalidToken

from app.utils.logger import get_logger

logger = get_logger(__name__)


def _build_fernet() -> Fernet:
    raw_key = os.getenv("PAYMENT_CONFIG_ENCRYPTION_KEY")
    if not raw_key:
        raise ValueError("PAYMENT_CONFIG_ENCRYPTION_KEY is not configured")

    digest = hashlib.sha256(raw_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_config(config: Dict[str, Any]) -> str:
    fernet = _build_fernet()
    return fernet.encrypt(json.dumps(config).encode("utf-8")).decode("utf-8")


def decrypt_config(payload: str) -> Dict[str, Any]:
    fernet = _build_fernet()
    try:
        raw = fernet.decrypt(payload.encode("utf-8"))
    except InvalidToken as exc:
        logger.error("Unable to decrypt payment gateway configuration")
        raise ValueError("Invalid encrypted gateway configuration") from exc
    return json.loads(raw.decode("utf-8"))
