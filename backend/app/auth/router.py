from typing import Optional
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.user import User, Role, UserRole
from app.models.supplier import Supplier
from app.models.buyer import Buyer
from app.models.cart import Cart
from app.audit.service import log_audit_event
from app.auth.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication & Identity"])

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone_number: str
    role: str  # ADMIN, SUPPLIER, BUYER, DRIVER
    business_name: Optional[str] = None  # For supplier/buyer
    buyer_type: Optional[str] = "RESTAURANT"

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    full_name: str
    roles: list[str]
    profile_id: Optional[str] = None
    kyc_status: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    phone_number: str
    roles: list[str]
    is_active: bool
    supplier_id: Optional[str] = None
    buyer_id: Optional[str] = None
    kyc_status: Optional[str] = None

@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=TokenResponse)
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    # Validate role
    role_obj = db.query(Role).filter(Role.name == req.role.upper()).first()
    if not role_obj:
        # Create default roles if not yet seeded
        role_obj = Role(name=req.role.upper(), description=f"{req.role.upper()} role")
        db.add(role_obj)
        db.flush()

    # Check duplicate email
    if db.query(User).filter(User.email == req.email.lower()).first():
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Check duplicate phone
    if db.query(User).filter(User.phone_number == req.phone_number).first():
        raise HTTPException(status_code=400, detail="User with this phone number already exists")

    hashed_pw = get_password_hash(req.password)
    user = User(
        email=req.email.lower(),
        phone_number=req.phone_number,
        password_hash=hashed_pw,
        full_name=req.full_name,
        is_active=True
    )
    db.add(user)
    db.flush()

    # Associate role
    user_role = UserRole(user_id=user.id, role_id=role_obj.id)
    db.add(user_role)
    db.flush()

    profile_id = None
    kyc_status = None

    # Automatically create profile for Supplier or Buyer
    if role_obj.name == "SUPPLIER":
        biz_name = req.business_name or f"{req.full_name}'s Poultry"
        supplier = Supplier(
            user_id=user.id,
            business_name=biz_name,
            trade_name=biz_name,
            kyc_status="PENDING",
            status="ACTIVE"
        )
        db.add(supplier)
        db.flush()
        profile_id = str(supplier.id)
        kyc_status = supplier.kyc_status
    elif role_obj.name == "BUYER":
        biz_name = req.business_name or f"{req.full_name}'s Business"
        buyer = Buyer(
            user_id=user.id,
            business_name=biz_name,
            buyer_type=req.buyer_type or "RESTAURANT",
            kyc_status="PENDING",
            status="ACTIVE"
        )
        db.add(buyer)
        db.flush()
        # Initialize empty cart for buyer
        cart = Cart(buyer_id=buyer.id)
        db.add(cart)
        db.flush()
        profile_id = str(buyer.id)
        kyc_status = buyer.kyc_status

    # Audit log
    log_audit_event(
        db=db,
        action="USER_REGISTER",
        entity_type="USER",
        entity_id=str(user.id),
        actor_id=user.id,
        new_values={"email": user.email, "role": role_obj.name, "profile_id": profile_id},
        ip_address=request.client.host if request.client else None
    )

    db.commit()

    token = create_access_token(
        subject=user.id,
        roles=[role_obj.name],
        extra_claims={"profile_id": profile_id}
    )

    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        roles=[role_obj.name],
        profile_id=profile_id,
        kyc_status=kyc_status
    )

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is deactivated")

    roles = [r.name for r in user.roles]
    profile_id = None
    kyc_status = None

    if "SUPPLIER" in roles and user.supplier:
        profile_id = str(user.supplier.id)
        kyc_status = user.supplier.kyc_status
    elif "BUYER" in roles and user.buyer:
        profile_id = str(user.buyer.id)
        kyc_status = user.buyer.kyc_status

    token = create_access_token(
        subject=user.id,
        roles=roles,
        extra_claims={"profile_id": profile_id}
    )

    log_audit_event(
        db=db,
        action="USER_LOGIN",
        entity_type="USER",
        entity_id=str(user.id),
        actor_id=user.id,
        ip_address=request.client.host if request.client else None
    )
    db.commit()

    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        roles=roles,
        profile_id=profile_id,
        kyc_status=kyc_status
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    roles = [r.name for r in current_user.roles]
    supplier_id = str(current_user.supplier.id) if current_user.supplier else None
    buyer_id = str(current_user.buyer.id) if current_user.buyer else None
    kyc_status = None
    if current_user.supplier:
        kyc_status = current_user.supplier.kyc_status
    elif current_user.buyer:
        kyc_status = current_user.buyer.kyc_status

    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        phone_number=current_user.phone_number,
        roles=roles,
        is_active=current_user.is_active,
        supplier_id=supplier_id,
        buyer_id=buyer_id,
        kyc_status=kyc_status
    )
