import uuid
from datetime import date, timedelta
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

def test_complete_30_step_mvp_scenario(client: TestClient):
    """
    Executes the exact 30-step end-to-end acceptance flow mandated by TheChickenMan roadmap.
    """
    unique_suffix = uuid.uuid4().hex[:6]

    # 1. Admin logs in
    admin_login = client.post("/api/v1/auth/login", json={
        "email": "admin@thechickenman.com",
        "password": "Password@123"
    })
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]

    # 2. Supplier registers
    supp_email = f"e2e_supp_{unique_suffix}@poultryfarm.com"
    supp_reg = client.post("/api/v1/auth/register", json={
        "email": supp_email,
        "password": "Password@123",
        "full_name": f"Pioneer Farms {unique_suffix}",
        "phone_number": f"+9193{unique_suffix[:8]}",
        "role": "SUPPLIER",
        "business_name": f"Pioneer Poultry Ltd {unique_suffix}"
    })
    assert supp_reg.status_code == 201
    supp_token = supp_reg.json()["access_token"]
    supp_id = supp_reg.json()["profile_id"]

    # 3. Supplier submits KYC
    kyc_sub = client.post(
        "/api/v1/suppliers/kyc",
        headers={"Authorization": f"Bearer {supp_token}"},
        json={
            "gstin": "29AABCP1234F1Z9",
            "pan": "AABCP1234F",
            "fssai_license_number": "11443322110099",
            "bank_account_name": "Pioneer Poultry Ltd",
            "bank_account_number": "918273645012",
            "bank_ifsc": "SBIN0001234",
            "bank_name": "State Bank of India"
        }
    )
    assert kyc_sub.status_code == 200

    # Add supplier location
    loc_sub = client.post(
        "/api/v1/suppliers/locations",
        headers={"Authorization": f"Bearer {supp_token}"},
        json={
            "name": "Pioneer Central Dispatch",
            "type": "WAREHOUSE",
            "address_line1": "Whitefield Main Rd",
            "city": "Bangalore",
            "state": "Karnataka",
            "pincode": "560066",
            "serviceable_pincodes": ["560066", "560038", "560001"]
        }
    )
    assert loc_sub.status_code == 201
    supp_loc_id = loc_sub.json()["id"]

    # 4. Admin approves supplier
    appr_supp = client.post(
        f"/api/v1/admin/suppliers/{supp_id}/kyc-action",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"action": "APPROVE", "reason": "Verified FSSAI and Bank details"}
    )
    assert appr_supp.status_code == 200
    assert appr_supp.json()["kyc_status"] == "APPROVED"

    # 5. Supplier creates chicken SKU listing
    prods = client.get("/api/v1/catalogue/products")
    whole_chicken = prods.json()[0]
    prod_id = whole_chicken["id"]

    listing_res = client.post(
        "/api/v1/catalogue/listings",
        headers={"Authorization": f"Bearer {supp_token}"},
        json={
            "product_id": prod_id,
            "base_price_per_kg": 165.00,
            "moq_kg": 20.00,
            "lead_time_hours": 12,
            "pack_size_kg": 1.00,
            "serviceable_pincodes": ["560066", "560038", "560001"]
        }
    )
    assert listing_res.status_code == 201
    listing_id = listing_res.json()["id"]

    # 6. Supplier adds a batch
    today = date.today()
    batch_res = client.post(
        "/api/v1/inventory/batches",
        headers={"Authorization": f"Bearer {supp_token}"},
        json={
            "batch_number": f"BAT-E2E-{unique_suffix}",
            "production_date": today.isoformat(),
            "expiry_date": (today + timedelta(days=4)).isoformat(),
            "storage_condition": "CHILLED"
        }
    )
    assert batch_res.status_code == 201
    batch_id = batch_res.json()["id"]

    # 7. Supplier adds inventory (Stock In 200 kg)
    stock_res = client.post(
        "/api/v1/inventory/stock-in",
        headers={"Authorization": f"Bearer {supp_token}"},
        json={
            "location_id": supp_loc_id,
            "product_id": prod_id,
            "quantity_kg": 200.00,
            "batch_id": batch_id,
            "notes": "E2E batch arrival"
        }
    )
    assert stock_res.status_code == 201
    assert stock_res.json()["quantity_available_kg"] >= 200.00

    # 8. Supplier sets price and MOQ (updates version)
    price_res = client.post(
        "/api/v1/pricing",
        headers={"Authorization": f"Bearer {supp_token}"},
        json={
            "supplier_product_id": listing_id,
            "price_per_kg": 168.00,
            "moq_kg": 25.00
        }
    )
    assert price_res.status_code == 200
    assert price_res.json()["new_price_per_kg"] == 168.00

    # 9. Buyer registers
    buyer_email = f"e2e_buyer_{unique_suffix}@restaurant.com"
    buyer_reg = client.post("/api/v1/auth/register", json={
        "email": buyer_email,
        "password": "Password@123",
        "full_name": f"Royal Biryani House {unique_suffix}",
        "phone_number": f"+9194{unique_suffix[:8]}",
        "role": "BUYER",
        "business_name": f"Royal Biryani House Ltd {unique_suffix}"
    })
    assert buyer_reg.status_code == 201
    buyer_token = buyer_reg.json()["access_token"]
    buyer_id = buyer_reg.json()["profile_id"]

    # 10. Buyer submits KYC
    buyer_kyc_res = client.post(
        "/api/v1/buyers/kyc",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "pan": "BBQPR1234M",
            "fssai_license_number": "11335577991122",
            "gstin": "29BBQPR1234M1Z2"
        }
    )
    assert buyer_kyc_res.status_code == 200

    # Buyer adds delivery address
    buyer_loc_res = client.post(
        "/api/v1/buyers/locations",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "name": "Main Dining Kitchen",
            "address_line1": "12 CMH Road",
            "city": "Bangalore",
            "state": "Karnataka",
            "pincode": "560038"
        }
    )
    assert buyer_loc_res.status_code == 201
    buyer_delivery_loc_id = buyer_loc_res.json()["id"]

    # 11. Admin approves buyer
    appr_buyer = client.post(
        f"/api/v1/admin/buyers/{buyer_id}/kyc-action",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"action": "APPROVE", "reason": "Commercial business license verified"}
    )
    assert appr_buyer.status_code == 200
    assert appr_buyer.json()["kyc_status"] == "APPROVED"

    # 12. Buyer searches for chicken
    search_res = client.get(f"/api/v1/catalogue/listings?pincode=560038")
    assert search_res.status_code == 200
    found_listings = search_res.json()
    assert len(found_listings) > 0

    # 13. Buyer sees product, price, MOQ and availability
    detail_res = client.get(f"/api/v1/catalogue/listings/{listing_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["base_price_per_kg"] == 168.00
    assert detail["moq_kg"] == 25.00
    assert detail["total_available_stock_kg"] >= 200.00
    assert "landed_price_per_kg" in detail

    # 14. Buyer adds product to cart
    add_cart = client.post(
        "/api/v1/cart/items",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "supplier_product_id": listing_id,
            "supplier_location_id": supp_loc_id,
            "quantity_kg": 30.00
        }
    )
    assert add_cart.status_code == 200

    # 15. Checkout validates all constraints (cart inspection)
    cart_check = client.get(
        "/api/v1/cart",
        headers={"Authorization": f"Bearer {buyer_token}"}
    )
    assert cart_check.status_code == 200
    assert cart_check.json()["is_valid_for_checkout"] is True

    # 16. Order is created
    order_create = client.post(
        "/api/v1/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={"delivery_location_id": buyer_delivery_loc_id}
    )
    assert order_create.status_code == 201
    order = order_create.json()
    order_id = order["id"]
    assert order["status"] == "PENDING"
    assert order["total_amount"] > 0

    # 17. Inventory is reserved without overselling (stock check)
    inv_check = client.get(
        "/api/v1/inventory",
        headers={"Authorization": f"Bearer {supp_token}"}
    )
    assert inv_check.status_code == 200
    inv_item = [i for i in inv_check.json() if i["batch_id"] == batch_id][0]
    assert inv_item["quantity_reserved_kg"] >= 30.00

    # 18. Supplier accepts order
    accept_res = client.post(
        f"/api/v1/orders/{order_id}/accept",
        headers={"Authorization": f"Bearer {supp_token}"},
        json={}
    )
    assert accept_res.status_code == 200
    assert accept_res.json()["status"] == "CONFIRMED"

    # 19. Buyer receives status update
    buyer_order_view = client.get(
        f"/api/v1/orders/{order_id}",
        headers={"Authorization": f"Bearer {buyer_token}"}
    )
    assert buyer_order_view.status_code == 200
    assert buyer_order_view.json()["status"] == "CONFIRMED"

    # 20. Payment is processed (create intent & simulate success)
    pay_intent = client.post(
        "/api/v1/payments/intent",
        headers={
            "Authorization": f"Bearer {buyer_token}",
            "Idempotency-Key": f"idemp_{unique_suffix}"
        },
        json={"order_id": order_id}
    )
    assert pay_intent.status_code == 200
    payment_id = pay_intent.json()["payment_id"]

    # 21. Payment webhook is verified and handled idempotently
    wh_event = f"wh_evt_{unique_suffix}"
    wh_res = client.post(
        "/api/v1/payments/webhook",
        json={
            "event_id": wh_event,
            "payment_id": payment_id,
            "status": "SUCCESS",
            "transaction_id": f"txn_bank_{unique_suffix}"
        }
    )
    assert wh_res.status_code == 200

    # Duplicate replay check
    wh_replay = client.post(
        "/api/v1/payments/webhook",
        json={
            "event_id": wh_event,
            "payment_id": payment_id,
            "status": "SUCCESS"
        }
    )
    assert wh_replay.status_code == 200

    # 22. Invoice is generated
    inv_res = client.get(
        f"/api/v1/invoices/{order_id}",
        headers={"Authorization": f"Bearer {buyer_token}"}
    )
    assert inv_res.status_code == 200
    invoice_data = inv_res.json()
    assert invoice_data["invoice_number"].startswith("INV-")
    assert invoice_data["grand_total"] == order["total_amount"]

    # 23. Admin assigns delivery
    drivers = client.get(
        "/api/v1/admin/drivers",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    driver_id = drivers.json()[0]["id"]

    assign_res = client.post(
        "/api/v1/logistics/assign",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "order_id": order_id,
            "driver_user_id": driver_id,
            "vehicle_number": "KA-51-AB-1234"
        }
    )
    assert assign_res.status_code == 200
    delivery_id = assign_res.json()["delivery_id"]

    # 24. Driver receives delivery
    driver_login = client.post("/api/v1/auth/login", json={
        "email": "driver@thechickenman.com",
        "password": "Password@123"
    })
    driver_token = driver_login.json()["access_token"]

    driver_jobs = client.get(
        "/api/v1/logistics/driver/deliveries",
        headers={"Authorization": f"Bearer {driver_token}"}
    )
    assert driver_jobs.status_code == 200
    assert any(j["delivery_id"] == delivery_id for j in driver_jobs.json())

    # 25 & 26. Driver completes delivery and POD is captured
    pod_res = client.post(
        f"/api/v1/logistics/deliveries/{delivery_id}/pod",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={
            "delivery_id": delivery_id,
            "pod_type": "OTP",
            "otp_code": "5566",
            "recipient_name": "Store Manager Prakash",
            "quantity_accepted_kg": 30.00
        }
    )
    assert pod_res.status_code == 200

    # 27. Order becomes delivered
    delivered_order = client.get(
        f"/api/v1/orders/{order_id}",
        headers={"Authorization": f"Bearer {buyer_token}"}
    )
    assert delivered_order.status_code == 200
    assert delivered_order.json()["status"] == "DELIVERED"

    # 28. Inventory reflects the delivery (delivered quantity updated)
    final_inv = client.get(
        "/api/v1/inventory",
        headers={"Authorization": f"Bearer {supp_token}"}
    )
    assert final_inv.status_code == 200
    delivered_item = [i for i in final_inv.json() if i["batch_id"] == batch_id][0]
    assert delivered_item["quantity_delivered_kg"] >= 30.00

    # 29. Audit logs contain the important events
    audit_res = client.get(
        "/api/v1/admin/audit-logs?limit=50",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert audit_res.status_code == 200
    actions = [log["action"] for log in audit_res.json()]
    assert "USER_REGISTER" in actions
    assert "ORDER_CREATE" in actions
    assert "POD_CAPTURED" in actions

    # 30. Admin dashboard reflects the transaction
    dash_res = client.get(
        "/api/v1/admin/dashboard",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert dash_res.status_code == 200
    dash = dash_res.json()
    assert dash["total_orders"] >= 1
    assert dash["total_kg_sold"] >= 30.0
    assert dash["gmv"] >= order["total_amount"]
    assert dash["active_suppliers"] >= 1
    assert dash["active_buyers"] >= 1
