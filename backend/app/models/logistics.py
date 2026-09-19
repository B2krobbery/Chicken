import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Numeric, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="RESTRICT"), unique=True, nullable=False)
    driver_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    vehicle_number = Column(String(50), nullable=True)
    status = Column(String(50), default="ASSIGNED", nullable=False, index=True)  # ASSIGNED, PICKED_UP, IN_TRANSIT, DELIVERED, FAILED
    assigned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    order = relationship("Order", back_populates="delivery")
    driver = relationship("User")
    pod = relationship("ProofOfDelivery", back_populates="delivery", uselist=False, cascade="all, delete-orphan")

class ProofOfDelivery(Base):
    __tablename__ = "proof_of_delivery"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    delivery_id = Column(UUID(as_uuid=True), ForeignKey("deliveries.id", ondelete="CASCADE"), unique=True, nullable=False)
    pod_type = Column(String(50), default="OTP", nullable=False)  # OTP, SIGNATURE, PHOTO, MULTI
    otp_code_verified = Column(Boolean, default=False, nullable=False)
    recipient_name = Column(String(255), nullable=False)
    signature_url = Column(String(500), nullable=True)
    photo_url = Column(String(500), nullable=True)
    quantity_accepted_kg = Column(Numeric(10, 2), nullable=False)
    rejection_reason = Column(Text, nullable=True)
    captured_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    delivery = relationship("Delivery", back_populates="pod")
    driver = relationship("User")
