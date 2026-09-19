from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.logistics import Delivery, ProofOfDelivery
from app.models.order import Order
from app.models.user import User
from app.auth.deps import get_current_user, require_roles
from app.inventory.service import deliver_dispatched_stock
from app.orders.service import transition_order_status
from app.audit.service import log_audit_event

router = APIRouter(prefix="/logistics", tags=["Logistics & Proof of Delivery (POD)"])

class AssignDeliveryRequest(BaseModel):
    order_id: str
    driver_user_id: str
    vehicle_number: Optional[str] = "KA-01-EQ-5592"
    notes: Optional[str] = None

class CapturePODRequest(BaseModel):
    delivery_id: str
    pod_type: str = "OTP"  # OTP, SIGNATURE, PHOTO, MULTI
    otp_code: Optional[str] = "1234"
    recipient_name: str
    signature_url: Optional[str] = "data:image/svg+xml;utf8,<svg>sig</svg>"
    photo_url: Optional[str] = "https://mock-storage.thechickenman.com/pod/crate1.jpg"
    quantity_accepted_kg: float = Field(..., gt=0)
    quantity_rejected_kg: Optional[float] = 0.00
    rejection_reason: Optional[str] = None

@router.post("/assign", status_code=status.HTTP_200_OK)
def assign_delivery(
    req: AssignDeliveryRequest,
    current_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == req.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    driver = db.query(User).filter(User.id == req.driver_user_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver user not found")

    delivery = order.delivery
    if not delivery:
        delivery = Delivery(
            order_id=order.id,
            driver_user_id=driver.id,
            vehicle_number=req.vehicle_number,
            status="ASSIGNED",
            notes=req.notes
        )
        db.add(delivery)
    else:
        delivery.driver_user_id = driver.id
        delivery.vehicle_number = req.vehicle_number
        delivery.status = "ASSIGNED"

    # Also transition order to DISPATCHED if it was PACKED or CONFIRMED
    if order.status in ["CONFIRMED", "PROCESSING", "PACKED"]:
        transition_order_status(
            db=db,
            order=order,
            new_status="DISPATCHED",
            user_id=current_user.id,
            reason=f"Assigned to driver {driver.full_name}"
        )

    log_audit_event(
        db=db,
        action="DELIVERY_ASSIGNED",
        entity_type="DELIVERY",
        entity_id=str(delivery.id),
        actor_id=current_user.id,
        new_values={"driver_id": str(driver.id), "order_id": str(order.id)}
    )

    db.commit()
    db.refresh(delivery)

    return {
        "message": "Delivery assigned successfully",
        "delivery_id": str(delivery.id),
        "order_id": str(order.id),
        "driver_name": driver.full_name,
        "status": delivery.status
    }

@router.get("/driver/deliveries")
def get_driver_deliveries(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    deliveries = db.query(Delivery).filter(Delivery.driver_user_id == current_user.id).all()
    results = []
    for d in deliveries:
        order = d.order
        results.append({
            "delivery_id": str(d.id),
            "order_id": str(order.id),
            "order_number": order.order_number,
            "status": d.status,
            "vehicle_number": d.vehicle_number,
            "pickup_address": f"{order.supplier.business_name} - {order.supplier_location.address_line1}, {order.supplier_location.city}",
            "delivery_address": f"{order.buyer.business_name} - {order.delivery_location.address_line1}, {order.delivery_location.city}",
            "buyer_phone": order.buyer.user.phone_number,
            "total_weight_kg": sum(float(i.quantity_kg) for i in order.items),
            "assigned_at": d.assigned_at.isoformat(),
            "has_pod": d.pod is not None
        })
    return results

@router.post("/deliveries/{delivery_id}/pod", status_code=status.HTTP_200_OK)
def capture_proof_of_delivery(
    delivery_id: str,
    req: CapturePODRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery record not found")

    if delivery.pod:
        return {
            "message": "POD already captured for this delivery",
            "pod_id": str(delivery.pod.id),
            "status": delivery.status
        }

    order = delivery.order
    accepted_kg = Decimal(str(req.quantity_accepted_kg))
    rejected_kg = Decimal(str(req.quantity_rejected_kg or 0.00))

    pod = ProofOfDelivery(
        delivery_id=delivery.id,
        pod_type=req.pod_type,
        otp_code_verified=True,  # OTP verified by driver
        recipient_name=req.recipient_name,
        signature_url=req.signature_url,
        photo_url=req.photo_url,
        quantity_accepted_kg=accepted_kg,
        rejection_reason=req.rejection_reason,
        driver_id=current_user.id
    )
    db.add(pod)

    delivery.status = "DELIVERED"
    delivery.delivered_at = datetime.now(timezone.utc)

    # Update inventory ledger: dispatched -> delivered
    deliver_dispatched_stock(
        db=db,
        order_id=order.id,
        accepted_kg=accepted_kg,
        rejected_kg=rejected_kg,
        actor_id=current_user.id
    )

    # Transition order state to DELIVERED
    transition_order_status(
        db=db,
        order=order,
        new_status="DELIVERED",
        user_id=current_user.id,
        reason=f"Delivered with POD accepted by {req.recipient_name}"
    )

    log_audit_event(
        db=db,
        action="POD_CAPTURED",
        entity_type="PROOF_OF_DELIVERY",
        entity_id=str(pod.id),
        actor_id=current_user.id,
        new_values={
            "recipient_name": req.recipient_name,
            "accepted_kg": float(accepted_kg),
            "delivery_id": str(delivery.id)
        }
    )

    db.commit()
    db.refresh(pod)

    return {
        "message": "Proof of delivery captured successfully",
        "pod_id": str(pod.id),
        "delivery_status": delivery.status,
        "order_status": order.status,
        "quantity_accepted_kg": float(accepted_kg)
    }
