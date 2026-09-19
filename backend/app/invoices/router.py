import os
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.invoice import Invoice
from app.models.order import Order
from app.models.user import User
from app.auth.deps import get_current_user

router = APIRouter(prefix="/invoices", tags=["Invoices & GST Tax Compliance"])

@router.get("/{order_id}")
def get_order_invoice(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    inv = db.query(Invoice).filter(Invoice.order_id == order_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found for this order")

    roles = [r.name for r in current_user.roles]
    if "ADMIN" not in roles:
        if "BUYER" in roles and current_user.buyer and inv.buyer_id != current_user.buyer.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this invoice")
        if "SUPPLIER" in roles and current_user.supplier and inv.supplier_id != current_user.supplier.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this invoice")

    return {
        "id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "order_id": str(inv.order_id),
        "supplier_name": inv.supplier.business_name,
        "buyer_name": inv.buyer.business_name,
        "invoice_date": inv.invoice_date.isoformat(),
        "subtotal": float(inv.subtotal),
        "cgst_amount": float(inv.cgst_amount),
        "sgst_amount": float(inv.sgst_amount),
        "igst_amount": float(inv.igst_amount),
        "total_tax": float(inv.total_tax),
        "grand_total": float(inv.grand_total),
        "pdf_available": os.path.exists(inv.pdf_path) if inv.pdf_path else False
    }

@router.get("/{order_id}/pdf")
def download_invoice_pdf(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    inv = db.query(Invoice).filter(Invoice.order_id == order_id).first()
    if not inv or not inv.pdf_path or not os.path.exists(inv.pdf_path):
        raise HTTPException(status_code=404, detail="Invoice PDF file not found on disk")

    return FileResponse(
        path=inv.pdf_path,
        media_type="application/pdf",
        filename=f"{inv.invoice_number}.pdf"
    )
