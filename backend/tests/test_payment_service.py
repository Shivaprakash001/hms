import unittest
import os
from decimal import Decimal
from unittest.mock import Mock, patch

from app.services import payment_service
from app.services.payments import provider_factory


class FakeResponse:
    def __init__(self, data=None, count=None):
        self.data = data or []
        self.count = count


class FakeTable:
    def __init__(self, name, store):
        self.name = name
        self.store = store
        self._filters = []
        self._in_filters = []
        self._action = "select"
        self._payload = None

    def select(self, *args, **kwargs):
        self._action = "select"
        return self

    def insert(self, payload):
        self._action = "insert"
        self._payload = payload
        return self

    def update(self, payload):
        self._action = "update"
        self._payload = payload
        return self

    def eq(self, field, value):
        self._filters.append((field, value))
        return self

    def in_(self, field, values):
        self._in_filters.append((field, values))
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def execute(self):
        rows = self.store.setdefault(self.name, [])
        matched = [
            row for row in rows
            if all(str(row.get(field)) == str(value) for field, value in self._filters)
            and all(row.get(field) in values for field, values in self._in_filters)
        ]
        if self._action == "select":
            return FakeResponse(matched)
        if self._action == "insert":
            row = dict(self._payload)
            rows.append(row)
            return FakeResponse([row])
        if self._action == "update":
            for row in matched:
                row.update(self._payload)
            return FakeResponse(matched)
        raise AssertionError(f"Unsupported action: {self._action}")


class FakeSupabase:
    def __init__(self, store=None):
        self.store = store or {}

    def table(self, name):
        return FakeTable(name, self.store)


