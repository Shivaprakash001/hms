import calendar
import secrets
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from app.db import supabase
from app.services.payments.provider_factory import get_provider_for_owner
from app.utils.hooks import trigger_hook
from app.utils.logger import get_logger
from app.utils.responses import ErrorCode, ServiceResponse

logger = get_logger(__name__)

TERMINAL_ATTEMPT_STATUSES = {"SUCCESS", "FAILED", "EXPIRED", "CANCELLED"}


def _extract_checkout_fields(raw_response: Optional[Dict[str, Any]]) -> Dict[str, Optional[str]]:
    payload = raw_response or {}
    data_block = payload.get("data", {})
    instrument = data_block.get("instrumentResponse", {})
    redirect_info = instrument.get("redirectInfo", {})
    return {
        "checkout_url": redirect_info.get("url") or payload.get("redirectUrl") or data_block.get("redirectUrl"),
        "upi_intent_url": data_block.get("intentUrl"),
        "qr_payload": instrument.get("qrData") or data_block.get("qrData") or data_block.get("qrString"),
    }


def _calculate_prorated_rent(monthly_rent: Decimal, start_date: date, end_date: date, target_month: date) -> Decimal:
    month_start = target_month.replace(day=1)
    _, last_day = calendar.monthrange(target_month.year, target_month.month)
    month_end = target_month.replace(day=last_day)

    actual_start = max(start_date, month_start)
    actual_end = min(end_date, month_end) if end_date else month_end

    if actual_start > actual_end:
        return Decimal(0)

    days_occupied = (actual_end - actual_start).days + 1
    if days_occupied == last_day:
        return monthly_rent

    return (monthly_rent * Decimal(days_occupied) / Decimal(last_day)).quantize(Decimal("0.01"))


def _serialize_dt(value: Optional[datetime]) -> Optional[str]:
    if not value:
        return None
    return value.astimezone(timezone.utc).isoformat()


def _fetch_obligation(obligation_id: str) -> Optional[Dict[str, Any]]:
    res = supabase.table("rent_obligations") \
        .select("*, students(id, profile_id, profiles!students_profile_id_fkey(name, email, phone))") \
        .eq("id", obligation_id) \
        .execute()
    return res.data[0] if res.data else None


def _get_existing_paid_amount(obligation_id: str) -> Decimal:
    p_res = supabase.table("payments").select("amount_paid").eq("obligation_id", obligation_id).execute()
    return sum(Decimal(str(p["amount_paid"])) for p in (p_res.data or []))


def _validate_obligation_amount(obligation: Dict[str, Any], amount_paid: Decimal) -> Dict[str, Any]:
    if obligation["status"] == "WAIVED":
        return ServiceResponse.error(ErrorCode.INVALID_INPUT, "Cannot pay for a waived obligation.")

    total_amount = Decimal(str(obligation["amount"]))
    existing_paid = _get_existing_paid_amount(obligation["id"])
    remaining_balance = total_amount - existing_paid

    if remaining_balance <= 0 and amount_paid > 0:
        return ServiceResponse.error(ErrorCode.INVALID_INPUT, "Obligation is already fully paid.")

    if amount_paid > remaining_balance:
        return ServiceResponse.error(
            ErrorCode.INVALID_INPUT,
            f"Payment exceeds balance. Remaining balance: {remaining_balance}",
        )

    return ServiceResponse.success({
        "total_amount": total_amount,
        "existing_paid": existing_paid,
        "remaining_balance": remaining_balance,
    })


def _merchant_txn_id(obligation_id: str) -> str:
    return f"hms_{obligation_id.replace('-', '')[:12]}_{secrets.token_hex(8)}"


