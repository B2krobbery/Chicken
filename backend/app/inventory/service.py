from decimal import Decimal
from typing import Optional, Any
from sqlalchemy.orm import Session
from app.models.inventory import Inventory, InventoryBatch, InventoryMovement
from app.models.catalogue import Product
from app.models.supplier import SupplierLocation
from app.core.exceptions import InsufficientStockException
from app.audit.service import log_audit_event

def create_batch(
    db: Session,
    supplier_id: Any,
    batch_number: str,
    production_date: Any,
    expiry_date: Any,
    storage_condition: str = "CHILLED"
) -> InventoryBatch:
    batch = InventoryBatch(
        supplier_id=supplier_id,
        batch_number=batch_number,
        production_date=production_date,
        expiry_date=expiry_date,
        storage_condition=storage_condition
    )
    db.add(batch)
    db.flush()
    return batch

def add_stock(
    db: Session,
    supplier_id: Any,
    location_id: Any,
    product_id: Any,
    quantity_kg: Decimal,
    batch_id: Optional[Any] = None,
    actor_id: Optional[Any] = None,
    notes: Optional[str] = "Stock In Initial"
) -> Inventory:
    # Find or create inventory row
    inv = db.query(Inventory).filter(
        Inventory.supplier_id == supplier_id,
        Inventory.supplier_location_id == location_id,
        Inventory.product_id == product_id,
        Inventory.batch_id == batch_id
    ).with_for_update().first()

    if not inv:
        inv = Inventory(
            supplier_id=supplier_id,
            supplier_location_id=location_id,
            product_id=product_id,
            batch_id=batch_id,
            quantity_available_kg=quantity_kg,
            quantity_reserved_kg=Decimal("0.00"),
            quantity_allocated_kg=Decimal("0.00"),
            quantity_dispatched_kg=Decimal("0.00"),
            quantity_delivered_kg=Decimal("0.00"),
            quantity_rejected_kg=Decimal("0.00"),
            quantity_expired_kg=Decimal("0.00")
        )
        db.add(inv)
        db.flush()
    else:
        inv.quantity_available_kg += quantity_kg

    # Create immutable movement record
    movement = InventoryMovement(
        inventory_id=inv.id,
        batch_id=batch_id,
        movement_type="STOCK_IN",
        quantity_kg=quantity_kg,
        notes=notes,
        actor_id=actor_id
    )
    db.add(movement)

    log_audit_event(
        db=db,
        action="INVENTORY_STOCK_IN",
        entity_type="INVENTORY",
        entity_id=str(inv.id),
        actor_id=actor_id,
        new_values={"quantity_added_kg": float(quantity_kg), "batch_id": str(batch_id) if batch_id else None}
    )

    db.flush()
    return inv

def reserve_stock(
    db: Session,
    supplier_id: Any,
    location_id: Any,
    product_id: Any,
    requested_kg: Decimal,
    order_id: Any,
    actor_id: Optional[Any] = None
) -> tuple[Inventory, Decimal]:
    """
    CRITICAL CONCURRENCY CONTROL:
    Uses SELECT ... FOR UPDATE to lock inventory rows.
    Checks available stock, decrements available and increments reserved.
    Logs immutable RESERVED movement.
    """
    # Select candidate inventory records for this supplier, location, product with row lock
    records = db.query(Inventory).filter(
        Inventory.supplier_id == supplier_id,
        Inventory.supplier_location_id == location_id,
        Inventory.product_id == product_id,
        Inventory.quantity_available_kg > 0
    ).with_for_update().all()

    total_avail = sum((r.quantity_available_kg for r in records), Decimal("0.00"))
    if total_avail < requested_kg:
        raise InsufficientStockException(
            message=f"Insufficient inventory available to reserve {requested_kg} kg.",
            details={"requested_kg": float(requested_kg), "available_kg": float(total_avail)}
        )

    # Reserve across batches/inventory records
    remaining = requested_kg
    last_inv = None
    for inv in records:
        if remaining <= 0:
            break
        alloc = min(inv.quantity_available_kg, remaining)
        inv.quantity_available_kg -= alloc
        inv.quantity_reserved_kg += alloc
        remaining -= alloc
        last_inv = inv

        movement = InventoryMovement(
            inventory_id=inv.id,
            batch_id=inv.batch_id,
            movement_type="RESERVED",
            quantity_kg=alloc,
            reference_order_id=order_id,
            notes=f"Reserved for Order {order_id}",
            actor_id=actor_id
        )
        db.add(movement)

    db.flush()
    return last_inv, requested_kg

