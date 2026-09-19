from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.supplier import Supplier, SupplierKYC
from app.models.buyer import Buyer, BuyerKYC
from app.models.order import Order, OrderItem
from app.models.user import User, Role
from app.models.audit import AuditLog
from app.auth.deps import require_roles
from app.audit.service import log_audit_event
from app.notifications.service import dispatch_notification

router = APIRouter(prefix="/admin", tags=["Admin Operations & Reporting"])

class StatusActionRequest(BaseModel):
    action: str  # APPROVE, REJECT, SUSPEND, REACTIVATE
    reason: Optional[str] = None

@router.get("/dashboard")
def get_dashboard_kpis(
    current_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    total_orders = db.query(Order).count()
    completed_orders = db.query(Order).filter(Order.status == "DELIVERED").count()
    cancelled_orders = db.query(Order).filter(Order.status.in_(["CANCELLED", "REJECTED"])).count()
    
    # GMV (Gross Merchandise Value of all placed non-cancelled orders)
    active_orders = db.query(Order).filter(~Order.status.in_(["CANCELLED", "REJECTED"])).all()
    gmv = sum((o.total_amount for o in active_orders), Decimal("0.00"))

    # Net Revenue (Completed order total amounts)
    delivered_orders = db.query(Order).filter(Order.status == "DELIVERED").all()
    revenue = sum((o.total_amount for o in delivered_orders), Decimal("0.00"))

    # Total kg sold
    all_order_items = db.query(OrderItem).join(Order).filter(~Order.status.in_(["CANCELLED", "REJECTED"])).all()
    total_kg_sold = sum((item.quantity_kg for item in all_order_items), Decimal("0.00"))

    active_suppliers = db.query(Supplier).filter(Supplier.kyc_status == "APPROVED", Supplier.status == "ACTIVE").count()
    pending_suppliers = db.query(Supplier).filter(Supplier.kyc_status == "PENDING").count()
    
    active_buyers = db.query(Buyer).filter(Buyer.kyc_status == "APPROVED", Buyer.status == "ACTIVE").count()
    pending_buyers = db.query(Buyer).filter(Buyer.kyc_status == "PENDING").count()

    fulfilment_rate = (completed_orders / total_orders * 100.0) if total_orders > 0 else 100.0

    return {
        "gmv": float(gmv),
        "revenue": float(revenue),
        "total_kg_sold": float(total_kg_sold),
        "total_orders": total_orders,
        "completed_orders": completed_orders,
        "cancelled_orders": cancelled_orders,
        "fulfilment_rate_percent": round(fulfilment_rate, 1),
        "active_suppliers": active_suppliers,
        "pending_suppliers": pending_suppliers,
        "active_buyers": active_buyers,
        "pending_buyers": pending_buyers
    }

@router.get("/suppliers")
def list_all_suppliers(
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    q = db.query(Supplier)
    if status_filter:
        q = q.filter(Supplier.kyc_status == status_filter.upper())
    suppliers = q.order_by(Supplier.created_at.desc()).all()
    return [
        {
            "id": str(s.id),
            "business_name": s.business_name,
            "trade_name": s.trade_name,
            "user_email": s.user.email,
            "user_phone": s.user.phone_number,
            "kyc_status": s.kyc_status,
            "status": s.status,
            "gstin": s.kyc.gstin if s.kyc else None,
            "pan": s.kyc.pan if s.kyc else None,
            "fssai": s.kyc.fssai_license_number if s.kyc else None,
            "locations_count": len(s.locations),
            "created_at": s.created_at.isoformat()
        }
        for s in suppliers
    ]

@router.post("/suppliers/{supplier_id}/kyc-action")
def update_supplier_kyc(
    supplier_id: str,
    req: StatusActionRequest,
    current_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    old_status = supplier.kyc_status
    action = req.action.upper()

    if action == "APPROVE":
        supplier.kyc_status = "APPROVED"
        supplier.status = "ACTIVE"
        if supplier.kyc:
            supplier.kyc.status = "APPROVED"
            supplier.kyc.verified_by = current_user.id
            supplier.kyc.verified_at = datetime.now(timezone.utc)
    elif action == "REJECT":
        supplier.kyc_status = "REJECTED"
        if supplier.kyc:
            supplier.kyc.status = "REJECTED"
            supplier.kyc.rejection_reason = req.reason
            supplier.kyc.verified_by = current_user.id
            supplier.kyc.verified_at = datetime.now(timezone.utc)
    elif action == "SUSPEND":
        supplier.kyc_status = "SUSPENDED"
        supplier.status = "INACTIVE"
    elif action == "REACTIVATE":
        supplier.kyc_status = "APPROVED"
        supplier.status = "ACTIVE"
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    log_audit_event(
        db=db,
        action=f"SUPPLIER_KYC_{action}",
        entity_type="SUPPLIER",
        entity_id=str(supplier.id),
        actor_id=current_user.id,
        old_values={"kyc_status": old_status},
        new_values={"kyc_status": supplier.kyc_status, "reason": req.reason}
    )

    dispatch_notification(
        db=db,
        user_id=supplier.user_id,
        event=f"KYC_{action}",
        subject=f"Supplier KYC Update: {action}",
        message=f"Your supplier KYC status has been updated to {supplier.kyc_status}. Reason: {req.reason or 'Admin verification completed'}."
    )

    db.commit()
    return {
        "message": f"Supplier status updated to {supplier.kyc_status}",
        "supplier_id": str(supplier.id),
        "kyc_status": supplier.kyc_status
    }

@router.get("/buyers")
def list_all_buyers(
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    q = db.query(Buyer)
    if status_filter:
        q = q.filter(Buyer.kyc_status == status_filter.upper())
    buyers = q.order_by(Buyer.created_at.desc()).all()
    return [
        {
            "id": str(b.id),
            "business_name": b.business_name,
            "buyer_type": b.buyer_type,
            "user_email": b.user.email,
            "user_phone": b.user.phone_number,
            "kyc_status": b.kyc_status,
            "status": b.status,
            "pan": b.kyc.pan if b.kyc else None,
            "fssai": b.kyc.fssai_license_number if b.kyc else None,
            "gstin": b.kyc.gstin if b.kyc else None,
            "locations_count": len(b.locations),
            "created_at": b.created_at.isoformat()
        }
        for b in buyers
    ]

@router.post("/buyers/{buyer_id}/kyc-action")
def update_buyer_kyc(
    buyer_id: str,
    req: StatusActionRequest,
    current_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    buyer = db.query(Buyer).filter(Buyer.id == buyer_id).first()
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found")

    old_status = buyer.kyc_status
    action = req.action.upper()

    if action == "APPROVE":
        buyer.kyc_status = "APPROVED"
        buyer.status = "ACTIVE"
        if buyer.kyc:
            buyer.kyc.status = "APPROVED"
            buyer.kyc.verified_by = current_user.id
            buyer.kyc.verified_at = datetime.now(timezone.utc)
    elif action == "REJECT":
        buyer.kyc_status = "REJECTED"
        if buyer.kyc:
            buyer.kyc.status = "REJECTED"
            buyer.kyc.rejection_reason = req.reason
            buyer.kyc.verified_by = current_user.id
            buyer.kyc.verified_at = datetime.now(timezone.utc)
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    log_audit_event(
        db=db,
        action=f"BUYER_KYC_{action}",
        entity_type="BUYER",
        entity_id=str(buyer.id),
        actor_id=current_user.id,
        old_values={"kyc_status": old_status},
        new_values={"kyc_status": buyer.kyc_status, "reason": req.reason}
    )

    dispatch_notification(
        db=db,
        user_id=buyer.user_id,
        event=f"KYC_{action}",
        subject=f"Buyer KYC Update: {action}",
        message=f"Your buyer KYC has been marked as {buyer.kyc_status}. Reason: {req.reason or 'Admin verification completed'}."
    )

    db.commit()
    return {
        "message": f"Buyer status updated to {buyer.kyc_status}",
        "buyer_id": str(buyer.id),
        "kyc_status": buyer.kyc_status
    }

@router.get("/drivers")
def list_drivers(
    current_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    drivers = db.query(User).join(User.roles).filter(Role.name == "DRIVER").all()
    return [
        {
            "id": str(d.id),
            "full_name": d.full_name,
            "email": d.email,
            "phone_number": d.phone_number
        }
        for d in drivers
    ]

@router.get("/audit-logs")
def get_audit_logs(
    limit: int = 100,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    current_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)

    logs = q.order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": str(l.id),
            "actor_id": str(l.actor_id) if l.actor_id else None,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "old_values": l.old_values,
            "new_values": l.new_values,
            "ip_address": l.ip_address,
            "timestamp": l.created_at.isoformat()
        }
        for l in logs
    ]
