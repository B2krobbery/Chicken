import sys
import os
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend"))

from app.core.database import SessionLocal, engine
from app.core.security import get_password_hash
from app.models.user import Role, User, UserRole
from app.models.supplier import Supplier, SupplierKYC, SupplierLocation, SupplierContact
from app.models.buyer import Buyer, BuyerKYC, BuyerLocation, BuyerContact
from app.models.catalogue import Product, SupplierProduct, Price
from app.models.inventory import InventoryBatch, Inventory, InventoryMovement
from app.models.cart import Cart
from app.models.order import Order, OrderItem, OrderStatusHistory
from app.models.payment import Payment, PaymentTransaction
from app.models.invoice import Invoice
from app.models.logistics import Delivery, ProofOfDelivery
from app.inventory.service import add_stock
from app.invoices.service import generate_invoice_for_order

def seed():
    db = SessionLocal()
    try:
        print("🌱 Seeding Roles...")
        roles = {}
        for role_name in ["ADMIN", "SUPPLIER", "BUYER", "DRIVER"]:
            r = db.query(Role).filter(Role.name == role_name).first()
            if not r:
                r = Role(name=role_name, description=f"{role_name} platform role")
                db.add(r)
                db.flush()
            roles[role_name] = r

        default_pw = get_password_hash("Password@123")

        print("🌱 Seeding Admin User...")
        admin_user = db.query(User).filter(User.email == "admin@thechickenman.com").first()
        if not admin_user:
            admin_user = User(
                email="admin@thechickenman.com",
                phone_number="+919900000001",
                password_hash=default_pw,
                full_name="Rajesh Sharma (Admin)",
                is_active=True
            )
            db.add(admin_user)
            db.flush()
            db.add(UserRole(user_id=admin_user.id, role_id=roles["ADMIN"].id))
            db.flush()

        print("🌱 Seeding Driver...")
        driver_user = db.query(User).filter(User.email == "driver@thechickenman.com").first()
        if not driver_user:
            driver_user = User(
                email="driver@thechickenman.com",
                phone_number="+919900000009",
                password_hash=default_pw,
                full_name="Ramesh Kumar (Driver)",
                is_active=True
            )
            db.add(driver_user)
            db.flush()
            db.add(UserRole(user_id=driver_user.id, role_id=roles["DRIVER"].id))
            db.flush()

        print("🌱 Seeding Supplier 1 (Approved - Venky's)...")
        supp1_user = db.query(User).filter(User.email == "supplier1@thechickenman.com").first()
        if not supp1_user:
            supp1_user = User(
                email="supplier1@thechickenman.com",
                phone_number="+919900000002",
                password_hash=default_pw,
                full_name="Venkateshwara Hatcheries Hub",
                is_active=True
            )
            db.add(supp1_user)
            db.flush()
            db.add(UserRole(user_id=supp1_user.id, role_id=roles["SUPPLIER"].id))
            db.flush()

            supplier1 = Supplier(
                user_id=supp1_user.id,
                business_name="Venky's Commercial Poultry Ltd",
                trade_name="Venky's Fresh",
                kyc_status="APPROVED",
                status="ACTIVE"
            )
            db.add(supplier1)
            db.flush()

            supp1_kyc = SupplierKYC(
                supplier_id=supplier1.id,
                gstin="29AAAAA0000A1Z5",
                pan="AAAAA0000A",
                fssai_license_number="11223344556677",
                bank_account_name="Venky's Commercial Poultry Ltd",
                bank_account_number="9876543210123",
                bank_ifsc="HDFC0001234",
                bank_name="HDFC Bank Indiranagar",
                status="APPROVED",
                verified_by=admin_user.id,
                verified_at=datetime.now(timezone.utc)
            )
            db.add(supp1_kyc)

            supp1_loc = SupplierLocation(
                supplier_id=supplier1.id,
                name="Venky's Central Processing Plant",
                type="PLANT",
                address_line1="Plot 45, Hoskote Industrial Area",
                city="Bangalore",
                state="Karnataka",
                pincode="560038",
                serviceable_pincodes=["560038", "560001", "560002", "560025", "560034", "560068"],
                is_active=True
            )
            db.add(supp1_loc)
            db.flush()
        else:
            supplier1 = db.query(Supplier).filter(Supplier.user_id == supp1_user.id).first()
            supp1_loc = db.query(SupplierLocation).filter(SupplierLocation.supplier_id == supplier1.id).first()

        print("🌱 Seeding Supplier 2 (Pending KYC - Suguna)...")
        supp2_user = db.query(User).filter(User.email == "supplier2@thechickenman.com").first()
        if not supp2_user:
            supp2_user = User(
                email="supplier2@thechickenman.com",
                phone_number="+919900000003",
                password_hash=default_pw,
                full_name="Suguna Foods Ltd",
                is_active=True
            )
            db.add(supp2_user)
            db.flush()
            db.add(UserRole(user_id=supp2_user.id, role_id=roles["SUPPLIER"].id))
            db.flush()

            supplier2 = Supplier(
                user_id=supp2_user.id,
                business_name="Suguna Poultry Farms Ltd",
                trade_name="Suguna Pure",
                kyc_status="PENDING",
                status="ACTIVE"
            )
            db.add(supplier2)
            db.flush()

            supp2_kyc = SupplierKYC(
                supplier_id=supplier2.id,
                gstin="29BBBBB1111B1Z8",
                pan="BBBBB1111B",
                fssai_license_number="11556677889900",
                bank_account_name="Suguna Poultry Farms",
                bank_account_number="123456789012",
                bank_ifsc="ICIC0000543",
                bank_name="ICICI Bank",
                status="PENDING"
            )
            db.add(supp2_kyc)
            db.flush()

        print("🌱 Seeding Buyer 1 (Approved QSR - Biryani Blues)...")
        buyer1_user = db.query(User).filter(User.email == "buyer1@thechickenman.com").first()
        if not buyer1_user:
            buyer1_user = User(
                email="buyer1@thechickenman.com",
                phone_number="+919900000004",
                password_hash=default_pw,
                full_name="Biryani Blues QSR Kitchens",
                is_active=True
            )
            db.add(buyer1_user)
            db.flush()
            db.add(UserRole(user_id=buyer1_user.id, role_id=roles["BUYER"].id))
            db.flush()

            buyer1 = Buyer(
                user_id=buyer1_user.id,
                business_name="Biryani Blues Foodworks Pvt Ltd",
                buyer_type="QSR",
                kyc_status="APPROVED",
                status="ACTIVE"
            )
            db.add(buyer1)
            db.flush()

            db.add(Cart(buyer_id=buyer1.id))

            buyer1_kyc = BuyerKYC(
                buyer_id=buyer1.id,
                gstin="29CCCCC2222C1Z2",
                pan="CCCCC2222C",
                fssai_license_number="11889900112233",
                status="APPROVED",
                verified_by=admin_user.id,
                verified_at=datetime.now(timezone.utc)
            )
            db.add(buyer1_kyc)

            buyer1_loc = BuyerLocation(
                buyer_id=buyer1.id,
                name="Biryani Blues - Indiranagar Central Kitchen",
                address_line1="100 Feet Road, HAL 2nd Stage",
                city="Bangalore",
                state="Karnataka",
                pincode="560038",
                operating_hours="06:00 - 15:00",
                is_primary=True,
                is_verified=True
            )
            db.add(buyer1_loc)
            db.flush()
        else:
            buyer1 = db.query(Buyer).filter(Buyer.user_id == buyer1_user.id).first()
            buyer1_loc = db.query(BuyerLocation).filter(BuyerLocation.buyer_id == buyer1.id).first()

        print("🌱 Seeding Buyer 2 (Approved Hotel - ITC Grand)...")
        buyer2_user = db.query(User).filter(User.email == "buyer2@thechickenman.com").first()
        if not buyer2_user:
            buyer2_user = User(
                email="buyer2@thechickenman.com",
                phone_number="+919900000005",
                password_hash=default_pw,
                full_name="ITC Grand Hospitality",
                is_active=True
            )
            db.add(buyer2_user)
            db.flush()
            db.add(UserRole(user_id=buyer2_user.id, role_id=roles["BUYER"].id))
            db.flush()

            buyer2 = Buyer(
                user_id=buyer2_user.id,
                business_name="ITC Grand Luxury Hotels Ltd",
                buyer_type="HOTEL",
                kyc_status="APPROVED",
                status="ACTIVE"
            )
            db.add(buyer2)
            db.flush()
            db.add(Cart(buyer_id=buyer2.id))

            buyer2_kyc = BuyerKYC(
                buyer_id=buyer2.id,
                gstin="29DDDDD3333D1Z9",
                pan="DDDDD3333D",
                fssai_license_number="11778899223344",
                status="APPROVED",
                verified_by=admin_user.id,
                verified_at=datetime.now(timezone.utc)
            )
            db.add(buyer2_kyc)

            buyer2_loc = BuyerLocation(
                buyer_id=buyer2.id,
                name="ITC Hotel Main Receiving Bay",
                address_line1="1 Residency Road",
                city="Bangalore",
                state="Karnataka",
                pincode="560025",
                operating_hours="04:00 - 12:00",
                is_primary=True,
                is_verified=True
            )
            db.add(buyer2_loc)
            db.flush()

        print("🌱 Seeding Buyer 3 (Pending KYC - FreshMart)...")
        buyer3_user = db.query(User).filter(User.email == "buyer3@thechickenman.com").first()
        if not buyer3_user:
            buyer3_user = User(
                email="buyer3@thechickenman.com",
                phone_number="+919900000006",
                password_hash=default_pw,
                full_name="FreshMart Supermarkets",
                is_active=True
            )
            db.add(buyer3_user)
            db.flush()
            db.add(UserRole(user_id=buyer3_user.id, role_id=roles["BUYER"].id))
            db.flush()

            buyer3 = Buyer(
                user_id=buyer3_user.id,
                business_name="FreshMart Retail India Ltd",
                buyer_type="RETAILER",
                kyc_status="PENDING",
                status="ACTIVE"
            )
            db.add(buyer3)
            db.flush()
            db.add(Cart(buyer_id=buyer3.id))
            db.flush()

        print("🌱 Seeding Master Chicken SKUs...")
        skus = [
            {
                "sku_code": "CHK-WHL-FRS-A",
                "name": "Whole Broiler Chicken (Dressed)",
                "product_type": "WHOLE",
                "condition": "FRESH",
                "grade": "GRADE_A",
                "standard_pack_size_kg": Decimal("1.20"),
                "description": "Premium whole dressed broiler chicken, eviscerated, chilled without giblets."
            },
            {
                "sku_code": "CHK-BNL-FRS-A",
                "name": "Chicken Breast Fillet Boneless",
                "product_type": "BONELESS",
                "condition": "FRESH",
                "grade": "GRADE_A",
                "standard_pack_size_kg": Decimal("1.00"),
                "description": "Trimmed, skinless, boneless chicken breast fillets for restaurants and QSRs."
            },
            {
                "sku_code": "CHK-CUT-FRS-A",
                "name": "Chicken Curry Cut (Skin On)",
                "product_type": "CUTS",
                "condition": "FRESH",
                "grade": "GRADE_A",
                "standard_pack_size_kg": Decimal("1.00"),
                "description": "Standard 16-18 piece curry cut with skin, bone-in."
            },
            {
                "sku_code": "CHK-DRM-FRZ-A",
                "name": "Chicken Drumsticks (IQF Frozen)",
                "product_type": "CUTS",
                "condition": "FROZEN",
                "grade": "GRADE_A",
                "standard_pack_size_kg": Decimal("2.00"),
                "description": "Individually Quick Frozen prime chicken drumsticks."
            }
        ]

        products = {}
        for s in skus:
            prod = db.query(Product).filter(Product.sku_code == s["sku_code"]).first()
            if not prod:
                prod = Product(
                    sku_code=s["sku_code"],
                    name=s["name"],
                    product_type=s["product_type"],
                    condition=s["condition"],
                    grade=s["grade"],
                    standard_pack_size_kg=s["standard_pack_size_kg"],
                    description=s["description"],
                    is_active=True
                )
                db.add(prod)
                db.flush()
            products[s["sku_code"]] = prod

        print("🌱 Seeding Supplier Listings & Prices...")
        listings = [
            ("CHK-WHL-FRS-A", Decimal("160.00"), Decimal("20.00")),
            ("CHK-BNL-FRS-A", Decimal("260.00"), Decimal("15.00")),
            ("CHK-CUT-FRS-A", Decimal("180.00"), Decimal("20.00")),
            ("CHK-DRM-FRZ-A", Decimal("210.00"), Decimal("10.00")),
        ]

        supplier_listings = {}
        for sku_code, price_kg, moq_kg in listings:
            prod = products[sku_code]
            sp = db.query(SupplierProduct).filter(
                SupplierProduct.supplier_id == supplier1.id,
                SupplierProduct.product_id == prod.id
            ).first()
            if not sp:
                sp = SupplierProduct(
                    supplier_id=supplier1.id,
                    product_id=prod.id,
                    supplier_sku_code=f"VENKY-{sku_code}",
                    base_price_per_kg=price_kg,
                    moq_kg=moq_kg,
                    lead_time_hours=12,
                    pack_size_kg=Decimal("1.00"),
                    is_available=True,
                    serviceable_pincodes=["560038", "560001", "560002", "560025", "560034", "560068"]
                )
                db.add(sp)
                db.flush()

                p = Price(
                    supplier_product_id=sp.id,
                    price_per_kg=price_kg,
                    moq_kg=moq_kg,
                    buyer_segment="ALL",
                    version=1,
                    created_by=supp1_user.id
                )
                db.add(p)
                db.flush()
            supplier_listings[sku_code] = sp

        print("🌱 Seeding Batches & Stock In...")
        today = date.today()
        batch1 = db.query(InventoryBatch).filter(InventoryBatch.batch_number == "BAT-2026-09-01").first()
        if not batch1:
            batch1 = InventoryBatch(
                supplier_id=supplier1.id,
                batch_number="BAT-2026-09-01",
                production_date=today - timedelta(days=1),
                expiry_date=today + timedelta(days=4),
                storage_condition="FRESH"
            )
            db.add(batch1)
            db.flush()

        batch2 = db.query(InventoryBatch).filter(InventoryBatch.batch_number == "BAT-2026-09-02").first()
        if not batch2:
            batch2 = InventoryBatch(
                supplier_id=supplier1.id,
                batch_number="BAT-2026-09-02",
                production_date=today - timedelta(days=1),
                expiry_date=today + timedelta(days=5),
                storage_condition="CHILLED"
            )
            db.add(batch2)
            db.flush()

        # Add initial inventory
        add_stock(
            db=db,
            supplier_id=supplier1.id,
            location_id=supp1_loc.id,
            product_id=products["CHK-WHL-FRS-A"].id,
            quantity_kg=Decimal("500.00"),
            batch_id=batch1.id,
            actor_id=supp1_user.id,
            notes="Initial Morning Slaughter Stock"
        )

        add_stock(
            db=db,
            supplier_id=supplier1.id,
            location_id=supp1_loc.id,
            product_id=products["CHK-BNL-FRS-A"].id,
            quantity_kg=Decimal("300.00"),
            batch_id=batch2.id,
            actor_id=supp1_user.id,
            notes="Initial Boneless Breast Stock"
        )

        add_stock(
            db=db,
            supplier_id=supplier1.id,
            location_id=supp1_loc.id,
            product_id=products["CHK-CUT-FRS-A"].id,
            quantity_kg=Decimal("400.00"),
            batch_id=batch1.id,
            actor_id=supp1_user.id,
            notes="Initial Curry Cut Stock"
        )

        print("🌱 Seeding Completed Delivered Order for Historical Reporting...")
        existing_sample_order = db.query(Order).filter(Order.order_number == "ORD-2026-00001").first()
        if not existing_sample_order:
            subtotal = Decimal("8000.00")  # 50kg @ 160
            tax = Decimal("400.00")
            del_fee = Decimal("150.00")
            total = subtotal + tax + del_fee

            sample_order = Order(
                order_number="ORD-2026-00001",
                buyer_id=buyer1.id,
                supplier_id=supplier1.id,
                supplier_location_id=supp1_loc.id,
                delivery_location_id=buyer1_loc.id,
                status="DELIVERED",
                subtotal_amount=subtotal,
                tax_amount=tax,
                delivery_fee=del_fee,
                total_amount=total,
                payment_terms="ADVANCE"
            )
            db.add(sample_order)
            db.flush()

            order_item = OrderItem(
                order_id=sample_order.id,
                product_id=products["CHK-WHL-FRS-A"].id,
                supplier_product_id=supplier_listings["CHK-WHL-FRS-A"].id,
                batch_id=batch1.id,
                quantity_kg=Decimal("50.00"),
                unit_price_per_kg=Decimal("160.00"),
                tax_rate_percent=Decimal("5.00"),
                tax_amount=tax,
                total_price=subtotal + tax
            )
            db.add(order_item)

            db.add(OrderStatusHistory(
                order_id=sample_order.id,
                previous_status="DISPATCHED",
                new_status="DELIVERED",
                changed_by_user_id=driver_user.id,
                reason="Successfully delivered with OTP verification"
            ))

            payment = Payment(
                order_id=sample_order.id,
                payment_provider="MOCK",
                provider_transaction_id="mock_tx_delivered_sample_01",
                provider_order_id="mock_ord_delivered_sample_01",
                amount=total,
                currency="INR",
                status="SUCCESS",
                idempotency_key="idemp_seed_sample_delivered_order_01",
                payment_method="ONLINE"
            )
            db.add(payment)
            db.flush()

            delivery = Delivery(
                order_id=sample_order.id,
                driver_user_id=driver_user.id,
                vehicle_number="KA-01-EQ-5592",
                status="DELIVERED",
                assigned_at=datetime.now(timezone.utc) - timedelta(hours=4),
                delivered_at=datetime.now(timezone.utc) - timedelta(hours=1)
            )
            db.add(delivery)
            db.flush()

            pod = ProofOfDelivery(
                delivery_id=delivery.id,
                pod_type="OTP",
                otp_code_verified=True,
                recipient_name="Manager Biryani Blues Indiranagar",
                signature_url="data:image/svg+xml;utf8,<svg>sig</svg>",
                quantity_accepted_kg=Decimal("50.00"),
                driver_id=driver_user.id
            )
            db.add(pod)
            db.flush()

            generate_invoice_for_order(db, sample_order)

        db.commit()
        print("✅ Seeding completed successfully!")
        print("--------------------------------------------------")
        print("Admin:    admin@thechickenman.com      / Password@123")
        print("Supplier: supplier1@thechickenman.com  / Password@123 (Approved)")
        print("Supplier: supplier2@thechickenman.com  / Password@123 (Pending KYC)")
        print("Buyer:    buyer1@thechickenman.com     / Password@123 (Approved)")
        print("Buyer:    buyer2@thechickenman.com     / Password@123 (Approved)")
        print("Buyer:    buyer3@thechickenman.com     / Password@123 (Pending KYC)")
        print("Driver:   driver@thechickenman.com     / Password@123")
        print("--------------------------------------------------")

    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed()
