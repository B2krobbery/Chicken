import uuid
import pytest
from fastapi.testclient import TestClient

def test_health_and_readiness(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

    res_ready = client.get("/ready")
    assert res_ready.status_code == 200
    assert res_ready.json()["status"] == "ready"

def test_register_and_login_flow(client: TestClient):
    unique_suffix = uuid.uuid4().hex[:6]
    email = f"testbuyer_{unique_suffix}@example.com"
    phone = f"+9198{unique_suffix[:8]}"

    # 1. Register new buyer
    reg_payload = {
        "email": email,
        "password": "SecurePassword@123",
        "full_name": "Test QSR Buyer",
        "phone_number": phone,
        "role": "BUYER",
        "business_name": "Test QSR Kitchens"
    }
    reg_res = client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    data = reg_res.json()
    assert "access_token" in data
    assert data["roles"] == ["BUYER"]
    assert data["kyc_status"] == "PENDING"

    # 2. Login with valid credentials
    login_res = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "SecurePassword@123"
    })
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

    # 3. Login with wrong password
    bad_login = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "WrongPassword!"
    })
    assert bad_login.status_code == 401

def test_unauthorized_access(client: TestClient, buyer1_token: str):
    # Buyer attempts to access Admin dashboard -> 403 Forbidden
    res = client.get(
        "/api/v1/admin/dashboard",
        headers={"Authorization": f"Bearer {buyer1_token}"}
    )
    assert res.status_code == 403

def test_register_role_restriction(client: TestClient):
    # Attempting to self-register as ADMIN or DRIVER must be rejected
    res = client.post("/api/v1/auth/register", json={
        "email": "hacker_admin@example.com",
        "password": "Password@123",
        "full_name": "Fake Admin",
        "phone_number": "+919999888877",
        "role": "ADMIN"
    })
    assert res.status_code == 400
    assert "Public self-registration is only permitted" in res.json()["detail"]

def test_login_whitespace_and_case_insensitivity(client: TestClient):
    unique_suffix = uuid.uuid4().hex[:6]
    email = f"whitespacetest_{unique_suffix}@example.com"
    phone = f"+9197{unique_suffix[:8]}"

    reg_res = client.post("/api/v1/auth/register", json={
        "email": f"  {email.upper()}  ",
        "password": "Password@123",
        "full_name": "Whitespace User",
        "phone_number": f"  {phone}  ",
        "role": "SUPPLIER"
    })
    assert reg_res.status_code == 201

    # Login with mixed case and leading/trailing whitespace
    login_res = client.post("/api/v1/auth/login", json={
        "email": f"  {email}  ",
        "password": "Password@123"
    })
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

