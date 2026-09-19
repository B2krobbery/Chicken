import uuid
import concurrent.futures
from decimal import Decimal
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.user import User
from app.models.supplier import Supplier, SupplierLocation
from app.models.buyer import Buyer, BuyerLocation
from app.models.catalogue import Product, SupplierProduct
from app.models.inventory import Inventory, InventoryBatch
from app.models.order import Order
from app.inventory.service import add_stock, reserve_stock
from app.core.exceptions import InsufficientStockException

def test_inventory_concurrency_pessimistic_locking():
    """
    Stress test: Simulates concurrent threads competing for finite inventory.
    PostgreSQL SELECT ... FOR UPDATE ensures race conditions cannot oversell available inventory.
    """
    db = SessionLocal()
    unique = uuid.uuid4().hex[:6]

    supplier = db.query(Supplier).filter(Supplier.kyc_status == "APPROVED").first()
    supp_loc = db.query(SupplierLocation).filter(SupplierLocation.supplier_id == supplier.id).first()
    
    # Create isolated test product
    prod = Product(
        sku_code=f"CHK-TEST-CONC-{unique}",
        name="Concurrency Test Broiler",
        product_type="WHOLE",
        condition="FRESH",
        grade="GRADE_A",
        standard_pack_size_kg=Decimal("1.00"),
        is_active=True
    )
    db.add(prod)
    db.flush()

    # Add exactly 60.00 kg of stock
    inv = add_stock(
        db=db,
        supplier_id=supplier.id,
        location_id=supp_loc.id,
        product_id=prod.id,
        quantity_kg=Decimal("60.00"),
        actor_id=supplier.user_id,
        notes="Concurrency test initial stock"
    )
    db.commit()
    prod_id = prod.id
    supplier_id = supplier.id
    supp_loc_id = supp_loc.id
    db.close()

    # Function executed by worker threads
    def attempt_reservation(thread_idx: int):
        thread_db = SessionLocal()
        order_mock_id = uuid.uuid4()
        requested_qty = Decimal("20.00")
        success = False
        try:
            # Start transaction and attempt reserve_stock with row lock
            reserve_stock(
                db=thread_db,
                supplier_id=supplier_id,
                location_id=supp_loc_id,
                product_id=prod_id,
                requested_kg=requested_qty,
                order_id=order_mock_id,
                actor_id=None
            )
            thread_db.commit()
            success = True
        except InsufficientStockException:
            thread_db.rollback()
            success = False
        except Exception as e:
            thread_db.rollback()
            success = False
        finally:
            thread_db.close()
        return success

    # Launch 6 concurrent attempts for 20kg each (Total demanded = 120kg, available = 60kg)
    # Exactly 3 should succeed, 3 should fail!
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(attempt_reservation, i) for i in range(6)]
        results = [f.result() for f in futures]

    successes = [r for r in results if r is True]
    failures = [r for r in results if r is False]

    # Assertions
    assert len(successes) == 3, f"Expected exactly 3 reservations to succeed, got {len(successes)}"
    assert len(failures) == 3, f"Expected exactly 3 reservations to fail with insufficient stock, got {len(failures)}"

    # Check final database state
    verify_db = SessionLocal()
    final_inv = verify_db.query(Inventory).filter(
        Inventory.supplier_id == supplier_id,
        Inventory.supplier_location_id == supp_loc_id,
        Inventory.product_id == prod_id
    ).first()

    assert final_inv.quantity_available_kg == Decimal("0.00"), f"Expected 0 available, got {final_inv.quantity_available_kg}"
    assert final_inv.quantity_reserved_kg == Decimal("60.00"), f"Expected 60 reserved, got {final_inv.quantity_reserved_kg}"
    verify_db.close()