def allocate_reserved_stock(db: Session, order_id: Any, actor_id: Optional[Any] = None):
    """Called when supplier accepts order: moves reserved -> allocated"""
    movements = db.query(InventoryMovement).filter(
        InventoryMovement.reference_order_id == order_id,
        InventoryMovement.movement_type == "RESERVED"
    ).all()

    for m in movements:
        inv = db.query(Inventory).filter(Inventory.id == m.inventory_id).with_for_update().first()
        if inv:
            transfer_qty = min(inv.quantity_reserved_kg, m.quantity_kg)
            inv.quantity_reserved_kg -= transfer_qty
            inv.quantity_allocated_kg += transfer_qty

            alloc_m = InventoryMovement(
                inventory_id=inv.id,
                batch_id=inv.batch_id,
                movement_type="ALLOCATED",
                quantity_kg=transfer_qty,
                reference_order_id=order_id,
                notes=f"Allocated upon order acceptance",
                actor_id=actor_id
            )
            db.add(alloc_m)
    db.flush()

def dispatch_allocated_stock(db: Session, order_id: Any, actor_id: Optional[Any] = None):
    """Called when order is dispatched: moves allocated -> dispatched"""
    movements = db.query(InventoryMovement).filter(
        InventoryMovement.reference_order_id == order_id,
        InventoryMovement.movement_type == "ALLOCATED"
    ).all()

    for m in movements:
        inv = db.query(Inventory).filter(Inventory.id == m.inventory_id).with_for_update().first()
        if inv:
            transfer_qty = min(inv.quantity_allocated_kg, m.quantity_kg)
            inv.quantity_allocated_kg -= transfer_qty
            inv.quantity_dispatched_kg += transfer_qty

            disp_m = InventoryMovement(
                inventory_id=inv.id,
                batch_id=inv.batch_id,
                movement_type="DISPATCHED",
                quantity_kg=transfer_qty,
                reference_order_id=order_id,
                notes="Dispatched for delivery",
                actor_id=actor_id
            )
            db.add(disp_m)
    db.flush()

def deliver_dispatched_stock(db: Session, order_id: Any, accepted_kg: Decimal, rejected_kg: Decimal = Decimal("0.00"), actor_id: Optional[Any] = None):
    """Called upon delivery POD capture: moves dispatched -> delivered (and rejected if any)"""
    movements = db.query(InventoryMovement).filter(
        InventoryMovement.reference_order_id == order_id,
        InventoryMovement.movement_type == "DISPATCHED"
    ).all()

    rem_accepted = accepted_kg
    rem_rejected = rejected_kg

    for m in movements:
        inv = db.query(Inventory).filter(Inventory.id == m.inventory_id).with_for_update().first()
        if inv:
            this_del = min(inv.quantity_dispatched_kg, rem_accepted)
            inv.quantity_dispatched_kg -= this_del
            inv.quantity_delivered_kg += this_del
            rem_accepted -= this_del

            del_m = InventoryMovement(
                inventory_id=inv.id,
                batch_id=inv.batch_id,
                movement_type="DELIVERED",
                quantity_kg=this_del,
                reference_order_id=order_id,
                notes="Successfully delivered to buyer with POD",
                actor_id=actor_id
            )
            db.add(del_m)

            if rem_rejected > 0 and inv.quantity_dispatched_kg > 0:
                this_rej = min(inv.quantity_dispatched_kg, rem_rejected)
                inv.quantity_dispatched_kg -= this_rej
                inv.quantity_rejected_kg += this_rej
                rem_rejected -= this_rej

                rej_m = InventoryMovement(
                    inventory_id=inv.id,
                    batch_id=inv.batch_id,
                    movement_type="REJECTED",
                    quantity_kg=this_rej,
                    reference_order_id=order_id,
                    notes="Rejected at delivery point",
                    actor_id=actor_id
                )
                db.add(rej_m)

    db.flush()

def release_order_stock(db: Session, order_id: Any, actor_id: Optional[Any] = None, reason: str = "Order cancelled/rejected"):
    """Rolls back reserved or allocated stock back to available"""
    movements = db.query(InventoryMovement).filter(
        InventoryMovement.reference_order_id == order_id,
        InventoryMovement.movement_type.in_(["RESERVED", "ALLOCATED"])
    ).all()

    for m in movements:
        inv = db.query(Inventory).filter(Inventory.id == m.inventory_id).with_for_update().first()
        if inv:
            if m.movement_type == "RESERVED":
                rel = min(inv.quantity_reserved_kg, m.quantity_kg)
                inv.quantity_reserved_kg -= rel
                inv.quantity_available_kg += rel
            elif m.movement_type == "ALLOCATED":
                rel = min(inv.quantity_allocated_kg, m.quantity_kg)
                inv.quantity_allocated_kg -= rel
                inv.quantity_available_kg += rel

            rel_m = InventoryMovement(
                inventory_id=inv.id,
                batch_id=inv.batch_id,
                movement_type="RELEASED",
                quantity_kg=m.quantity_kg,
                reference_order_id=order_id,
                notes=reason,
                actor_id=actor_id
            )
            db.add(rel_m)
    db.flush()