def _normalize_attempt_response(attempt: Dict[str, Any]) -> Dict[str, Any]:
    checkout_fields = _extract_checkout_fields(attempt.get("raw_create_response"))
    return {
        "attempt_id": attempt["id"],
        "status": attempt["status"],
        "provider": attempt["provider"],
        "merchant_txn_id": attempt.get("merchant_txn_id"),
        "checkout_url": checkout_fields["checkout_url"],
        "upi_intent_url": attempt.get("upi_intent_url") or checkout_fields["upi_intent_url"],
        "qr_payload": attempt.get("qr_payload") or checkout_fields["qr_payload"],
        "amount": attempt["amount"],
        "expires_at": attempt.get("expires_at"),
        "confirmed_at": attempt.get("confirmed_at"),
        "gateway_txn_id": attempt.get("gateway_txn_id"),
    }


def _get_active_pending_attempt(obligation_id: str) -> Optional[Dict[str, Any]]:
    res = supabase.table("payment_attempts") \
        .select("*") \
        .eq("obligation_id", obligation_id) \
        .in_("status", ["CREATED", "PENDING"]) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()
    if not res.data:
        return None
    return res.data[0]


def expire_stale_payment_attempts() -> Dict[str, Any]:
    try:
        now_iso = _serialize_dt(datetime.now(timezone.utc))
        expired_res = supabase.table("payment_attempts") \
            .update({"status": "EXPIRED"}) \
            .in_("status", ["CREATED", "PENDING"]) \
            .lt("expires_at", now_iso) \
            .execute()

        expired = expired_res.data or []
        for attempt in expired:
            logger.info(
                "payment_attempt_expired attempt_id=%s obligation_id=%s merchant_txn_id=%s",
                attempt.get("id"),
                attempt.get("obligation_id"),
                attempt.get("merchant_txn_id"),
            )
        return ServiceResponse.success({"expired": len(expired)})
    except Exception as exc:
        logger.exception("Error expiring stale payment attempts: %s", exc)
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Failed to expire stale payment attempts", str(exc))


def _update_obligation_status(obligation_id: str, total_paid: Decimal, total_amount: Decimal) -> str:
    new_status = "PAID" if total_paid >= total_amount else "PARTIAL"
    supabase.table("rent_obligations").update({"status": new_status}).eq("id", obligation_id).execute()
    return new_status


def generate_monthly_rent(rent_month: date, user_id: Optional[str] = None) -> Dict[str, Any]:
    try:
        target_month = rent_month.replace(day=1)
        _, last_day = calendar.monthrange(target_month.year, target_month.month)
        month_end_date = target_month.replace(day=last_day)

        alloc_res = supabase.table("room_allocations") \
            .select("*, students(id, monthly_rent, status)") \
            .lte("start_date", month_end_date.isoformat()) \
            .or_(f"end_date.is.null,end_date.gte.{target_month.isoformat()}") \
            .execute()

        allocations = alloc_res.data
        if not allocations:
            return ServiceResponse.success([], "No active allocations found for this month.")

        student_allocs: Dict[str, List[Dict[str, Any]]] = {}
        for allocation in allocations:
            if not allocation.get("students"):
                continue
            student_id = allocation["students"]["id"]
            student_allocs.setdefault(student_id, []).append(allocation)

        generated_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []
        for student_id, alloc_list in student_allocs.items():
            student = alloc_list[0]["students"]
            monthly_rent = Decimal(str(student.get("monthly_rent", 0)))

            total_days = 0
            for alloc in alloc_list:
                start = max(target_month, date.fromisoformat(alloc["start_date"]))
                end = min(month_end_date, date.fromisoformat(alloc["end_date"])) if alloc.get("end_date") else month_end_date
                if start <= end:
                    total_days += (end - start).days + 1

            if total_days <= 0:
                continue

            total_amount = monthly_rent
            existing_res = supabase.table("rent_obligations") \
                .select("*") \
                .eq("student_id", student_id) \
                .eq("rent_month", target_month.isoformat()) \
                .execute()

            if existing_res.data:
                existing = existing_res.data[0]
                if existing["status"] != "PENDING":
                    skipped_count += 1
                    continue

                if Decimal(str(existing["amount"])) != total_amount.quantize(Decimal("0.01")):
                    supabase.table("rent_obligations").update({"amount": float(total_amount)}).eq("id", existing["id"]).execute()
                    updated_count += 1
                else:
                    skipped_count += 1
                continue

            latest_alloc = sorted(alloc_list, key=lambda row: row["start_date"])[-1]
            obligation_data = {
                "student_id": student_id,
                "allocation_id": latest_alloc["id"],
                "owner_id": user_id,
                "rent_month": target_month.isoformat(),
                "amount": float(total_amount),
                "due_date": (target_month + timedelta(days=9)).isoformat(),
                "status": "PENDING",
            }

            res = supabase.table("rent_obligations").insert(obligation_data).execute()
            if res.data:
                generated_count += 1
                trigger_hook(
                    "rent_obligation_created",
                    obligation_id=res.data[0]["id"],
                    student_id=student_id,
                    owner_id=user_id,
                    amount=float(total_amount),
                )
            else:
                errors.append(f"Failed to create for student {student_id}")

        return ServiceResponse.success({
            "target_month": target_month.isoformat(),
            "generated": generated_count,
            "updated": updated_count,
            "skipped": skipped_count,
            "errors": errors,
        }, f"Processed rent obligations: {generated_count} new, {updated_count} updated.")

    except Exception as exc:
        logger.exception("Error generating monthly rent: %s", exc)
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Failed to generate rent", str(exc))


