import uuid
from datetime import datetime, timezone, date
from sqlalchemy import Column, String, Date, DateTime, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)  # e.g., INV-2026-0001
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="RESTRICT"), unique=True, nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False)
    buyer_id = Column(UUID(as_uuid=True), ForeignKey("buyers.id", ondelete="RESTRICT"), nullable=False)
    
    invoice_date = Column(Date, default=date.today, nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)
    cgst_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    sgst_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    igst_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    total_tax = Column(Numeric(12, 2), nullable=False)
    grand_total = Column(Numeric(12, 2), nullable=False)
    
    pdf_path = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    order = relationship("Order", back_populates="invoice")
    supplier = relationship("Supplier")
    buyer = relationship("Buyer")