class PaymentServiceTests(unittest.TestCase):
    def test_provider_factory_prefers_default_phonepe(self):
        fake_supabase = FakeSupabase({
            "payment_gateway_configs": [
                {"owner_id": "owner-1", "provider": "RAZORPAY", "encrypted_config": "r", "is_active": True, "is_default": False},
                {"owner_id": "owner-1", "provider": "PHONEPE", "encrypted_config": "p", "is_active": True, "is_default": True},
            ]
        })

        with patch.object(provider_factory, "supabase", fake_supabase), \
             patch.object(provider_factory, "decrypt_config", side_effect=lambda payload: {"token": payload}), \
             patch.object(provider_factory, "_instantiate", side_effect=lambda provider, config: {"provider": provider, "config": config}):
            provider, row = provider_factory.get_provider_for_owner("owner-1")

        self.assertEqual(provider["provider"], "PHONEPE")
        self.assertEqual(row["provider"], "PHONEPE")

    def test_create_payment_intent_rejects_other_student(self):
        obligation = {
            "id": "ob1",
            "student_id": "student-a",
            "owner_id": "owner-1",
            "amount": "1000.00",
            "status": "PENDING",
            "students": {"profiles": {"name": "Alice", "email": "a@example.com", "phone": "9999999999"}},
        }

        with patch.object(payment_service, "_fetch_obligation", return_value=obligation):
            response = payment_service.create_payment_intent(
                "ob1",
                Decimal("500.00"),
                user_id="user-1",
                student_id="student-b",
            )

        self.assertFalse(response["success"])
        self.assertEqual(response["error"]["code"], "AUTH_002")

    def test_create_payment_intent_reuses_existing_pending_attempt(self):
        fake_supabase = FakeSupabase({
            "payment_attempts": [{
                "id": "attempt-9",
                "obligation_id": "ob9",
                "status": "PENDING",
                "provider": "PHONEPE",
                "merchant_txn_id": "merchant-9",
                "amount": "8500.00",
                "raw_create_response": {"redirectUrl": "https://checkout.example"},
            }]
        })
        obligation = {
            "id": "ob9",
            "student_id": "student-a",
            "owner_id": "owner-1",
            "amount": "8500.00",
            "status": "PENDING",
            "students": {"profiles": {"name": "Alice", "email": "a@example.com", "phone": "9999999999"}},
        }

        with patch.object(payment_service, "supabase", fake_supabase), \
             patch.object(payment_service, "_fetch_obligation", return_value=obligation), \
             patch.object(payment_service, "_get_existing_paid_amount", return_value=Decimal("0")):
            response = payment_service.create_payment_intent("ob9", Decimal("8500.00"), user_id="owner-1", student_id="student-a")

        self.assertTrue(response["success"])
        self.assertEqual(response["data"]["attempt_id"], "attempt-9")
        self.assertEqual(response["data"]["checkout_url"], "https://checkout.example")

    def test_provider_factory_uses_direct_upi_env_fallback(self):
        fake_supabase = FakeSupabase({"payment_gateway_configs": []})

        with patch.object(provider_factory, "supabase", fake_supabase), patch.dict(
            os.environ,
            {
                "PHONEPE_UPI_ID": "8008046952@ybl",
                "PHONEPE_UPI_PAYEE_NAME": "HMS Test",
            },
            clear=False,
        ):
            provider, row = provider_factory.get_provider_for_owner("owner-1")

        self.assertEqual(provider.provider_name, "PHONEPE")
        self.assertEqual(row["source"], "env")

        intent = provider.create_intent(
            amount=Decimal("100.00"),
            merchant_txn_id="txn-1",
            student_name="Alice",
            student_email=None,
            student_phone=None,
            metadata={},
        )
        self.assertTrue(intent.upi_intent_url.startswith("upi://pay"))
        self.assertIn("8008046952%40ybl", intent.upi_intent_url)

    def test_finalize_payment_attempt_is_idempotent_when_payment_exists(self):
        fake_supabase = FakeSupabase({
            "payments": [{"id": "pay-1", "payment_attempt_id": "attempt-1"}],
            "payment_attempts": [{"id": "attempt-1", "status": "PENDING", "provider": "PHONEPE", "amount": "1000.00"}],
        })
        attempt = {
            "id": "attempt-1",
            "status": "PENDING",
            "obligation_id": "ob1",
            "amount": "1000.00",
            "owner_id": "owner-1",
            "merchant_txn_id": "merchant-1",
            "provider": "PHONEPE",
        }

        with patch.object(payment_service, "supabase", fake_supabase), \
             patch.object(payment_service, "record_payment") as record_payment:
            response = payment_service.finalize_payment_attempt(
                attempt,
                status="SUCCESS",
                gateway_txn_id="gateway-1",
                raw_payload={"status": "SUCCESS"},
            )

        self.assertTrue(response["success"])
        self.assertEqual(fake_supabase.store["payment_attempts"][0]["status"], "SUCCESS")
        record_payment.assert_not_called()

    def test_finalize_payment_attempt_records_payment_once(self):
        fake_supabase = FakeSupabase({
            "payments": [],
            "payment_attempts": [{"id": "attempt-2", "status": "PENDING", "provider": "PHONEPE", "amount": "750.00"}],
        })
        attempt = {
            "id": "attempt-2",
            "status": "PENDING",
            "obligation_id": "ob2",
            "amount": "750.00",
            "owner_id": "owner-2",
            "merchant_txn_id": "merchant-2",
            "provider": "PHONEPE",
        }

        with patch.object(payment_service, "supabase", fake_supabase), \
             patch.object(payment_service, "record_payment", return_value={"success": True, "data": {"payment": {"id": "pay-2"}}}) as record_payment:
            response = payment_service.finalize_payment_attempt(
                attempt,
                status="SUCCESS",
                gateway_txn_id="gateway-2",
                raw_payload={"status": "SUCCESS"},
            )

        self.assertTrue(response["success"])
        self.assertEqual(fake_supabase.store["payment_attempts"][0]["status"], "SUCCESS")
        record_payment.assert_called_once()


if __name__ == "__main__":
    unittest.main()
