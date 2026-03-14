"""
Unit tests for payment service: webhook idempotency, verification, reconciliation,
and rent generation idempotency.

These tests use mocking so they do not hit any real databases or Razorpay APIs.
"""
import pytest
import hmac
import hashlib
import json
from decimal import Decimal
from unittest.mock import MagicMock, patch, call
from datetime import date


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_razorpay_signature(payload: str, secret: str) -> str:
    """Compute the expected HMAC-SHA256 signature the way Razorpay does it."""
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


def _make_webhook_event(
    event_type: str = "order.paid",
    obligation_id: str = "ob-001",
    student_id: str = "st-001",
    payment_id: str = "pay_ABC",
    amount_paise: int = 500000,
):
    return {
        "event": event_type,
        "payload": {
            "order": {
                "entity": {
                    "id": "order_XYZ",
                    "notes": {
                        "obligation_id": obligation_id,
                        "student_id": student_id,
                    },
                }
            },
            "payment": {
                "entity": {
                    "id": payment_id,
                    "amount": amount_paise,
                    "method": "upi",
                    "status": "captured",
                }
            },
        },
    }


# ---------------------------------------------------------------------------
# Webhook signature validation tests
# ---------------------------------------------------------------------------

class TestWebhookSignatureValidation:
    """
    Tests for verify_webhook_signature().
    Ensures the signature gate works before any DB operations.
    """

    def test_valid_signature_returns_true(self):
        from backend.app.services import payment_service as ps

        secret = "test_webhook_secret"
        payload_str = '{"event":"order.paid"}'
        sig = _make_razorpay_signature(payload_str, secret)

        # Mock Razorpay client and env var
        mock_client = MagicMock()
        mock_client.utility.verify_webhook_signature.return_value = None  # no exception = valid

        with patch.object(ps, "razorpay_client", mock_client), \
             patch.object(ps, "RAZORPAY_WEBHOOK_SECRET", secret):
            result = ps.verify_webhook_signature(payload_str.encode(), sig)

        assert result is True
        mock_client.utility.verify_webhook_signature.assert_called_once_with(
            payload_str, sig, secret
        )

    def test_invalid_signature_returns_false(self):
        from backend.app.services import payment_service as ps

        mock_client = MagicMock()
        mock_client.utility.verify_webhook_signature.side_effect = Exception("SignatureError")

        with patch.object(ps, "razorpay_client", mock_client), \
             patch.object(ps, "RAZORPAY_WEBHOOK_SECRET", "secret"):
            result = ps.verify_webhook_signature(b'{"event":"order.paid"}', "bad_sig")

        assert result is False

    def test_no_client_returns_false(self):
        from backend.app.services import payment_service as ps

        with patch.object(ps, "razorpay_client", None), \
             patch.object(ps, "RAZORPAY_WEBHOOK_SECRET", "secret"):
            result = ps.verify_webhook_signature(b'payload', "sig")

        assert result is False

    def test_no_webhook_secret_returns_false(self):
        from backend.app.services import payment_service as ps

        with patch.object(ps, "razorpay_client", MagicMock()), \
             patch.object(ps, "RAZORPAY_WEBHOOK_SECRET", None):
            result = ps.verify_webhook_signature(b'payload', "sig")

        assert result is False


# ---------------------------------------------------------------------------
# Webhook idempotency tests
# ---------------------------------------------------------------------------

