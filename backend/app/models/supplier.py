import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    business_name = Column(String(255), nullable=False)
    trade_name = Column(String(255), nullable=True)
    kyc_status = Column(String(50), default="PENDING", nullable=False, index=True)  # PENDING, APPROVED, REJECTED, SUSPENDED
    status = Column(String(50), default="ACTIVE", nullable=False, index=True)      # ACTIVE, INACTIVE
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="supplier")
    kyc = relationship("SupplierKYC", back_populates="supplier", uselist=False, cascade="all, delete-orphan")
    documents = relationship("SupplierDocument", back_populates="supplier", cascade="all, delete-orphan")
    locations = relationship("SupplierLocation", back_populates="supplier", cascade="all, delete-orphan")
    contacts = relationship("SupplierContact", back_populates="supplier", cascade="all, delete-orphan")
    products = relationship("SupplierProduct", back_populates="supplier")
    batches = relationship("InventoryBatch", back_populates="supplier")

class SupplierKYC(Base):
    __tablename__ = "supplier_kyc"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="CASCADE"), unique=True, nullable=False)
    gstin = Column(String(15), nullable=False)
    pan = Column(String(10), nullable=False)
    fssai_license_number = Column(String(14), nullable=False)
    bank_account_name = Column(String(255), nullable=False)
    bank_account_number = Column(String(50), nullable=False)
    bank_ifsc = Column(String(20), nullable=False)
    bank_name = Column(String(255), nullable=False)
    status = Column(String(50), default="PENDING", nullable=False)  # PENDING, APPROVED, REJECTED, SUSPENDED
    rejection_reason = Column(Text, nullable=True)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)

    supplier = relationship("Supplier", back_populates="kyc")

class SupplierDocument(Base):
    __tablename__ = "supplier_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    document_type = Column(String(50), nullable=False)  # GST_CERTIFICATE, FSSAI_LICENSE, PAN_CARD, CANCELLED_CHEQUE, OTHER
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    supplier = relationship("Supplier", back_populates="documents")

class SupplierLocation(Base):
    __tablename__ = "supplier_locations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(50), default="WAREHOUSE", nullable=False)  # PLANT, WAREHOUSE, DISPATCH_POINT
    address_line1 = Column(String(255), nullable=False)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    pincode = Column(String(10), nullable=False, index=True)
    serviceable_pincodes = Column(JSONB, default=list, nullable=False)  # List of serviceable pincodes e.g. ["560001", "560002"]
    is_active = Column(Boolean, default=True, nullable=False)

    supplier = relationship("Supplier", back_populates="locations")

class SupplierContact(Base):
    __tablename__ = "supplier_contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=False)
    designation = Column(String(100), nullable=True)
    is_primary = Column(Boolean, default=False, nullable=False)

    supplier = relationship("Supplier", back_populates="contacts")
