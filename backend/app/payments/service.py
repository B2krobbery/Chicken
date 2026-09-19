import uuid
import hmac
import hashlib
from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.payment import Payment, PaymentTransaction
from app.models.order import Order
from app.notifications.service import dispatch_notification
from app.audit.service import log_audit_event
from app.core.exceptions import AppException

class BasePaymentProvider(ABC):
    @abstractmethod
    def create_intent(self, order_id: str, amount: Decimal, currency: str, idempotency_key: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    def verify(self, payload: Dict[str, Any]) -> bool:
        pass

    @abstractmethod
    def verify_webhook_signature(self, body_bytes: bytes, signature_header: str) -> bool:
        pass

class MockPaymentProvider(BasePaymentProvider):
    def create_intent(self, order_id: str, amount: Decimal, currency: str, idempotency_key: str) -> Dict[str, Any]:
        return {
            "provider_order_id": f"mock_order_{uuid.uuid4().hex[:12]}",
            "provider_transaction_id": f"mock_tx_{uuid.uuid4().hex[:12]}",
            "amount": float(amount),
            "currency": currency,
            "status": "CREATED",
            "checkout_url": f"https://mock-gateway.thechickenman.com/pay/{order_id}"
        }

    def verify(self, payload: Dict[str, Any]) -> bool:
        # Mock payment succeeds by default unless explicitly flagged as fail
        return payload.get("status") != "FAILED"

    def verify_webhook_signature(self, body_bytes: bytes, signature_header: str) -> bool:
        if not signature_header:
            return False
        expected = hmac.new(
            settings.PAYMENT_WEBHOOK_SECRET.encode("utf-8"),
            body_bytes,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature_header)

payment_provider: BasePaymentProvider = MockPaymentProvider()

def initialize_payment_intent(
    db: Session,
    order: Order,
    idempotency_key: str,
    actor_id: Any
) -> Payment:
    # Check if payment already exists with this idempotency key
    existing = db.query(Payment).filter(Payment.idempotency_key == idempotency_key).first()
    if existing:
        return existing

    # Check if order already has an active payment
    if order.payment and order.payment.status == "SUCCESS":
        return order.payment

    intent_data = payment_provider.create_intent(
        order_id=str(order.id),
        amount=order.total_amount,
        currency="INR",
        idempotency_key=idempotency_key
    )

    payment = Payment(
        order_id=order.id,
        payment_provider="MOCK",
        provider_order_id=intent_data.get("provider_order_id"),
        provider_transaction_id=intent_data.get("provider_transaction_id"),
        amount=order.total_amount,
        currency="INR",
        status="PENDING",
        idempotency_key=idempotency_key,
        payment_method="ONLINE",
        payment_metadata=intent_data
    )
    db.add(payment)
    db.flush()

    # Log initial transaction
    tx = PaymentTransaction(
        payment_id=payment.id,
        event_type="INTENT_CREATED",
        payload=intent_data,
        status="PENDING"
    )
    db.add(tx)
    db.commit()
    db.refresh(payment)
    return payment

def process_payment_success(
    db: Session,
    payment: Payment,
    provider_tx_id: Optional[str] = None,
    actor_id: Optional[Any] = None
) -> Payment:
    # IDEMPOTENCY CHECK: If already SUCCESS, skip duplicate processing
    if payment.status == "SUCCESS":
        return payment

    payment.status = "SUCCESS"
    if provider_tx_id:
        payment.provider_transaction_id = provider_tx_id

    tx = PaymentTransaction(
        payment_id=payment.id,
        event_type="PAYMENT_CONFIRMED",
        payload={"transaction_id": provider_tx_id or payment.provider_transaction_id},
        status="SUCCESS"
    )
    db.add(tx)

    log_audit_event(
        db=db,
        action="PAYMENT_SUCCESS",
        entity_type="PAYMENT",
        entity_id=str(payment.id),
        actor_id=actor_id,
        new_values={"amount": float(payment.amount), "order_id": str(payment.order_id)}
    )

    dispatch_notification(
        db=db,
        user_id=payment.order.buyer.user_id,
        event="PAYMENT_SUCCESS",
        subject=f"Payment Confirmed for Order {payment.order.order_number}",
        message=f"Received payment of ₹{payment.amount}."
    )

    db.commit()
    db.refresh(payment)
    return payment
