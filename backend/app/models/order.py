import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(String(50), unique=True, nullable=False, index=True)  # e.g., ORD-2026-0001
    buyer_id = Column(UUID(as_uuid=True), ForeignKey("buyers.id", ondelete="RESTRICT"), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True)
    supplier_location_id = Column(UUID(as_uuid=True), ForeignKey("supplier_locations.id", ondelete="RESTRICT"), nullable=False)
    delivery_location_id = Column(UUID(as_uuid=True), ForeignKey("buyer_locations.id", ondelete="RESTRICT"), nullable=False)
    
    # State Machine: PENDING, CONFIRMED, PROCESSING, PACKED, DISPATCHED, DELIVERED, REJECTED, CANCELLED, REFUNDED
    status = Column(String(50), default="PENDING", nullable=False, index=True)
    
    subtotal_amount = Column(Numeric(12, 2), nullable=False)
    tax_amount = Column(Numeric(12, 2), nullable=False)
    delivery_fee = Column(Numeric(12, 2), default=0.00, nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    
    delivery_slot_start = Column(DateTime(timezone=True), nullable=True)
    delivery_slot_end = Column(DateTime(timezone=True), nullable=True)
    payment_terms = Column(String(50), default="ADVANCE", nullable=False)  # ADVANCE, NET_7, NET_15, COD
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    buyer = relationship("Buyer", back_populates="orders")
    supplier = relationship("Supplier")
    supplier_location = relationship("SupplierLocation")
    delivery_location = relationship("BuyerLocation")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    status_history = relationship("OrderStatusHistory", back_populates="order", cascade="all, delete-orphan", order_by="desc(OrderStatusHistory.created_at)")
    payment = relationship("Payment", back_populates="order", uselist=False)
    invoice = relationship("Invoice", back_populates="order", uselist=False)
    delivery = relationship("Delivery", back_populates="order", uselist=False)

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    supplier_product_id = Column(UUID(as_uuid=True), ForeignKey("supplier_products.id", ondelete="RESTRICT"), nullable=False)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("inventory_batches.id", ondelete="SET NULL"), nullable=True)
    
    quantity_kg = Column(Numeric(10, 2), nullable=False)
    unit_price_per_kg = Column(Numeric(10, 2), nullable=False)
    tax_rate_percent = Column(Numeric(5, 2), default=5.00, nullable=False)
    tax_amount = Column(Numeric(10, 2), nullable=False)
    total_price = Column(Numeric(12, 2), nullable=False)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")
    supplier_product = relationship("SupplierProduct")
    batch = relationship("InventoryBatch")

class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    changed_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    order = relationship("Order", back_populates="status_history")
    changed_by = relationship("User")