class TestWebhookIdempotency:
    """
    Tests for handle_razorpay_webhook() deduplication logic.
    A second delivery of the same payment ID must be silently ignored.
    """

    def _mock_supabase_for_webhook(self, supabase_mock, obligation_status="PENDING"):
        """Configure a supabase mock to satisfy the webhook checks."""
        ob_mock = MagicMock()
        ob_mock.data = [{"id": "ob-001", "student_id": "st-001", "status": obligation_status}]
        supabase_mock.table.return_value.select.return_value\
            .eq.return_value.execute.return_value = ob_mock

    def test_first_event_is_processed(self):
        from backend.app.services import payment_service as ps

        # Clear dedup set for isolation
        ps._processed_event_ids.clear()

        event = _make_webhook_event(payment_id="pay_NEW1")
        mock_sb = MagicMock()
        self._mock_supabase_for_webhook(mock_sb)

        with patch.object(ps, "supabase", mock_sb), \
             patch.object(ps, "record_payment") as mock_record:
            mock_record.return_value = {"success": True, "data": {"obligation_status": "PAID"}}
            result = ps.handle_razorpay_webhook(event)

        assert result["success"] is True
        mock_record.assert_called_once()

    def test_duplicate_event_is_skipped(self):
        from backend.app.services import payment_service as ps

        ps._processed_event_ids.clear()
        event = _make_webhook_event(payment_id="pay_DUP")

        mock_sb = MagicMock()
        self._mock_supabase_for_webhook(mock_sb)

        with patch.object(ps, "supabase", mock_sb), \
             patch.object(ps, "record_payment") as mock_record:
            mock_record.return_value = {"success": True, "data": {}}
            # First delivery
            ps.handle_razorpay_webhook(event)
            # Second delivery (duplicate)
            result = ps.handle_razorpay_webhook(event)

        assert result["success"] is True
        assert "already processed" in result["message"].lower() or \
               "duplicate" in result["message"].lower()
        # record_payment should have been called only once
        assert mock_record.call_count == 1

    def test_unhandled_event_type_is_acknowledged(self):
        from backend.app.services import payment_service as ps

        ps._processed_event_ids.clear()
        event = {"event": "subscription.activated", "payload": {}}

        result = ps.handle_razorpay_webhook(event)

        assert result["success"] is True
        assert "acknowledged" in result["message"].lower()

    def test_paid_obligation_is_not_reprocessed(self):
        """State machine guard: no payment recorded if obligation is already PAID."""
        from backend.app.services import payment_service as ps

        ps._processed_event_ids.clear()
        event = _make_webhook_event(payment_id="pay_ALREADY_PAID")

        mock_sb = MagicMock()
        self._mock_supabase_for_webhook(mock_sb, obligation_status="PAID")

        with patch.object(ps, "supabase", mock_sb), \
             patch.object(ps, "record_payment") as mock_record:
            result = ps.handle_razorpay_webhook(event)

        assert result["success"] is True
        mock_record.assert_not_called()

    def test_waived_obligation_ignores_payment(self):
        """State machine guard: no payment recorded for a waived obligation."""
        from backend.app.services import payment_service as ps

        ps._processed_event_ids.clear()
        event = _make_webhook_event(payment_id="pay_WAIVED")

        mock_sb = MagicMock()
        self._mock_supabase_for_webhook(mock_sb, obligation_status="WAIVED")

        with patch.object(ps, "supabase", mock_sb), \
             patch.object(ps, "record_payment") as mock_record:
            result = ps.handle_razorpay_webhook(event)

        assert result["success"] is True
        mock_record.assert_not_called()


# ---------------------------------------------------------------------------
# Verification endpoint tests
# ---------------------------------------------------------------------------

class TestVerifyRazorpayPayment:
    """
    Tests for verify_razorpay_payment().
    """

    def _mock_razorpay_client(self, signature_valid: bool = True):
        mock_client = MagicMock()
        if not signature_valid:
            mock_client.utility.verify_payment_signature.side_effect = Exception("Invalid signature")
        return mock_client

    def test_invalid_signature_returns_forbidden(self):
        from backend.app.services import payment_service as ps
        from backend.app.utils.responses import ErrorCode

        mock_client = self._mock_razorpay_client(signature_valid=False)
        with patch.object(ps, "razorpay_client", mock_client), \
             patch.object(ps, "RAZORPAY_KEY_SECRET", "secret"):
            result = ps.verify_razorpay_payment(
                razorpay_order_id="order_XYZ",
                razorpay_payment_id="pay_FAKE",
                razorpay_signature="bad_sig",
                obligation_id=None,
                student_id="st-001",
            )

        assert result["success"] is False
        assert result["error"]["code"] == ErrorCode.FORBIDDEN.value

    def test_valid_signature_records_payment(self):
        from backend.app.services import payment_service as ps

        mock_client = self._mock_razorpay_client(signature_valid=True)
        mock_client.order.fetch.return_value = {
            "notes": {"obligation_id": "ob-001", "student_id": "st-001"}
        }
        mock_client.payment.fetch.return_value = {
            "amount": 500000,
            "method": "upi",
        }

        mock_sb = MagicMock()
        ob_res = MagicMock()
        ob_res.data = [{"id": "ob-001", "student_id": "st-001", "amount": "5000.00", "status": "PENDING"}]
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value = ob_res

        with patch.object(ps, "razorpay_client", mock_client), \
             patch.object(ps, "RAZORPAY_KEY_SECRET", "secret"), \
             patch.object(ps, "supabase", mock_sb), \
             patch.object(ps, "record_payment") as mock_record:
            mock_record.return_value = {
                "success": True,
                "data": {"obligation_status": "PAID"},
            }
            result = ps.verify_razorpay_payment(
                razorpay_order_id="order_XYZ",
                razorpay_payment_id="pay_GOOD",
                razorpay_signature="valid_sig",
                obligation_id="ob-001",
                student_id="st-001",
            )

        assert result["success"] is True
        assert result["data"]["obligation_status"] == "PAID"
        mock_record.assert_called_once()

    def test_wrong_student_ownership_returns_forbidden(self):
        from backend.app.services import payment_service as ps
        from backend.app.utils.responses import ErrorCode

        mock_client = self._mock_razorpay_client(signature_valid=True)

        mock_sb = MagicMock()
        ob_res = MagicMock()
        # Different student_id than what's provided
        ob_res.data = [{"id": "ob-001", "student_id": "st-OTHER", "amount": "5000.00", "status": "PENDING"}]
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value = ob_res

        with patch.object(ps, "razorpay_client", mock_client), \
             patch.object(ps, "RAZORPAY_KEY_SECRET", "secret"), \
             patch.object(ps, "supabase", mock_sb):
            result = ps.verify_razorpay_payment(
                razorpay_order_id="order_XYZ",
                razorpay_payment_id="pay_GOOD",
                razorpay_signature="valid_sig",
                obligation_id="ob-001",
                student_id="st-001",
            )

        assert result["success"] is False
        assert result["error"]["code"] == ErrorCode.FORBIDDEN.value

    def test_already_paid_obligation_returns_success_idempotently(self):
        from backend.app.services import payment_service as ps

        mock_client = self._mock_razorpay_client(signature_valid=True)

        mock_sb = MagicMock()
        ob_res = MagicMock()
        ob_res.data = [{"id": "ob-001", "student_id": "st-001", "amount": "5000.00", "status": "PAID"}]
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value = ob_res

        with patch.object(ps, "razorpay_client", mock_client), \
             patch.object(ps, "RAZORPAY_KEY_SECRET", "secret"), \
             patch.object(ps, "supabase", mock_sb), \
             patch.object(ps, "record_payment") as mock_record:
            result = ps.verify_razorpay_payment(
                razorpay_order_id="order_XYZ",
                razorpay_payment_id="pay_GOOD",
                razorpay_signature="valid_sig",
                obligation_id="ob-001",
                student_id="st-001",
            )

        assert result["success"] is True
        assert result["data"]["obligation_status"] == "PAID"
        mock_record.assert_not_called()


