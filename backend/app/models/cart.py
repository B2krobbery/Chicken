import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class Cart(Base):
    __tablename__ = "carts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    buyer_id = Column(UUID(as_uuid=True), ForeignKey("buyers.id", ondelete="CASCADE"), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    buyer = relationship("Buyer", back_populates="cart")
    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")

class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cart_id = Column(UUID(as_uuid=True), ForeignKey("carts.id", ondelete="CASCADE"), nullable=False)
    supplier_product_id = Column(UUID(as_uuid=True), ForeignKey("supplier_products.id", ondelete="CASCADE"), nullable=False)
    supplier_location_id = Column(UUID(as_uuid=True), ForeignKey("supplier_locations.id", ondelete="CASCADE"), nullable=False)
    quantity_kg = Column(Numeric(10, 2), nullable=False)
    added_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    cart = relationship("Cart", back_populates="items")
    supplier_product = relationship("SupplierProduct")
    supplier_location = relationship("SupplierLocation")