def record_payment(
    obligation_id: str,
    amount_paid: Decimal,
    payment_method: str,
    reference_number: Optional[str] = None,
    payment_date: Optional[date] = None,
    user_id: Optional[str] = None,
    payment_attempt_id: Optional[str] = None,
) -> Dict[str, Any]:
    try:
        obligation = _fetch_obligation(obligation_id)
        if not obligation:
            return ServiceResponse.not_found("Rent Obligation")

        validation = _validate_obligation_amount(obligation, amount_paid)
        if not validation["success"]:
            return validation

        total_amount = validation["data"]["total_amount"]
        existing_paid = validation["data"]["existing_paid"]
        payment_data = {
            "obligation_id": obligation_id,
            "student_id": obligation["student_id"],
            "owner_id": obligation.get("owner_id") or user_id,
            "amount_paid": float(amount_paid),
            "payment_method": payment_method,
            "reference_number": reference_number,
            "payment_date": (payment_date or date.today()).isoformat(),
            "payment_attempt_id": payment_attempt_id,
        }

        res = supabase.table("payments").insert(payment_data).execute()
        if not res.data:
            return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to record payment.")

        new_payment = res.data[0]
        new_total_paid = existing_paid + amount_paid
        new_status = _update_obligation_status(obligation_id, new_total_paid, total_amount)

        trigger_hook(
            "payment_recorded",
            payment_id=new_payment["id"],
            obligation_id=obligation_id,
            amount=float(amount_paid),
            user_id=user_id,
        )

        return ServiceResponse.success({
            "payment": new_payment,
            "obligation_status": new_status,
            "remaining_balance": float(total_amount - new_total_paid) if new_status == "PARTIAL" else 0,
        }, "Payment recorded successfully.")

    except Exception as exc:
        logger.exception("Error recording payment: %s", exc)
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Failed to record payment", str(exc))


