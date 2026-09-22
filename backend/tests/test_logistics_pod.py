import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.order import Order
from app.models.user import User

def test_logistics_assignment_and_pod(
    client: TestClient,
    db_session: Session,
    admin_token: str,
    driver_token: str,
    buyer1_token: str,
    supplier1_token: str
):
    # 0. Setup: Create an active order instead of relying on test execution order
    loc_res = client.get("/api/v1/buyers/locations", headers={"Authorization": f"Bearer {buyer1_token}"})
    buyer_loc_id = loc_res.json()[0]["id"]

    listings_res = client.get("/api/v1/catalogue/listings")
    listing = listings_res.json()[0]
    
    from app.models.supplier import SupplierLocation
    supp_loc = db_session.query(SupplierLocation).filter(SupplierLocation.supplier_id == listing["supplier_id"]).first()

    client.post("/api/v1/cart/items", headers={"Authorization": f"Bearer {buyer1_token}"}, json={
        "supplier_product_id": listing["id"],
        "supplier_location_id": str(supp_loc.id),
        "quantity_kg": 25.0
    })
    
    checkout_res = client.post("/api/v1/orders", headers={"Authorization": f"Bearer {buyer1_token}"}, json={"delivery_location_id": buyer_loc_id})
    order_id = checkout_res.json()["id"]

    # Advance to PACKED
    client.post(f"/api/v1/orders/{order_id}/accept", headers={"Authorization": f"Bearer {supplier1_token}"}, json={})
    client.patch(f"/api/v1/orders/{order_id}/status", headers={"Authorization": f"Bearer {supplier1_token}"}, json={"status": "PROCESSING"})
    client.patch(f"/api/v1/orders/{order_id}/status", headers={"Authorization": f"Bearer {supplier1_token}"}, json={"status": "PACKED"})

    order = db_session.query(Order).filter(Order.id == order_id).first()
    assert order is not None

    driver = db_session.query(User).filter(User.email == "driver@thechickenman.com").first()
    assert driver is not None

    # 1. Admin assigns driver
    assign_res = client.post(
        "/api/v1/logistics/assign",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "order_id": str(order.id),
            "driver_user_id": str(driver.id),
            "vehicle_number": "KA-04-MB-1029"
        }
    )
    assert assign_res.status_code == 200
    delivery_id = assign_res.json()["delivery_id"]

    # 2. Driver views assigned deliveries
    driver_jobs = client.get(
        "/api/v1/logistics/driver/deliveries",
        headers={"Authorization": f"Bearer {driver_token}"}
    )
    assert driver_jobs.status_code == 200
    assert any(d["delivery_id"] == delivery_id for d in driver_jobs.json())

    # 3. Driver captures POD
    total_qty = sum(float(i.quantity_kg) for i in order.items)
    pod_res = client.post(
        f"/api/v1/logistics/deliveries/{delivery_id}/pod",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={
            "delivery_id": delivery_id,
            "pod_type": "OTP",
            "otp_code": "9876",
            "recipient_name": "Executive Chef Store Receiving",
            "quantity_accepted_kg": total_qty
        }
    )
    assert pod_res.status_code == 200
    data = pod_res.json()
    assert data["delivery_status"] == "DELIVERED"
    assert data["order_status"] == "DELIVERED"
