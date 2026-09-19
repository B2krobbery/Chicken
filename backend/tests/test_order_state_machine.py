import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.supplier import Supplier, SupplierLocation
from app.models.buyer import Buyer, BuyerLocation
from app.models.catalogue import SupplierProduct

def test_order_lifecycle_and_state_machine(
    client: TestClient,
    db_session: Session,
    buyer1_token: str,
    supplier1_token: str
):
    # 1. Get buyer location
    loc_res = client.get(
        "/api/v1/buyers/locations",
        headers={"Authorization": f"Bearer {buyer1_token}"}
    )
    assert loc_res.status_code == 200
    buyer_loc_id = loc_res.json()[0]["id"]

    # 2. Get active listing
    listings_res = client.get("/api/v1/catalogue/listings")
    assert listings_res.status_code == 200
    listing = listings_res.json()[0]
    listing_id = listing["id"]
    supp_id = listing["supplier_id"]

    # 3. Get supplier location
    supp_loc = db_session.query(SupplierLocation).filter(SupplierLocation.supplier_id == supp_id).first()

    # 4. Add to cart
    add_cart = client.post(
        "/api/v1/cart/items",
        headers={"Authorization": f"Bearer {buyer1_token}"},
        json={
            "supplier_product_id": listing_id,
            "supplier_location_id": str(supp_loc.id),
            "quantity_kg": 25.0
        }
    )
    assert add_cart.status_code == 200

    # 5. Checkout cart -> creates order (PENDING)
    checkout_res = client.post(
        "/api/v1/orders",
        headers={"Authorization": f"Bearer {buyer1_token}"},
        json={"delivery_location_id": buyer_loc_id}
    )
    assert checkout_res.status_code == 201
    order_data = checkout_res.json()
    order_id = order_data["id"]
    assert order_data["status"] == "PENDING"

    # 6. Test invalid status jump (e.g., PENDING directly to DELIVERED) -> Should fail
    invalid_jump = client.patch(
        f"/api/v1/orders/{order_id}/status",
        headers={"Authorization": f"Bearer {supplier1_token}"},
        json={"status": "DELIVERED"}
    )
    assert invalid_jump.status_code == 400

    # 7. Supplier accepts order -> CONFIRMED
    accept_res = client.post(
        f"/api/v1/orders/{order_id}/accept",
        headers={"Authorization": f"Bearer {supplier1_token}"},
        json={}
    )
    assert accept_res.status_code == 200
    assert accept_res.json()["status"] == "CONFIRMED"

    # 8. Supplier advances to PROCESSING
    proc_res = client.patch(
        f"/api/v1/orders/{order_id}/status",
        headers={"Authorization": f"Bearer {supplier1_token}"},
        json={"status": "PROCESSING"}
    )
    assert proc_res.status_code == 200
    assert proc_res.json()["status"] == "PROCESSING"

    # 9. Supplier advances to PACKED
    packed_res = client.patch(
        f"/api/v1/orders/{order_id}/status",
        headers={"Authorization": f"Bearer {supplier1_token}"},
        json={"status": "PACKED"}
    )
    assert packed_res.status_code == 200
    assert packed_res.json()["status"] == "PACKED"