# ---------------------------------------------------------------------------
# Reconciliation tests
# ---------------------------------------------------------------------------

class TestReconcilePendingPayments:
    """
    Tests for reconcile_pending_payments().
    """

    def test_reconciles_captured_payment(self):
        from backend.app.services import payment_service as ps

        mock_client = MagicMock()
        mock_client.payment.fetch.return_value = {"status": "captured", "amount": 500000, "method": "upi"}

        mock_sb = MagicMock()
        # payments table result
        pay_res = MagicMock()
        pay_res.data = [{"id": "local-pay-1", "reference_number": "pay_CAP", "obligation_id": "ob-001", "amount_paid": "5000.00"}]
        # obligation check result
        ob_res = MagicMock()
        ob_res.data = [{"status": "PENDING", "amount": "5000.00", "student_id": "st-001"}]

        def table_side_effect(table_name):
            mock_table = MagicMock()
            if table_name == "payments":
                mock_table.select.return_value.neq.return_value.execute.return_value = pay_res
            elif table_name == "rent_obligations":
                mock_table.select.return_value.eq.return_value.execute.return_value = ob_res
            return mock_table

        mock_sb.table.side_effect = table_side_effect

        with patch.object(ps, "razorpay_client", mock_client), \
             patch.object(ps, "supabase", mock_sb), \
             patch.object(ps, "record_payment") as mock_record:
            mock_record.return_value = {"success": True, "data": {"obligation_status": "PAID"}}
            result = ps.reconcile_pending_payments()

        assert result["success"] is True
        assert result["data"]["reconciled"] == 1
        mock_record.assert_called_once()

    def test_skips_already_paid_obligations(self):
        from backend.app.services import payment_service as ps

        mock_client = MagicMock()

        mock_sb = MagicMock()
        pay_res = MagicMock()
        pay_res.data = [{"id": "local-pay-2", "reference_number": "pay_DONE", "obligation_id": "ob-002", "amount_paid": "3000.00"}]
        ob_res = MagicMock()
        ob_res.data = [{"status": "PAID", "amount": "3000.00", "student_id": "st-002"}]

        def table_side_effect(table_name):
            mock_table = MagicMock()
            if table_name == "payments":
                mock_table.select.return_value.neq.return_value.execute.return_value = pay_res
            elif table_name == "rent_obligations":
                mock_table.select.return_value.eq.return_value.execute.return_value = ob_res
            return mock_table

        mock_sb.table.side_effect = table_side_effect

        with patch.object(ps, "razorpay_client", mock_client), \
             patch.object(ps, "supabase", mock_sb), \
             patch.object(ps, "record_payment") as mock_record:
            result = ps.reconcile_pending_payments()

        assert result["success"] is True
        assert result["data"]["already_captured"] == 1
        mock_record.assert_not_called()

    def test_handles_razorpay_fetch_error_gracefully(self):
        from backend.app.services import payment_service as ps

        mock_client = MagicMock()
        mock_client.payment.fetch.side_effect = Exception("Network error")

        mock_sb = MagicMock()
        pay_res = MagicMock()
        pay_res.data = [{"id": "local-pay-3", "reference_number": "pay_ERR", "obligation_id": "ob-003", "amount_paid": "4000.00"}]
        ob_res = MagicMock()
        ob_res.data = [{"status": "PENDING", "amount": "4000.00", "student_id": "st-003"}]

        def table_side_effect(table_name):
            mock_table = MagicMock()
            if table_name == "payments":
                mock_table.select.return_value.neq.return_value.execute.return_value = pay_res
            elif table_name == "rent_obligations":
                mock_table.select.return_value.eq.return_value.execute.return_value = ob_res
            return mock_table

        mock_sb.table.side_effect = table_side_effect

        with patch.object(ps, "razorpay_client", mock_client), \
             patch.object(ps, "supabase", mock_sb):
            result = ps.reconcile_pending_payments()

        assert result["success"] is True
        assert result["data"]["failed"] == 1
        assert len(result["data"]["errors"]) == 1

    def test_no_razorpay_client_returns_error(self):
        from backend.app.services import payment_service as ps
        from backend.app.utils.responses import ErrorCode

        with patch.object(ps, "razorpay_client", None):
            result = ps.reconcile_pending_payments()

        assert result["success"] is False
        assert result["error"]["code"] == ErrorCode.INTERNAL_ERROR.value


