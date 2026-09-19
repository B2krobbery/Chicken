import os
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app.core.config import settings
from app.models.invoice import Invoice
from app.models.order import Order
from app.audit.service import log_audit_event

def generate_invoice_number(db: Session) -> str:
    year = datetime.now().year
    count = db.query(Invoice).count() + 1
    return f"INV-{year}-{count:05d}"

def create_invoice_pdf(invoice: Invoice, order: Order, output_path: str):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    c = canvas.Canvas(output_path, pagesize=letter)
    width, height = letter

    # Header
    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, height - 50, "TAX INVOICE")
    c.setFont("Helvetica", 10)
    c.drawString(50, height - 70, f"Invoice No: {invoice.invoice_number}")
    c.drawString(50, height - 85, f"Date: {invoice.invoice_date.isoformat()}")
    c.drawString(50, height - 100, f"Order Ref: {order.order_number}")

    # Supplier Box
    c.setFont("Helvetica-Bold", 11)
    c.drawString(50, height - 130, "SUPPLIER (Seller):")
    c.setFont("Helvetica", 10)
    c.drawString(50, height - 145, f"Name: {order.supplier.business_name}")
    supp_gstin = order.supplier.kyc.gstin if order.supplier.kyc else "N/A"
    c.drawString(50, height - 160, f"GSTIN: {supp_gstin}")
    c.drawString(50, height - 175, f"Dispatch: {order.supplier_location.name}, {order.supplier_location.city}, {order.supplier_location.state}")

    # Buyer Box
    c.setFont("Helvetica-Bold", 11)
    c.drawString(320, height - 130, "BUYER (Recipient):")
    c.setFont("Helvetica", 10)
    c.drawString(320, height - 145, f"Name: {order.buyer.business_name}")
    buyer_gstin = order.buyer.kyc.gstin if (order.buyer.kyc and order.buyer.kyc.gstin) else "N/A"
    c.drawString(320, height - 160, f"GSTIN: {buyer_gstin}")
    c.drawString(320, height - 175, f"Delivery: {order.delivery_location.name}, {order.delivery_location.city}, {order.delivery_location.state}")

    # Table Header
    y = height - 210
    c.line(50, y, 550, y)
    y -= 15
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, y, "Item / SKU")
    c.drawString(220, y, "Qty (kg)")
    c.drawString(300, y, "Rate/kg")
    c.drawString(380, y, "Tax")
    c.drawString(460, y, "Total (INR)")
    y -= 10
    c.line(50, y, 550, y)

    # Line Items
    c.setFont("Helvetica", 10)
    y -= 20
    for item in order.items:
        c.drawString(50, y, f"{item.product.name[:25]}")
        c.drawString(220, y, f"{float(item.quantity_kg):.2f}")
        c.drawString(300, y, f"Rs {float(item.unit_price_per_kg):.2f}")
        c.drawString(380, y, f"Rs {float(item.tax_amount):.2f}")
        c.drawString(460, y, f"Rs {float(item.total_price):.2f}")
        y -= 20

    # Summary Line
    y -= 10
    c.line(50, y, 550, y)
    y -= 20
    c.setFont("Helvetica", 10)
    c.drawString(300, y, "Subtotal:")
    c.drawString(460, y, f"Rs {float(invoice.subtotal):.2f}")
    y -= 15
    if invoice.cgst_amount > 0:
        c.drawString(300, y, "CGST (2.5%):")
        c.drawString(460, y, f"Rs {float(invoice.cgst_amount):.2f}")
        y -= 15
        c.drawString(300, y, "SGST (2.5%):")
        c.drawString(460, y, f"Rs {float(invoice.sgst_amount):.2f}")
        y -= 15
    else:
        c.drawString(300, y, "IGST (5.0%):")
        c.drawString(460, y, f"Rs {float(invoice.igst_amount):.2f}")
        y -= 15

    c.drawString(300, y, "Delivery Fee:")
    c.drawString(460, y, f"Rs {float(order.delivery_fee):.2f}")
    y -= 20
    c.setFont("Helvetica-Bold", 11)
    c.drawString(300, y, "Grand Total:")
    c.drawString(460, y, f"Rs {float(invoice.grand_total):.2f}")

    # Footer
    c.setFont("Helvetica-Oblique", 9)
    c.drawString(50, 40, "This is a computer-generated tax invoice issued via TheChickenMan B2B poultry platform.")
    c.save()

def generate_invoice_for_order(db: Session, order: Order) -> Invoice:
    existing = db.query(Invoice).filter(Invoice.order_id == order.id).first()
    if existing:
        return existing

    inv_num = generate_invoice_number(db)
    subtotal = order.subtotal_amount

    # Place of supply tax calculation
    supp_state = order.supplier_location.state.strip().lower()
    buyer_state = order.delivery_location.state.strip().lower()

    if supp_state == buyer_state:
        # Intrastate: CGST (2.5%) + SGST (2.5%)
        cgst = round(subtotal * Decimal("0.025"), 2)
        sgst = round(subtotal * Decimal("0.025"), 2)
        igst = Decimal("0.00")
        total_tax = cgst + sgst
    else:
        # Interstate: IGST (5%)
        cgst = Decimal("0.00")
        sgst = Decimal("0.00")
        igst = round(subtotal * Decimal("0.05"), 2)
        total_tax = igst

    grand_total = subtotal + total_tax + order.delivery_fee

    pdf_rel_path = f"uploads/invoices/{inv_num}.pdf"
    pdf_abs_path = os.path.join(settings.STORAGE_LOCAL_PATH, "invoices", f"{inv_num}.pdf")

    invoice = Invoice(
        invoice_number=inv_num,
        order_id=order.id,
        supplier_id=order.supplier_id,
        buyer_id=order.buyer_id,
        invoice_date=date.today(),
        subtotal=subtotal,
        cgst_amount=cgst,
        sgst_amount=sgst,
        igst_amount=igst,
        total_tax=total_tax,
        grand_total=grand_total,
        pdf_path=pdf_rel_path
    )
    db.add(invoice)
    db.flush()

    try:
        create_invoice_pdf(invoice, order, pdf_abs_path)
    except Exception as e:
        # Non-fatal if PDF generation environment fails; DB record intact
        pass

    log_audit_event(
        db=db,
        action="INVOICE_GENERATED",
        entity_type="INVOICE",
        entity_id=str(invoice.id),
        new_values={"invoice_number": inv_num, "grand_total": float(grand_total)}
    )

    db.commit()
    db.refresh(invoice)
    return invoice