def create_payment_intent(obligation_id: str, amount: Optional[Decimal], user_id: str, student_id: Optional[str] = None) -> Dict[str, Any]:
    try:
        obligation = _fetch_obligation(obligation_id)
        if not obligation:
            return ServiceResponse.not_found("Rent Obligation")

        if student_id and str(obligation["student_id"]) != str(student_id):
            return ServiceResponse.forbidden("You can only pay your own obligations.")

        validation_amount = amount or Decimal(str(obligation["amount"])) - _get_existing_paid_amount(obligation_id)
        validation = _validate_obligation_amount(obligation, validation_amount)
        if not validation["success"]:
            return validation

        existing_attempt = _get_active_pending_attempt(obligation_id)
        if existing_attempt:
            logger.info(
                "payment_attempt_reused obligation_id=%s attempt_id=%s merchant_txn_id=%s",
                obligation_id,
                existing_attempt["id"],
                existing_attempt.get("merchant_txn_id"),
            )
            return ServiceResponse.success(_normalize_attempt_response(existing_attempt), "Existing pending payment attempt reused.")

        provider, provider_config = get_provider_for_owner(obligation.get("owner_id"))
        if not provider:
            return provider_config

        student = obligation.get("students") or {}
        profile = student.get("profiles") or {}
        merchant_txn_id = _merchant_txn_id(obligation_id)
        attempt_data = {
            "obligation_id": obligation_id,
            "student_id": obligation["student_id"],
            "owner_id": obligation["owner_id"],
            "provider": provider.provider_name,
            "merchant_txn_id": merchant_txn_id,
            "amount": float(validation_amount),
            "status": "CREATED",
        }
        try:
            attempt_res = supabase.table("payment_attempts").insert(attempt_data).execute()
        except Exception as exc:
            # Defensive path for race conditions when DB-level single-active-attempt
            # constraints reject a concurrent insert.
            existing_attempt = _get_active_pending_attempt(obligation_id)
            if existing_attempt:
                logger.info(
                    "payment_attempt_reused_after_conflict obligation_id=%s attempt_id=%s merchant_txn_id=%s",
                    obligation_id,
                    existing_attempt["id"],
                    existing_attempt.get("merchant_txn_id"),
                )
                return ServiceResponse.success(_normalize_attempt_response(existing_attempt), "Existing pending payment attempt reused.")
            return ServiceResponse.error(ErrorCode.DB_INSERT_ERROR, "Failed to create payment attempt.", str(exc))

        if not attempt_res.data:
            existing_attempt = _get_active_pending_attempt(obligation_id)
            if existing_attempt:
                logger.info(
                    "payment_attempt_reused_after_empty_insert obligation_id=%s attempt_id=%s merchant_txn_id=%s",
                    obligation_id,
                    existing_attempt["id"],
                    existing_attempt.get("merchant_txn_id"),
                )
                return ServiceResponse.success(_normalize_attempt_response(existing_attempt), "Existing pending payment attempt reused.")
            return ServiceResponse.error(ErrorCode.DB_INSERT_ERROR, "Failed to create payment attempt.")

        attempt = attempt_res.data[0]
        logger.info(
            "payment_attempt_created attempt_id=%s obligation_id=%s owner_id=%s provider=%s merchant_txn_id=%s amount=%s",
            attempt["id"], obligation_id, obligation["owner_id"], provider.provider_name, merchant_txn_id, validation_amount
        )
        try:
            logger.info("phonepe_payment_request attempt_id=%s provider=%s", attempt["id"], provider.provider_name)
            create_result = provider.create_intent(
                amount=validation_amount,
                merchant_txn_id=merchant_txn_id,
                student_name=profile.get("name", ""),
                student_email=profile.get("email"),
                student_phone=profile.get("phone"),
                metadata={
                    "obligation_id": obligation_id,
                    "student_id": obligation["student_id"],
                    "owner_id": obligation["owner_id"],
                    "attempt_id": attempt["id"],
                },
            )
        except Exception as exc:
            supabase.table("payment_attempts").update({
                "status": "FAILED",
                "raw_create_response": {"error": str(exc)},
            }).eq("id", attempt["id"]).execute()
            return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Failed to create payment intent", str(exc))

        updated_res = supabase.table("payment_attempts").update({
            "status": "PENDING",
            "gateway_txn_id": create_result.gateway_txn_id,
            "upi_intent_url": create_result.upi_intent_url,
            "qr_payload": create_result.qr_payload,
            "expires_at": _serialize_dt(create_result.expires_at),
            "raw_create_response": create_result.raw_response,
        }).eq("id", attempt["id"]).execute()
        updated_attempt = updated_res.data[0] if updated_res.data else attempt
        logger.info(
            "payment_attempt_pending attempt_id=%s provider=%s checkout=%s",
            updated_attempt["id"],
            updated_attempt["provider"],
            bool(create_result.checkout_url),
        )
        return ServiceResponse.success({
            "attempt_id": updated_attempt["id"],
            "provider": updated_attempt["provider"],
            "merchant_txn_id": updated_attempt["merchant_txn_id"],
            "checkout_url": create_result.checkout_url,
            "upi_intent_url": updated_attempt.get("upi_intent_url"),
            "qr_payload": updated_attempt.get("qr_payload"),
            "status": updated_attempt["status"],
            "expires_at": updated_attempt.get("expires_at"),
        })
    except Exception as exc:
        logger.exception("Error creating payment intent: %s", exc)
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Failed to create payment intent", str(exc))


