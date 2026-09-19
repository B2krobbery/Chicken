import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base

class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="RESTRICT"), unique=True, nullable=False)
    payment_provider = Column(String(50), default="MOCK", nullable=False)  # MOCK, RAZORPAY, STRIPE
    provider_transaction_id = Column(String(255), nullable=True, index=True)
    provider_order_id = Column(String(255), nullable=True, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    status = Column(String(50), default="PENDING", nullable=False, index=True)  # PENDING, SUCCESS, FAILED, REFUNDED
    idempotency_key = Column(String(255), unique=True, nullable=False, index=True)
    payment_method = Column(String(50), default="ONLINE", nullable=False)
    payment_metadata = Column("metadata", JSONB, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    order = relationship("Order", back_populates="payment")
    transactions = relationship("PaymentTransaction", back_populates="payment", cascade="all, delete-orphan")

class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(100), nullable=False)  # INTENT_CREATED, WEBHOOK_RECEIVED, VERIFICATION_SUCCESS, VERIFICATION_FAILURE
    payload = Column(JSONB, default=dict, nullable=False)
    status = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    payment = relationship("Payment", back_populates="transactions")
