import json
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.payment import Payment, PaymentTransaction
from app.models.order import Order
from app.auth.deps import get_current_user, get_current_buyer
from app.payments.service import (
    initialize_payment_intent,
    process_payment_success,
    payment_provider
)
from app.invoices.service import generate_invoice_for_order

router = APIRouter(prefix="/payments", tags=["Payments & Idempotency"])

class PaymentIntentRequest(BaseModel):
    order_id: str

class PaymentVerifyRequest(BaseModel):
    payment_id: str
    provider_transaction_id: str
    status: Optional[str] = "SUCCESS"

@router.post("/intent", status_code=status.HTTP_200_OK)
def create_intent(
    req: PaymentIntentRequest,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == req.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    payment = initialize_payment_intent(
        db=db,
        order=order,
        idempotency_key=idempotency_key,
        actor_id=current_user.id
    )

    return {
        "payment_id": str(payment.id),
        "order_id": str(payment.order_id),
        "amount": float(payment.amount),
        "currency": payment.currency,
        "status": payment.status,
        "provider_order_id": payment.provider_order_id,
        "metadata": payment.payment_metadata
    }

@router.post("/verify", status_code=status.HTTP_200_OK)
def verify_payment(
    req: PaymentVerifyRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    payment = db.query(Payment).filter(Payment.id == req.payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    verified = payment_provider.verify({"status": req.status, "transaction_id": req.provider_transaction_id})
    if not verified:
        payment.status = "FAILED"
        db.commit()
        raise HTTPException(status_code=400, detail="Payment verification failed with provider")

    # Mark success
    payment = process_payment_success(
        db=db,
        payment=payment,
        provider_tx_id=req.provider_transaction_id,
        actor_id=current_user.id
    )

    # Automatically generate invoice
    invoice = generate_invoice_for_order(db, payment.order)

    return {
        "message": "Payment verified successfully",
        "payment_id": str(payment.id),
        "status": payment.status,
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number
    }

@router.post("/webhook", status_code=status.HTTP_200_OK)
async def payment_webhook(
    request: Request,
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
    db: Session = Depends(get_db)
):
    body_bytes = await request.body()
    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    event_id = payload.get("event_id") or payload.get("id") or payload.get("payment_id")
    if not event_id:
        raise HTTPException(status_code=400, detail="Missing event reference in webhook payload")

    # Idempotency check: see if transaction event was already recorded
    existing_tx = db.query(PaymentTransaction).filter(
        PaymentTransaction.payload.contains({"event_id": str(event_id)})
    ).first()

    if existing_tx:
        # Idempotent replay: acknowledge without duplicating
        return {"status": "ok", "message": "Event already processed"}

    payment_id = payload.get("payment_id")
    payment = db.query(Payment).filter(Payment.id == payment_id).first() if payment_id else None
    
    if payment:
        # Record transaction with full payload including event_id for idempotency
        wh_tx = PaymentTransaction(
            payment_id=payment.id,
            event_type="WEBHOOK_RECEIVED",
            payload={"event_id": str(event_id), **payload},
            status="SUCCESS"
        )
        db.add(wh_tx)
        db.flush()

        if payload.get("event") == "payment.succeeded" or payload.get("status") == "SUCCESS":
            process_payment_success(
                db=db,
                payment=payment,
                provider_tx_id=payload.get("transaction_id")
            )
            generate_invoice_for_order(db, payment.order)

        db.commit()

    return {"status": "ok", "message": "Webhook processed successfully"}
