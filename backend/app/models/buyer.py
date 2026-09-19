import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class Buyer(Base):
    __tablename__ = "buyers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    business_name = Column(String(255), nullable=False)
    buyer_type = Column(String(50), default="RESTAURANT", nullable=False)  # RETAILER, HOTEL, RESTAURANT, QSR, CATERER, INSTITUTIONAL
    kyc_status = Column(String(50), default="PENDING", nullable=False, index=True)  # PENDING, APPROVED, REJECTED, SUSPENDED
    status = Column(String(50), default="ACTIVE", nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="buyer")
    kyc = relationship("BuyerKYC", back_populates="buyer", uselist=False, cascade="all, delete-orphan")
    documents = relationship("BuyerDocument", back_populates="buyer", cascade="all, delete-orphan")
    locations = relationship("BuyerLocation", back_populates="buyer", cascade="all, delete-orphan")
    contacts = relationship("BuyerContact", back_populates="buyer", cascade="all, delete-orphan")
    cart = relationship("Cart", back_populates="buyer", uselist=False, cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="buyer")

class BuyerKYC(Base):
    __tablename__ = "buyer_kyc"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    buyer_id = Column(UUID(as_uuid=True), ForeignKey("buyers.id", ondelete="CASCADE"), unique=True, nullable=False)
    gstin = Column(String(15), nullable=True)  # Some small retailers may be composite/unregistered, but mandatory for B2B input credit
    pan = Column(String(10), nullable=False)
    fssai_license_number = Column(String(14), nullable=False)
    status = Column(String(50), default="PENDING", nullable=False)
    rejection_reason = Column(Text, nullable=True)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)

    buyer = relationship("Buyer", back_populates="kyc")

class BuyerDocument(Base):
    __tablename__ = "buyer_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    buyer_id = Column(UUID(as_uuid=True), ForeignKey("buyers.id", ondelete="CASCADE"), nullable=False)
    document_type = Column(String(50), nullable=False)  # GST_CERTIFICATE, FSSAI_LICENSE, PAN_CARD, OTHER
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    buyer = relationship("Buyer", back_populates="documents")

class BuyerLocation(Base):
    __tablename__ = "buyer_locations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    buyer_id = Column(UUID(as_uuid=True), ForeignKey("buyers.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)  # e.g. "Main Kitchen - Indiranagar"
    address_line1 = Column(String(255), nullable=False)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    pincode = Column(String(10), nullable=False, index=True)
    operating_hours = Column(String(100), nullable=True)  # e.g. "06:00 - 18:00"
    is_primary = Column(Boolean, default=False, nullable=False)
    is_verified = Column(Boolean, default=True, nullable=False)

    buyer = relationship("Buyer", back_populates="locations")

class BuyerContact(Base):
    __tablename__ = "buyer_contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    buyer_id = Column(UUID(as_uuid=True), ForeignKey("buyers.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=False)
    designation = Column(String(100), nullable=True)
    is_primary = Column(Boolean, default=False, nullable=False)

    buyer = relationship("Buyer", back_populates="contacts")
