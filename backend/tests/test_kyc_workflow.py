import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.supplier import Supplier
from app.models.buyer import Buyer

def test_supplier_kyc_approval_workflow(client: TestClient, admin_token: str):
    unique = uuid.uuid4().hex[:6]
    supp_email = f"newsupp_{unique}@test.com"
    supp_phone = f"+9191{unique[:8]}"

    # Register new supplier
    reg = client.post("/api/v1/auth/register", json={
        "email": supp_email,
        "password": "Password@123",
        "full_name": "New Farm Supplier",
        "phone_number": supp_phone,
        "role": "SUPPLIER",
        "business_name": "New Organic Farm Ltd"
    })
    assert reg.status_code == 201
    supp_token = reg.json()["access_token"]
    supp_id = reg.json()["profile_id"]

    # Try creating listing before KYC is approved -> Should fail with 403
    listing_fail = client.post(
        "/api/v1/catalogue/listings",
        headers={"Authorization": f"Bearer {supp_token}"},
        json={
            "product_id": "00000000-0000-0000-0000-000000000000",
            "base_price_per_kg": 150.0,
            "moq_kg": 20.0
        }
    )
    assert listing_fail.status_code == 403
    assert "KYC" in listing_fail.json()["detail"] or "KYC" in str(listing_fail.json())

    # Submit KYC
    kyc_res = client.post(
        "/api/v1/suppliers/kyc",
        headers={"Authorization": f"Bearer {supp_token}"},
        json={
            "gstin": "29XYZAB1234C1Z1",
            "pan": "XYZAB1234C",
            "fssai_license_number": "11998877665544",
            "bank_account_name": "New Organic Farm Ltd",
            "bank_account_number": "50100234567890",
            "bank_ifsc": "HDFC0000123",
            "bank_name": "HDFC Bank"
        }
    )
    assert kyc_res.status_code == 200

    # Admin approves KYC
    appr_res = client.post(
        f"/api/v1/admin/suppliers/{supp_id}/kyc-action",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"action": "APPROVE", "reason": "Documents verified against FSSAI portal"}
    )
    assert appr_res.status_code == 200
    assert appr_res.json()["kyc_status"] == "APPROVED"
