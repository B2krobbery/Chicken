from typing import Generator, List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.exceptions import AppException, UnauthorizedRoleException, KYCPendingException
from app.models.user import User
from app.models.supplier import Supplier
from app.models.buyer import Buyer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload["sub"]
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account deactivated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def require_roles(allowed_roles: List[str]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_roles = [r.name for r in current_user.roles]
        if not any(role in user_roles for role in allowed_roles):
            raise UnauthorizedRoleException(
                f"Action requires one of the following roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker

def get_current_supplier(
    current_user: User = Depends(require_roles(["SUPPLIER", "ADMIN"])),
    db: Session = Depends(get_db)
) -> Supplier:
    supplier = db.query(Supplier).filter(Supplier.user_id == current_user.id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier profile not found for this user account"
        )
    return supplier

def require_approved_supplier(
    supplier: Supplier = Depends(get_current_supplier)
) -> Supplier:
    if supplier.kyc_status != "APPROVED":
        raise KYCPendingException(
            f"Supplier KYC status is '{supplier.kyc_status}'. KYC approval is required to sell products."
        )
    return supplier

def get_current_buyer(
    current_user: User = Depends(require_roles(["BUYER", "ADMIN"])),
    db: Session = Depends(get_db)
) -> Buyer:
    buyer = db.query(Buyer).filter(Buyer.user_id == current_user.id).first()
    if not buyer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Buyer profile not found for this user account"
        )
    return buyer

def require_approved_buyer(
    buyer: Buyer = Depends(get_current_buyer)
) -> Buyer:
    if buyer.kyc_status != "APPROVED":
        raise KYCPendingException(
            f"Buyer KYC status is '{buyer.kyc_status}'. KYC approval is required to place orders."
        )
    return buyer
