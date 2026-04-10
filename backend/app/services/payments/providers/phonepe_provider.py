from __future__ import annotations

import base64
import hashlib
import hmac
import json
from urllib.parse import quote_plus
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, Optional

import httpx

from app.services.payments.provider_base import (
    CreateIntentResult,
    FetchStatusResult,
    PaymentProvider,
    WebhookVerificationResult,
)


class PhonePeProvider(PaymentProvider):
    provider_name = "PHONEPE"

    def _is_direct_upi_mode(self) -> bool:
        return str(self.config.get("mode", "")).upper() == "DIRECT_UPI" and bool(self.config.get("upi_id"))

    def _base_url(self) -> str:
        return self.config.get("base_url", "https://api.phonepe.com/apis/pg")

    def _merchant_id(self) -> str:
        return self.config["merchant_id"]

    def _auth_headers(self) -> Dict[str, str]:
        cached_token = self.config.get("_access_token")
        cached_expiry = self.config.get("_access_token_expires_at")
        now_epoch = int(datetime.now(timezone.utc).timestamp())
        if cached_token and cached_expiry and now_epoch < int(cached_expiry) - 30:
            token_type = self.config.get("_access_token_type", "O-Bearer")
            return {"Authorization": f"{token_type} {cached_token}"}

        token = self.config.get("bearer_token")
        if token:
            return {"Authorization": f"O-Bearer {token}"}

        client_id = self.config.get("client_id")
        client_secret = self.config.get("client_secret")
        client_version = self.config.get("client_version", 1)
        auth_path = self.config.get("auth_path", "/v1/oauth/token")
        if not client_id or not client_secret:
            raise ValueError("PhonePe config missing bearer_token or client credentials")

        with httpx.Client(base_url=self._base_url(), timeout=20.0) as client:
            response = client.post(
                auth_path,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "client_version": client_version,
                    "grant_type": "client_credentials",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            data = response.json()
        token = data.get("access_token") or data.get("token")
        if not token:
            raise ValueError("PhonePe auth response missing access token")
        token_type = data.get("token_type", "O-Bearer")
        expires_at = data.get("expires_at")
        self.config["_access_token"] = token
        self.config["_access_token_type"] = token_type
        self.config["_access_token_expires_at"] = expires_at or (now_epoch + 600)
        return {"Authorization": f"{token_type} {token}"}

    def create_intent(
        self,
        *,
        amount: Decimal,
        merchant_txn_id: str,
        student_name: str,
        student_email: Optional[str],
        student_phone: Optional[str],
        metadata: Dict[str, Any],
    ) -> CreateIntentResult:
        if self._is_direct_upi_mode():
            payee = self.config.get("upi_id")
            payee_name = self.config.get("payee_name", "HMS Hostel")
            currency = self.config.get("currency", "INR")
            expires_in = int(self.config.get("expires_in_seconds", 900))
            note = self.config.get("payment_message", "Hostel rent payment")
            amount_str = str(amount.quantize(Decimal("0.01")))
            upi_intent_url = (
                "upi://pay"
                f"?pa={quote_plus(payee)}"
                f"&pn={quote_plus(payee_name)}"
                f"&am={quote_plus(amount_str)}"
                f"&cu={quote_plus(currency)}"
                f"&tn={quote_plus(note)}"
                f"&tr={quote_plus(merchant_txn_id)}"
            )
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            return CreateIntentResult(
                provider=self.provider_name,
                merchant_txn_id=merchant_txn_id,
                checkout_url=None,
                upi_intent_url=upi_intent_url,
                qr_payload=upi_intent_url,
                expires_at=expires_at,
                gateway_txn_id=None,
                raw_response={
                    "mode": "DIRECT_UPI",
                    "upi_id": payee,
                    "merchantOrderId": merchant_txn_id,
                    "amount": amount_str,
                },
            )

        payload = {
            "merchantOrderId": merchant_txn_id,
            "amount": int((amount * Decimal("100")).quantize(Decimal("1"))),
            "expireAfter": int(self.config.get("expires_in_seconds", 900)),
            "metaInfo": metadata,
            "paymentFlow": {
                "type": "PG_CHECKOUT",
                "message": self.config.get("payment_message", "Hostel rent payment"),
                "merchantUrls": {
                    "redirectUrl": self.config.get("redirect_url", ""),
                },
            },
        }
        if student_phone:
            payload["paymentFlow"]["merchantUrls"]["callbackUrl"] = self.config.get("callback_url", "")
            payload["customerMobile"] = student_phone
        if student_email:
            payload["customerEmail"] = student_email
        if student_name:
            payload["customerName"] = student_name

        create_path = self.config.get("create_payment_path", "/checkout/v2/pay")
        with httpx.Client(base_url=self._base_url(), timeout=20.0) as client:
            response = client.post(
                create_path,
                json=payload,
                headers={
                    **self._auth_headers(),
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            data = response.json()

        data_block = data.get("data", {})
        instrument = data_block.get("instrumentResponse", {})
        redirect_info = instrument.get("redirectInfo", {})
        expire_at_ms = data.get("expireAt") or data_block.get("expireAt")
        expires_at = (
            datetime.fromtimestamp(int(expire_at_ms) / 1000, tz=timezone.utc)
            if expire_at_ms
            else datetime.now(timezone.utc) + timedelta(seconds=int(payload["expireAfter"]))
        )
        return CreateIntentResult(
            provider=self.provider_name,
            merchant_txn_id=merchant_txn_id,
            checkout_url=(
                redirect_info.get("url")
                or data.get("redirectUrl")
                or data_block.get("redirectUrl")
            ),
            upi_intent_url=data_block.get("intentUrl"),
            qr_payload=(instrument.get("qrData") or data_block.get("qrData") or data_block.get("qrString")),
            expires_at=expires_at,
            gateway_txn_id=data.get("orderId") or data_block.get("transactionId") or data_block.get("paymentId"),
            raw_response=data,
        )

    def verify_webhook(self, headers: Dict[str, str], body: bytes) -> WebhookVerificationResult:
        if self._is_direct_upi_mode():
            raise ValueError("Webhook verification is not supported in DIRECT_UPI mode")

        header_map = {k.lower(): v for k, v in headers.items()}
        provided = (header_map.get("x-verify") or "").strip()
        salt_key = self.config.get("salt_key")
        salt_index = self.config.get("salt_index")
        if provided and salt_key and salt_index is not None:
            encoded_payload = base64.b64encode(body).decode("utf-8")
            digest = hashlib.sha256(f"{encoded_payload}{salt_key}".encode("utf-8")).hexdigest()
            expected = f"{digest}###{salt_index}"
            if not hmac.compare_digest(provided, expected):
                raise ValueError("Invalid PhonePe webhook signature")

        data = json.loads(body.decode("utf-8"))
        payload = data.get("payload", data)
        merchant_txn_id = (
            payload.get("merchantOrderId")
            or payload.get("merchantTransactionId")
            or payload.get("merchantTxnId")
        )
        gateway_txn_id = payload.get("transactionId") or payload.get("transaction_id")
        amount_value = payload.get("amount")
        amount = Decimal(str(amount_value)) / Decimal("100") if amount_value is not None else None
        state = payload.get("state") or payload.get("status") or "PENDING"
        normalized = {
            "COMPLETED": "SUCCESS",
            "SUCCESS": "SUCCESS",
            "FAILED": "FAILED",
            "EXPIRED": "EXPIRED",
            "CANCELLED": "CANCELLED",
        }.get(str(state).upper(), "PENDING")
        if not merchant_txn_id:
            raise ValueError("PhonePe webhook missing merchant transaction id")
        return WebhookVerificationResult(
            merchant_txn_id=merchant_txn_id,
            gateway_txn_id=gateway_txn_id,
            status=normalized,
            amount=amount,
            raw_event=data,
        )

    def fetch_status(self, *, merchant_txn_id: str, gateway_txn_id: Optional[str] = None) -> FetchStatusResult:
        if self._is_direct_upi_mode():
            return FetchStatusResult(
                status="PENDING",
                gateway_txn_id=gateway_txn_id,
                raw_status={"mode": "DIRECT_UPI", "merchant_txn_id": merchant_txn_id, "status": "PENDING"},
            )

        status_template = self.config.get(
            "status_path_template",
            "/checkout/v2/order/{merchant_txn_id}/status",
        )
        path = status_template.format(
            merchant_txn_id=merchant_txn_id,
            gateway_txn_id=gateway_txn_id or "",
            merchant_id=self._merchant_id(),
        )
        with httpx.Client(base_url=self._base_url(), timeout=20.0) as client:
            response = client.get(path, headers=self._auth_headers())
            response.raise_for_status()
            data = response.json()
        payload = data.get("data", data)
        state = payload.get("state") or payload.get("status") or "PENDING"
        normalized = {
            "COMPLETED": "SUCCESS",
            "SUCCESS": "SUCCESS",
            "FAILED": "FAILED",
            "EXPIRED": "EXPIRED",
            "CANCELLED": "CANCELLED",
        }.get(str(state).upper(), "PENDING")
        return FetchStatusResult(
            status=normalized,
            gateway_txn_id=payload.get("transactionId") or payload.get("paymentId") or gateway_txn_id,
            raw_status=data,
        )
