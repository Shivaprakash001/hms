from fastapi import APIRouter, Request, status

from app.services import payment_service
from app.api.routes.payment_router import _handle_service_response

router = APIRouter(prefix="/webhooks", tags=["Payment Webhooks"])


@router.post("/phonepe", response_model=dict, status_code=status.HTTP_200_OK)
async def phonepe_webhook(request: Request):
    body = await request.body()
    result = payment_service.handle_payment_webhook("PHONEPE", dict(request.headers), body)
    return _handle_service_response(result)


@router.post("/razorpay", response_model=dict, status_code=status.HTTP_200_OK)
async def razorpay_webhook(request: Request):
    body = await request.body()
    result = payment_service.handle_payment_webhook("RAZORPAY", dict(request.headers), body)
    return _handle_service_response(result)
