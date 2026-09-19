import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), default="EMAIL", nullable=False)  # EMAIL, SMS, WHATSAPP, PUSH
    event = Column(String(100), nullable=False)  # ORDER_CONFIRMATION, ORDER_ACCEPTANCE, DISPATCH, DELIVERY, REJECTION, PAYMENT_SUCCESS
    subject = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(50), default="SENT", nullable=False)  # SENT, FAILED
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    user = relationship("User")
