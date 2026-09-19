from typing import Optional, Any
from sqlalchemy.orm import Session
from app.models.audit import AuditLog

def log_audit_event(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: str,
    actor_id: Optional[Any] = None,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> AuditLog:
    log_entry = AuditLog(
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        user_agent=user_agent
    )
    db.add(log_entry)
    db.flush()
    return log_entry
