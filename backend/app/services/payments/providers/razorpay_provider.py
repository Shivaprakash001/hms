from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Optional

import httpx

from app.services.payments.provider_base import (
    CreateIntentResult,
    FetchStatusResult,
    PaymentProvider,
    WebhookVerificationResult,
)


class RazorpayProvider(PaymentProvider):
    provider_name = "RAZORPAY"

    def _base_url(self) -> str:
        return self.config.get("base_url", "https://api.razorpay.com")

    def _auth(self) -> httpx.BasicAuth:
        return httpx.BasicAuth(self.config["key_id"], self.config["key_secret"])

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
        expire_by = int(datetime.now(timezone.utc).timestamp()) + int(self.config.get("expires_in_seconds", 900))
        payload = {
            "amount": int((amount * Decimal("100")).quantize(Decimal("1"))),
            "currency": self.config.get("currency", "INR"),
            "accept_partial": False,
            "expire_by": expire_by,
            "reference_id": merchant_txn_id,
            "description": self.config.get("description", "Hostel rent payment"),
            "upi_link": True,
            "notify": {"sms": False, "email": False},
            "notes": metadata,
        }
        if student_name or student_email or student_phone:
            payload["customer"] = {
                "name": student_name or "Student",
                "email": student_email or "",
                "contact": student_phone or "",
            }

        with httpx.Client(base_url=self._base_url(), timeout=20.0, auth=self._auth()) as client:
            response = client.post("/v1/payment_links", json=payload)
            response.raise_for_status()
            data = response.json()

        upi_link = data.get("short_url") or data.get("upi_link")
        qr_payload = (
            data.get("upi_qr")
            or data.get("qr_code")
            or data.get("notes", {}).get("qr_payload")
            or upi_link
        )
        expires_at = datetime.fromtimestamp(expire_by, tz=timezone.utc)
        return CreateIntentResult(
            provider=self.provider_name,
            merchant_txn_id=merchant_txn_id,
            checkout_url=upi_link,
            upi_intent_url=upi_link,
            qr_payload=qr_payload,
            expires_at=expires_at,
            gateway_txn_id=data.get("id"),
            raw_response=data,
        )

    def verify_webhook(self, headers: Dict[str, str], body: bytes) -> WebhookVerificationResult:
        signature = headers.get("X-Razorpay-Signature") or headers.get("x-razorpay-signature")
        secret = self.config.get("webhook_secret")
        if secret:
            if not signature:
                raise ValueError("Missing Razorpay webhook signature")
            expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature, expected):
                raise ValueError("Invalid Razorpay webhook signature")

        data = json.loads(body.decode("utf-8"))
        payload = data.get("payload", {})
        payment_link = payload.get("payment_link", {}).get("entity", {})
        payment_entity = payload.get("payment", {}).get("entity", {})
        merchant_txn_id = payment_link.get("reference_id") or payment_entity.get("notes", {}).get("merchant_txn_id")
        status = payment_link.get("status") or payment_entity.get("status") or "created"
        normalized = {
            "paid": "SUCCESS",
            "captured": "SUCCESS",
            "cancelled": "CANCELLED",
            "expired": "EXPIRED",
            "failed": "FAILED",
        }.get(str(status).lower(), "PENDING")
        amount_value = payment_entity.get("amount") or payment_link.get("amount")
        amount = Decimal(str(amount_value)) / Decimal("100") if amount_value is not None else None
        if not merchant_txn_id:
            raise ValueError("Razorpay webhook missing merchant transaction id")
        return WebhookVerificationResult(
            merchant_txn_id=merchant_txn_id,
            gateway_txn_id=payment_entity.get("id") or payment_link.get("id"),
            status=normalized,
            amount=amount,
            raw_event=data,
        )

    def fetch_status(self, *, merchant_txn_id: str, gateway_txn_id: Optional[str] = None) -> FetchStatusResult:
        if not gateway_txn_id:
            raise ValueError("Razorpay status checks require gateway transaction id")
        with httpx.Client(base_url=self._base_url(), timeout=20.0, auth=self._auth()) as client:
            response = client.get(f"/v1/payment_links/{gateway_txn_id}")
            response.raise_for_status()
            data = response.json()
        normalized = {
            "paid": "SUCCESS",
            "cancelled": "CANCELLED",
            "expired": "EXPIRED",
            "created": "PENDING",
        }.get(str(data.get("status", "")).lower(), "PENDING")
        return FetchStatusResult(
            status=normalized,
            gateway_txn_id=data.get("id"),
            raw_status=data,
        )
