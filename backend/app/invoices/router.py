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

    order = inv.order
    supp = inv.supplier
    buyer = inv.buyer
    supp_kyc = supp.kyc if supp else None
    buyer_kyc = buyer.kyc if buyer else None

    # Line items
    items = [
        {
            "id": str(item.id),
            "product_name": item.product.name,
            "sku_code": item.product.sku_code,
            "hsn_code": "0207",  # Standard Meat and poultry HSN
            "condition": item.product.condition,
            "quantity_kg": float(item.quantity_kg),
            "unit_price_per_kg": float(item.unit_price_per_kg),
            "tax_rate_percent": float(item.tax_rate_percent),
            "tax_amount": float(item.tax_amount),
            "total_price": float(item.total_price)
        }
        for item in order.items
    ]

    return {
        "id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "order_id": str(inv.order_id),
        "order_number": order.order_number,
        "invoice_date": inv.invoice_date.isoformat(),
        "supplier": {
            "business_name": supp.business_name if supp else "Poultry Processor",
            "gstin": supp_kyc.gstin if supp_kyc else "29AAACV1234F1Z5",
            "fssai": supp_kyc.fssai_license_number if supp_kyc else "10012011000123",
            "address": f"{order.supplier_location.name}, {order.supplier_location.address_line1}, {order.supplier_location.city}, {order.supplier_location.state} - {order.supplier_location.pincode}" if order.supplier_location else "Bangalore Processing Plant"
        },
        "buyer": {
            "business_name": buyer.business_name if buyer else "Commercial Kitchen",
            "gstin": buyer_kyc.gstin if (buyer_kyc and buyer_kyc.gstin) else "29AABCU9876R1Z2",
            "fssai": buyer_kyc.fssai_license_number if buyer_kyc else "10019043000456",
            "address": f"{order.delivery_location.name}, {order.delivery_location.address_line1}, {order.delivery_location.city}, {order.delivery_location.state} - {order.delivery_location.pincode}" if order.delivery_location else "Main Outlet"
        },
        "items": items,
        "subtotal": float(inv.subtotal),
        "delivery_fee": float(order.delivery_fee),
        "cgst_amount": float(inv.cgst_amount),
        "sgst_amount": float(inv.sgst_amount),
        "igst_amount": float(inv.igst_amount),
        "total_tax": float(inv.total_tax),
        "grand_total": float(inv.grand_total),
        "payment_status": order.payment.status if order.payment else "PAID",
        "pdf_available": True
    }

@router.get("/{order_id}/pdf")
def download_invoice_pdf(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    inv = db.query(Invoice).filter(Invoice.order_id == order_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found for this order")

    # If PDF is not on disk (e.g. fresh container on Railway), generate it on the fly
    if not inv.pdf_path or not os.path.exists(inv.pdf_path):
        from app.invoices.service import create_invoice_pdf
        from app.core.config import settings
        order = db.query(Order).filter(Order.id == inv.order_id).first()
        file_path = os.path.join(settings.STORAGE_LOCAL_PATH, "invoices", f"{inv.invoice_number}.pdf")
        create_invoice_pdf(inv, order, file_path)
        inv.pdf_path = file_path
        db.commit()

    return FileResponse(
        path=inv.pdf_path,
        media_type="application/pdf",
        filename=f"{inv.invoice_number}.pdf"
    )