def get_payment_attempt(attempt_id: str, user_id: str, role: str, student_id: Optional[str] = None) -> Dict[str, Any]:
    try:
        res = supabase.table("payment_attempts").select("*").eq("id", attempt_id).execute()
        if not res.data:
            return ServiceResponse.not_found("Payment attempt")

        attempt = res.data[0]
        if role == "student" and str(attempt["student_id"]) != str(student_id):
            return ServiceResponse.forbidden("You can only view your own payment attempts.")
        if role == "owner" and str(attempt["owner_id"]) != str(user_id):
            return ServiceResponse.forbidden("You can only view attempts for your hostel.")

        return ServiceResponse.success(_normalize_attempt_response(attempt))
    except Exception as exc:
        logger.exception("Error fetching payment attempt: %s", exc)
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch payment attempt", str(exc))


def _mark_attempt_terminal(attempt_id: str, status: str, gateway_txn_id: Optional[str], raw_payload: Dict[str, Any]) -> Dict[str, Any]:
    logger.info("payment_attempt_terminal attempt_id=%s status=%s gateway_txn_id=%s", attempt_id, status, gateway_txn_id)
    update_res = supabase.table("payment_attempts").update({
        "status": status,
        "gateway_txn_id": gateway_txn_id,
        "raw_webhook_payload": raw_payload,
        "confirmed_at": _serialize_dt(datetime.now(timezone.utc)) if status == "SUCCESS" else None,
    }).eq("id", attempt_id).execute()
    return update_res.data[0] if update_res.data else {}