# ---------------------------------------------------------------------------
# Rent generation idempotency tests
# ---------------------------------------------------------------------------

class TestRentGenerationIdempotency:
    """
    Tests for generate_monthly_rent() to ensure duplicate obligations are prevented.
    """

    def test_skips_existing_obligation(self):
        """
        Verify that generate_monthly_rent() skips (does not insert) when an
        obligation already exists for the student in the target month.
        """
        from backend.app.services import payment_service as ps

        # Mimic the chained calls inside generate_monthly_rent:
        # 1. students query
        # 2. room_allocations query
        # 3. rent_obligations check (returns existing)
        mock_sb = MagicMock()

        students_result = MagicMock()
        students_result.data = [{"id": "st-001", "monthly_rent": "5000.00", "status": "ACTIVE"}]

        allocs_result = MagicMock()
        allocs_result.data = [
            {
                "id": "alloc-001",
                "student_id": "st-001",
                "room_id": "room-001",
                "status": "active",
                "start_date": "2025-01-01",
                "end_date": None,
            }
        ]

        existing_ob_result = MagicMock()
        existing_ob_result.data = [{"id": "ob-existing", "status": "PENDING", "amount": "5000.00"}]

        def table_side(table_name):
            mock_table = MagicMock()
            if table_name == "students":
                # .select().eq().execute()
                mock_table.select.return_value.eq.return_value.execute.return_value = students_result
                # also no owner_id case: .select().execute()
                mock_table.select.return_value.execute.return_value = students_result
            elif table_name == "room_allocations":
                mock_table.select.return_value.in_.return_value.execute.return_value = allocs_result
            elif table_name == "rent_obligations":
                # .select().eq().eq().execute() → existing obligation
                mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = existing_ob_result
            return mock_table

        mock_sb.table.side_effect = table_side

        with patch.object(ps, "supabase", mock_sb), \
             patch("backend.app.services.payment_service.trigger_hook"):
            result = ps.generate_monthly_rent(
                rent_month=date(2025, 3, 1),
                user_id="owner-001"
            )

        assert result["success"] is True
        data = result["data"]
        # Must not create a duplicate; at minimum zero new obligations
        assert data["generated_count"] == 0

    def test_state_machine_transitions(self):
        from backend.app.services import payment_service as ps

        # PENDING can transition to PAID, PARTIAL, WAIVED
        assert ps._is_valid_transition("PENDING", "PAID") is True
        assert ps._is_valid_transition("PENDING", "PARTIAL") is True
        assert ps._is_valid_transition("PENDING", "WAIVED") is True

        # PARTIAL can only go to PAID
        assert ps._is_valid_transition("PARTIAL", "PAID") is True
        assert ps._is_valid_transition("PARTIAL", "PENDING") is False

        # PAID is terminal
        assert ps._is_valid_transition("PAID", "PENDING") is False
        assert ps._is_valid_transition("PAID", "PARTIAL") is False

        # WAIVED is terminal
        assert ps._is_valid_transition("WAIVED", "PENDING") is False
        assert ps._is_valid_transition("WAIVED", "PAID") is False
