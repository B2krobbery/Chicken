import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.order import Order
from app.models.invoice import Invoice
from app.invoices.service import generate_invoice_for_order

def test_gst_invoice_engine(client: TestClient, db_session: Session, buyer1_token: str):
    order = db_session.query(Order).first()
    assert order is not None

    # Generate invoice for order
    invoice = generate_invoice_for_order(db_session, order)
    assert invoice is not None
    assert invoice.invoice_number.startswith("INV-")
    assert invoice.grand_total > 0

    # Query invoice endpoint
    res = client.get(
        f"/api/v1/invoices/{order.id}",
        headers={"Authorization": f"Bearer {buyer1_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["invoice_number"] == invoice.invoice_number
    assert "total_tax" in data
    assert data["grand_total"] == float(invoice.grand_total)