def finalize_payment_attempt(attempt: Dict[str, Any], *, status: str, gateway_txn_id: Optional[str], raw_payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        if attempt["status"] == "SUCCESS":
            return ServiceResponse.success(_normalize_attempt_response(attempt), "Payment already finalized.")

        if status != "SUCCESS":
            updated = _mark_attempt_terminal(attempt["id"], status, gateway_txn_id, raw_payload)
            return ServiceResponse.success(_normalize_attempt_response(updated or attempt))

        existing_payment = supabase.table("payments").select("id").eq("payment_attempt_id", attempt["id"]).execute()
        if existing_payment.data:
            updated = _mark_attempt_terminal(attempt["id"], "SUCCESS", gateway_txn_id, raw_payload)
            return ServiceResponse.success(_normalize_attempt_response(updated or attempt), "Payment already settled.")

        result = record_payment(
            attempt["obligation_id"],
            Decimal(str(attempt["amount"])),
            "UPI",
            reference_number=gateway_txn_id or attempt["merchant_txn_id"],
            payment_date=date.today(),
            user_id=attempt["owner_id"],
            payment_attempt_id=attempt["id"],
        )
        if not result["success"]:
            retry_existing_payment = supabase.table("payments").select("id").eq("payment_attempt_id", attempt["id"]).execute()
            if retry_existing_payment.data:
                updated = _mark_attempt_terminal(attempt["id"], "SUCCESS", gateway_txn_id, raw_payload)
                return ServiceResponse.success(_normalize_attempt_response(updated or attempt), "Payment already settled.")
            return result

        updated = _mark_attempt_terminal(attempt["id"], "SUCCESS", gateway_txn_id, raw_payload)
        logger.info(
            "payment_settled attempt_id=%s obligation_id=%s gateway_txn_id=%s",
            attempt["id"], attempt["obligation_id"], gateway_txn_id
        )
        return ServiceResponse.success(_normalize_attempt_response(updated or attempt))
    except Exception as exc:
        logger.exception("Error finalizing payment attempt: %s", exc)
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Failed to finalize payment attempt", str(exc))


def handle_payment_webhook(provider_name: str, headers: Dict[str, str], body: bytes) -> Dict[str, Any]:
    try:
        provider_name = provider_name.upper()
        logger.info("webhook_received provider=%s", provider_name)
        attempts = supabase.table("payment_attempts") \
            .select("*") \
            .eq("provider", provider_name) \
            .order("created_at", desc=True) \
            .limit(50) \
            .execute()
        if not attempts.data:
            return ServiceResponse.not_found("Payment attempt")

        for attempt in attempts.data or []:
            provider, _ = get_provider_for_owner(attempt["owner_id"])
            if not provider or provider.provider_name != provider_name:
                continue
            try:
                verification = provider.verify_webhook(headers, body)
            except Exception:
                continue
            if verification.merchant_txn_id != attempt["merchant_txn_id"]:
                continue
            logger.info(
                "webhook_verified provider=%s attempt_id=%s merchant_txn_id=%s status=%s",
                provider_name, attempt["id"], verification.merchant_txn_id, verification.status
            )
            return finalize_payment_attempt(
                attempt,
                status=verification.status,
                gateway_txn_id=verification.gateway_txn_id,
                raw_payload=verification.raw_event,
            )

        return ServiceResponse.not_found("Matching payment attempt")
    except Exception as exc:
        logger.exception("Error handling payment webhook: %s", exc)
        return ServiceResponse.error(ErrorCode.INVALID_INPUT, "Invalid webhook payload", str(exc))


def reconcile_pending_payment_attempts(max_records: int = 50) -> Dict[str, Any]:
    try:
        expire_stale_payment_attempts()
        cutoff_iso = _serialize_dt(datetime.now(timezone.utc) - timedelta(hours=24))
        pending = supabase.table("payment_attempts") \
            .select("*") \
            .in_("status", ["CREATED", "PENDING"]) \
            .gte("created_at", cutoff_iso) \
            .order("created_at", desc=True) \
            .limit(max_records) \
            .execute()

        processed = 0
        updated = 0
        errors = []
        for attempt in pending.data or []:
            processed += 1
            try:
                provider, _ = get_provider_for_owner(attempt["owner_id"])
                if not provider or provider.provider_name != attempt["provider"]:
                    raise ValueError("Configured provider no longer available for owner")
                status_result = provider.fetch_status(
                    merchant_txn_id=attempt["merchant_txn_id"],
                    gateway_txn_id=attempt.get("gateway_txn_id"),
                )
                if status_result.status != attempt["status"]:
                    logger.info(
                        "reconciliation_update attempt_id=%s from_status=%s to_status=%s",
                        attempt["id"], attempt["status"], status_result.status
                    )
                    finalize_payment_attempt(
                        attempt,
                        status=status_result.status,
                        gateway_txn_id=status_result.gateway_txn_id,
                        raw_payload=status_result.raw_status,
                    )
                    updated += 1
            except Exception as exc:
                errors.append({"attempt_id": attempt["id"], "error": str(exc)})
        return ServiceResponse.success({"processed": processed, "updated": updated, "errors": errors})
    except Exception as exc:
        logger.exception("Error reconciling payment attempts: %s", exc)
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Failed to reconcile payment attempts", str(exc))


def get_student_payment_history(student_id: str) -> Dict[str, Any]:
    try:
        ob_res = supabase.table("rent_obligations").select("*").eq("student_id", student_id).order("rent_month", desc=True).execute()
        pay_res = supabase.table("payments").select("*").eq("student_id", student_id).order("payment_date", desc=True).execute()

        obligations = ob_res.data
        payments = pay_res.data
        total_due = sum(Decimal(str(o["amount"])) for o in obligations if o["status"] != "WAIVED")
        total_paid = sum(Decimal(str(p["amount_paid"])) for p in payments)

        return ServiceResponse.success({
            "student_id": student_id,
            "obligations": obligations,
            "payments": payments,
            "total_due": float(total_due),
            "total_paid": float(total_paid),
            "outstanding_balance": float(total_due - total_paid),
        })
    except Exception as exc:
        logger.exception("Error fetching history: %s", exc)
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch student history")


def waive_obligation(obligation_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    try:
        p_res = supabase.table("payments").select("id").eq("obligation_id", obligation_id).execute()
        if p_res.data:
            return ServiceResponse.error(ErrorCode.INVALID_INPUT, "Cannot waive an obligation that has payments.")

        res = supabase.table("rent_obligations").update({"status": "WAIVED"}).eq("id", obligation_id).execute()
        if not res.data:
            return ServiceResponse.not_found("Obligation")

        trigger_hook("rent_waived", obligation_id=obligation_id, user_id=user_id)
        return ServiceResponse.success(res.data[0], "Obligation waived successfully.")
    except Exception as exc:
        logger.exception("Error waiving obligation: %s", exc)
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Failed to waive obligation", str(exc))


def get_dues_report(user_id: str, rent_month: Optional[date] = None, status: Optional[str] = None) -> Dict[str, Any]:
    try:
        query = supabase.table("rent_obligations") \
            .select("*, students(profiles!students_profile_id_fkey(name)), room_allocations(rooms(room_no))") \
            .eq("owner_id", user_id)

        if rent_month:
            query = query.eq("rent_month", rent_month.isoformat())
        if status:
            query = query.eq("status", status)

        result = query.execute()
        dues = []
        for due in result.data:
            student = due.get("students", {})
            profile = student.get("profiles", {})
            allocation = due.get("room_allocations", {})
            room = allocation.get("rooms", {}) if allocation else {}
            due["student_name"] = profile.get("name", "Unknown")
            due["room_no"] = room.get("room_no", "N/A")
            due["obligation_id"] = due["id"]
            due["outstanding"] = float(Decimal(str(due["amount"])) - _get_existing_paid_amount(due["id"]))
            dues.append(due)
        return ServiceResponse.success(dues)
    except Exception as exc:
        logger.exception("Error fetching dues report: %s", exc)
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch dues report")


def get_all_payments(user_id: str, limit: int = 50, offset: int = 0) -> Dict[str, Any]:
    try:
        query = supabase.table("payments") \
            .select("*, students(profiles!students_profile_id_fkey(name)), rent_obligations(rent_month)", count="exact") \
            .eq("owner_id", user_id) \
            .order("payment_date", desc=True) \
            .limit(limit) \
            .offset(offset)
        result = query.execute()

        payments = []
        for payment in result.data:
            payment["student_name"] = payment.get("students", {}).get("profiles", {}).get("name", "Unknown")
            payment["rent_month"] = payment.get("rent_obligations", {}).get("rent_month")
            payments.append(payment)
        return ServiceResponse.success({
            "payments": payments,
            "total": result.count if hasattr(result, "count") else len(payments),
        })
    except Exception as exc:
        logger.exception("Error fetching payments: %s", exc)
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch payments")
