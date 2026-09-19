import logging
from abc import ABC, abstractmethod
from typing import Optional, Any
from sqlalchemy.orm import Session
from app.models.notification import Notification

logger = logging.getLogger("notifications")

class BaseNotificationProvider(ABC):
    @abstractmethod
    def send(self, recipient: str, subject: str, message: str, notification_type: str) -> bool:
        pass

class MockNotificationProvider(BaseNotificationProvider):
    def send(self, recipient: str, subject: str, message: str, notification_type: str) -> bool:
        logger.info(f"[MOCK_NOTIFICATION] [{notification_type}] To: {recipient} | Subject: {subject} | Body: {message}")
        return True

notification_provider = MockNotificationProvider()

def dispatch_notification(
    db: Session,
    user_id: Any,
    event: str,
    subject: str,
    message: str,
    notification_type: str = "EMAIL"
) -> Notification:
    # Send via provider
    success = notification_provider.send(str(user_id), subject, message, notification_type)
    
    # Record in notifications table
    record = Notification(
        user_id=user_id,
        type=notification_type,
        event=event,
        subject=subject,
        message=message,
        status="SENT" if success else "FAILED"
    )
    db.add(record)
    db.flush()
    return record
