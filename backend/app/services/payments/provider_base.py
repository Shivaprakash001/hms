from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional


@dataclass
class CreateIntentResult:
    provider: str
    merchant_txn_id: str
    checkout_url: Optional[str]
    upi_intent_url: Optional[str]
    qr_payload: Optional[str]
    expires_at: Optional[datetime]
    gateway_txn_id: Optional[str]
    raw_response: Dict[str, Any]


@dataclass
class WebhookVerificationResult:
    merchant_txn_id: str
    gateway_txn_id: Optional[str]
    status: str
    amount: Optional[Decimal]
    raw_event: Dict[str, Any]


@dataclass
class FetchStatusResult:
    status: str
    gateway_txn_id: Optional[str]
    raw_status: Dict[str, Any]


class PaymentProvider(ABC):
    provider_name: str

    def __init__(self, config: Dict[str, Any]):
        self.config = config

    @abstractmethod
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
        raise NotImplementedError

    @abstractmethod
    def verify_webhook(self, headers: Dict[str, str], body: bytes) -> WebhookVerificationResult:
        raise NotImplementedError

    @abstractmethod
    def fetch_status(self, *, merchant_txn_id: str, gateway_txn_id: Optional[str] = None) -> FetchStatusResult:
        raise NotImplementedError
