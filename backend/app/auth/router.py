from typing import Optional
import secrets
import httpx
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.user import User, Role, UserRole
from app.models.supplier import Supplier
from app.models.buyer import Buyer
from app.models.cart import Cart
from app.audit.service import log_audit_event
from app.auth.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication & Identity"])

class GoogleAuthRequest(BaseModel):
    credential: str
    role: Optional[str] = "BUYER"
    business_name: Optional[str] = None
    buyer_type: Optional[str] = "RESTAURANT"

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
    role_name = req.role.strip().upper()
    if role_name not in ["BUYER", "SUPPLIER"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Public self-registration is only permitted for BUYER and SUPPLIER roles. Admin and Driver accounts are provisioned by operations."
        )

    clean_email = req.email.strip().lower()
    clean_phone = req.phone_number.strip()
    clean_name = req.full_name.strip()

    if len(req.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters in length"
        )

    # Validate role
    role_obj = db.query(Role).filter(Role.name == role_name).first()
    if not role_obj:
        # Create default roles if not yet seeded
        role_obj = Role(name=role_name, description=f"{role_name} role")
        db.add(role_obj)
        db.flush()

    # Check duplicate email
    if db.query(User).filter(User.email == clean_email).first():
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Check duplicate phone
    if db.query(User).filter(User.phone_number == clean_phone).first():
        raise HTTPException(status_code=400, detail="User with this phone number already exists")

    hashed_pw = get_password_hash(req.password)
    user = User(
        email=clean_email,
        phone_number=clean_phone,
        password_hash=hashed_pw,
        full_name=clean_name,
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
        biz_name = (req.business_name or f"{clean_name}'s Poultry").strip()
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
        biz_name = (req.business_name or f"{clean_name}'s Business").strip()
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
    clean_email = req.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()
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

async def verify_google_token(credential: str) -> dict:
    """
    Verifies the Google ID token using Google's tokeninfo API endpoint.
    Returns verified payload dict with email, name, sub, etc.
    """
    if settings.ENVIRONMENT != "production" and (
        credential.startswith("mock_google_") or credential.startswith("test_google_")
    ):
        return {
            "email": "demo.google.partner@thechickenman.com",
            "name": "Google Verified Partner",
            "sub": "mock_google_user_sub_9999",
        }

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": credential}
            )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired Google authentication token"
                )
            data = resp.json()
            if not data.get("email"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Google account must have an associated verified email"
                )
            if settings.GOOGLE_CLIENT_ID and data.get("aud") != settings.GOOGLE_CLIENT_ID:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Google token audience does not match configured GOOGLE_CLIENT_ID"
                )
            return data
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Unable to contact Google authentication service: {str(exc)}"
            )

@router.post("/google", response_model=TokenResponse)
async def google_auth(req: GoogleAuthRequest, request: Request, db: Session = Depends(get_db)):
    google_data = await verify_google_token(req.credential)
    email = google_data["email"].strip().lower()
    full_name = google_data.get("name") or google_data.get("given_name") or email.split("@")[0]

    # Check if user already exists
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # Auto-provision new user via Google
        target_role = (req.role or "BUYER").strip().upper()
        if target_role not in ["BUYER", "SUPPLIER"]:
            target_role = "BUYER"

        role_obj = db.query(Role).filter(Role.name == target_role).first()
        if not role_obj:
            role_obj = Role(name=target_role, description=f"{target_role} role")
            db.add(role_obj)
            db.flush()

        random_pw = secrets.token_urlsafe(32)
        hashed_pw = get_password_hash(random_pw)

        user = User(
            email=email,
            phone_number=f"+91{secrets.randbelow(9000000000) + 1000000000}",  # Placeholder until KYC
            password_hash=hashed_pw,
            full_name=full_name,
            is_active=True
        )
        db.add(user)
        db.flush()

        db.add(UserRole(user_id=user.id, role_id=role_obj.id))
        db.flush()

        profile_id = None
        kyc_status = "PENDING"

        if target_role == "SUPPLIER":
            biz_name = (req.business_name or f"{full_name}'s Poultry").strip()
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
        else:
            biz_name = (req.business_name or f"{full_name}'s Kitchen").strip()
            buyer = Buyer(
                user_id=user.id,
                business_name=biz_name,
                buyer_type=req.buyer_type or "RESTAURANT",
                kyc_status="PENDING",
                status="ACTIVE"
            )
            db.add(buyer)
            db.flush()
            cart = Cart(buyer_id=buyer.id)
            db.add(cart)
            db.flush()
            profile_id = str(buyer.id)

        log_audit_event(
            db=db,
            action="USER_REGISTER_GOOGLE",
            entity_type="USER",
            entity_id=str(user.id),
            actor_id=user.id,
            new_values={"email": user.email, "role": target_role, "provider": "GOOGLE"},
            ip_address=request.client.host if request.client else None
        )
        db.commit()

        token = create_access_token(
            subject=user.id,
            roles=[target_role],
            extra_claims={"profile_id": profile_id}
        )

        return TokenResponse(
            access_token=token,
            user_id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            roles=[target_role],
            profile_id=profile_id,
            kyc_status=kyc_status
        )

    # Existing user logging in with Google
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
        action="USER_LOGIN_GOOGLE",
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
