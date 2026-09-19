import pytest
from fastapi.testclient import TestClient

def test_catalogue_and_pricing_versioning(
    client: TestClient,
    admin_token: str,
    supplier1_token: str,
    buyer1_token: str
):
    # 1. Get standard chicken products
    prods = client.get("/api/v1/catalogue/products")
    assert prods.status_code == 200
    prod_list = prods.json()
    assert len(prod_list) >= 4

    # 2. Search listings as buyer
    search_res = client.get("/api/v1/catalogue/listings?condition=FRESH")
    assert search_res.status_code == 200
    listings = search_res.json()
    assert len(listings) > 0
    first_listing = listings[0]
    assert "landed_price_per_kg" in first_listing
    assert first_listing["landed_price_per_kg"] > first_listing["base_price_per_kg"]

    # 3. Update price as supplier (triggers versioning)
    listing_id = first_listing["id"]
    new_price = 175.50
    update_res = client.post(
        "/api/v1/pricing",
        headers={"Authorization": f"Bearer {supplier1_token}"},
        json={
            "supplier_product_id": listing_id,
            "price_per_kg": new_price,
            "moq_kg": 25.0
        }
    )
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["new_price_per_kg"] == new_price
    assert data["version"] >= 2

    # 4. Check price version history
    hist_res = client.get(
        f"/api/v1/pricing/history/{listing_id}",
        headers={"Authorization": f"Bearer {supplier1_token}"}
    )
    assert hist_res.status_code == 200
    assert len(hist_res.json()) >= 2
