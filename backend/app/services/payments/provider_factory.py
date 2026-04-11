from __future__ import annotations

import os
from typing import Any, Dict, Tuple

from app.db import supabase
from app.services.payments.crypto import decrypt_config
from app.services.payments.providers.phonepe_provider import PhonePeProvider
from app.services.payments.providers.razorpay_provider import RazorpayProvider
from app.utils.logger import get_logger
from app.utils.responses import ErrorCode, ServiceResponse

logger = get_logger(__name__)

PROVIDER_PRIORITY = ("PHONEPE", "RAZORPAY")


def _instantiate(provider: str, config: Dict[str, Any]):
    if provider == "PHONEPE":
        return PhonePeProvider(config)
    if provider == "RAZORPAY":
        return RazorpayProvider(config)
    raise ValueError(f"Unsupported payment provider: {provider}")


def _env_phonepe_config() -> Dict[str, Any] | None:
    direct_upi_id = os.getenv("PHONEPE_UPI_ID") or os.getenv("UPI_ID")
    if direct_upi_id:
        return {
            "mode": "DIRECT_UPI",
            "upi_id": direct_upi_id,
            "payee_name": os.getenv("PHONEPE_UPI_PAYEE_NAME", "HMS Hostel"),
            "currency": os.getenv("PHONEPE_UPI_CURRENCY", "INR"),
            "expires_in_seconds": int(os.getenv("PHONEPE_UPI_EXPIRES_IN_SECONDS", "900")),
        }

    merchant_id = os.getenv("PHONEPE_MERCHANT_ID")
    client_id = os.getenv("PHONEPE_CLIENT_ID")
    client_secret = os.getenv("PHONEPE_CLIENT_SECRET")
    base_url = os.getenv("PHONEPE_BASE_URL")

    if not client_id or not client_secret or not base_url:
        return None

    return {
        "merchant_id": merchant_id or client_id.split("_", 1)[0],
        "client_id": client_id,
        "client_secret": client_secret,
        "client_version": int(os.getenv("PHONEPE_CLIENT_VERSION", "1")),
        "base_url": base_url,
        "redirect_url": os.getenv("PHONEPE_REDIRECT_URL", ""),
        "callback_url": os.getenv("PHONEPE_CALLBACK_URL", ""),
        "auth_path": os.getenv("PHONEPE_AUTH_PATH", "/v1/oauth/token"),
        "create_payment_path": os.getenv("PHONEPE_CREATE_PAYMENT_PATH", "/checkout/v2/pay"),
        "status_path_template": os.getenv("PHONEPE_STATUS_PATH_TEMPLATE", "/checkout/v2/order/{merchant_txn_id}/status"),
        "webhook_path": os.getenv("PHONEPE_WEBHOOK_PATH", "/webhooks/phonepe"),
        "payment_message": os.getenv("PHONEPE_PAYMENT_MESSAGE", "Hostel rent payment"),
        "expires_in_seconds": int(os.getenv("PHONEPE_EXPIRES_IN_SECONDS", "900")),
        "salt_key": os.getenv("PHONEPE_SALT_KEY"),
        "salt_index": os.getenv("PHONEPE_SALT_INDEX"),
        "environment": os.getenv("PHONEPE_ENV", "sandbox"),
    }


def _owner_phonepe_overrides(owner_id: str) -> Dict[str, Any]:
    try:
        hostels = supabase.table("hostels") \
            .select("phonepe_merchant_id") \
            .eq("owner_id", owner_id) \
            .eq("is_active", True) \
            .limit(1) \
            .execute()
        row = (hostels.data or [{}])[0]
        merchant_id = (row.get("phonepe_merchant_id") or "").strip()
        if merchant_id:
            return {"merchant_id": merchant_id}
    except Exception as exc:
        logger.warning("Failed to load owner PhonePe overrides owner_id=%s error=%s", owner_id, exc)
    return {}


def get_provider_for_owner(owner_id: str) -> Tuple[Any, Dict[str, Any]] | Tuple[None, Dict[str, Any]]:
    owner_overrides = _owner_phonepe_overrides(owner_id)

    res = supabase.table("payment_gateway_configs") \
        .select("*") \
        .eq("owner_id", owner_id) \
        .eq("is_active", True) \
        .execute()

    configs = res.data or []
    if not configs:
        env_phonepe = _env_phonepe_config()
        if env_phonepe:
            env_phonepe = {**env_phonepe, **owner_overrides}
            return _instantiate("PHONEPE", env_phonepe), {
                "owner_id": owner_id,
                "provider": "PHONEPE",
                "source": "env",
                "is_default": True,
                "is_active": True,
            }
        return None, ServiceResponse.error(
            ErrorCode.RESOURCE_NOT_FOUND,
            "Payment provider not configured for this owner.",
        )

    default_config = next((cfg for cfg in configs if cfg.get("is_default")), None)
    ordered = [default_config] if default_config else []
    ordered.extend(
        cfg for provider in PROVIDER_PRIORITY for cfg in configs
        if cfg is not default_config and cfg.get("provider") == provider
    )

    for config_row in ordered:
        if not config_row:
            continue
        try:
            decrypted = decrypt_config(config_row["encrypted_config"])
            if config_row.get("provider") == "PHONEPE" and owner_overrides.get("merchant_id"):
                decrypted["merchant_id"] = owner_overrides["merchant_id"]
            provider = _instantiate(config_row["provider"], decrypted)
            return provider, config_row
        except Exception as exc:  # pragma: no cover - protective fallback
            logger.exception("Failed to load payment provider config: %s", exc)

    return None, ServiceResponse.error(
        ErrorCode.INVALID_INPUT,
        "Configured payment providers could not be loaded.",
    )
