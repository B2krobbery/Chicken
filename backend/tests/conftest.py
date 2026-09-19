import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import SessionLocal, engine
from app.models.user import User, Role
from app.models.supplier import Supplier
from app.models.buyer import Buyer
from app.core.security import create_access_token

@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def admin_token(db_session: Session):
    admin = db_session.query(User).filter(User.email == "admin@thechickenman.com").first()
    return create_access_token(subject=admin.id, roles=["ADMIN"])

@pytest.fixture
def supplier1_token(db_session: Session):
    user = db_session.query(User).filter(User.email == "supplier1@thechickenman.com").first()
    supplier = db_session.query(Supplier).filter(Supplier.user_id == user.id).first()
    return create_access_token(subject=user.id, roles=["SUPPLIER"], extra_claims={"profile_id": str(supplier.id)})

@pytest.fixture
def buyer1_token(db_session: Session):
    user = db_session.query(User).filter(User.email == "buyer1@thechickenman.com").first()
    buyer = db_session.query(Buyer).filter(Buyer.user_id == user.id).first()
    return create_access_token(subject=user.id, roles=["BUYER"], extra_claims={"profile_id": str(buyer.id)})

@pytest.fixture
def driver_token(db_session: Session):
    user = db_session.query(User).filter(User.email == "driver@thechickenman.com").first()
    return create_access_token(subject=user.id, roles=["DRIVER"])
