import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Date, DateTime, Numeric, ForeignKey, Text, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class InventoryBatch(Base):
    __tablename__ = "inventory_batches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    batch_number = Column(String(100), nullable=False, index=True)
    production_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=False)
    storage_condition = Column(String(50), default="CHILLED", nullable=False)  # FRESH, CHILLED, FROZEN
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    supplier = relationship("Supplier", back_populates="batches")
    inventories = relationship("Inventory", back_populates="batch")

class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    supplier_location_id = Column(UUID(as_uuid=True), ForeignKey("supplier_locations.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("inventory_batches.id", ondelete="SET NULL"), nullable=True)

    # Multi-state inventory quantities in kg
    quantity_available_kg = Column(Numeric(12, 2), default=0.00, nullable=False)
    quantity_reserved_kg = Column(Numeric(12, 2), default=0.00, nullable=False)
    quantity_allocated_kg = Column(Numeric(12, 2), default=0.00, nullable=False)
    quantity_dispatched_kg = Column(Numeric(12, 2), default=0.00, nullable=False)
    quantity_delivered_kg = Column(Numeric(12, 2), default=0.00, nullable=False)
    quantity_rejected_kg = Column(Numeric(12, 2), default=0.00, nullable=False)
    quantity_expired_kg = Column(Numeric(12, 2), default=0.00, nullable=False)

    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        CheckConstraint("quantity_available_kg >= 0", name="chk_inv_available_non_negative"),
        CheckConstraint("quantity_reserved_kg >= 0", name="chk_inv_reserved_non_negative"),
        CheckConstraint("quantity_allocated_kg >= 0", name="chk_inv_allocated_non_negative"),
        CheckConstraint("quantity_dispatched_kg >= 0", name="chk_inv_dispatched_non_negative"),
        CheckConstraint("quantity_delivered_kg >= 0", name="chk_inv_delivered_non_negative"),
        Index("idx_inv_lookup", "supplier_id", "supplier_location_id", "product_id", "batch_id"),
    )

    location = relationship("SupplierLocation")
    product = relationship("Product", back_populates="inventories")
    batch = relationship("InventoryBatch", back_populates="inventories")
    movements = relationship("InventoryMovement", back_populates="inventory", cascade="all, delete-orphan")

class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inventory_id = Column(UUID(as_uuid=True), ForeignKey("inventory.id", ondelete="CASCADE"), nullable=False)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("inventory_batches.id", ondelete="SET NULL"), nullable=True)
    movement_type = Column(String(50), nullable=False)  # STOCK_IN, RESERVED, RELEASED, ALLOCATED, DISPATCHED, DELIVERED, REJECTED, EXPIRED, ADJUSTMENT
    quantity_kg = Column(Numeric(12, 2), nullable=False)
    reference_order_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    inventory = relationship("Inventory", back_populates="movements")
