import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Numeric, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sku_code = Column(String(100), unique=True, nullable=False, index=True)  # e.g., CHK-WHL-FRS-A
    name = Column(String(255), nullable=False)
    product_type = Column(String(50), nullable=False)  # WHOLE, CUTS, BONELESS
    condition = Column(String(50), nullable=False)     # FRESH, CHILLED, FROZEN
    grade = Column(String(50), default="GRADE_A", nullable=False)  # GRADE_A, GRADE_B, STANDARD
    standard_pack_size_kg = Column(Numeric(10, 2), default=1.00, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    supplier_listings = relationship("SupplierProduct", back_populates="product")
    inventories = relationship("Inventory", back_populates="product")

class SupplierProduct(Base):
    __tablename__ = "supplier_products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    supplier_sku_code = Column(String(100), nullable=True)
    base_price_per_kg = Column(Numeric(10, 2), nullable=False)
    moq_kg = Column(Numeric(10, 2), default=10.00, nullable=False)  # Minimum order quantity in kg
    lead_time_hours = Column(Integer, default=24, nullable=False)
    pack_size_kg = Column(Numeric(10, 2), default=1.00, nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
    serviceable_pincodes = Column(JSONB, default=list, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (UniqueConstraint("supplier_id", "product_id", name="uq_supplier_product"),)

    supplier = relationship("Supplier", back_populates="products")
    product = relationship("Product", back_populates="supplier_listings")
    prices = relationship("Price", back_populates="supplier_product", order_by="desc(Price.version)")

class Price(Base):
    __tablename__ = "prices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_product_id = Column(UUID(as_uuid=True), ForeignKey("supplier_products.id", ondelete="CASCADE"), nullable=False)
    price_per_kg = Column(Numeric(10, 2), nullable=False)
    effective_from = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    effective_to = Column(DateTime(timezone=True), nullable=True)
    buyer_segment = Column(String(50), default="ALL", nullable=False)  # ALL, RETAILER, HORECA, INSTITUTIONAL
    moq_kg = Column(Numeric(10, 2), default=10.00, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    supplier_product = relationship("SupplierProduct", back_populates="prices")
