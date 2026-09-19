from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.buyer import Buyer, BuyerKYC, BuyerLocation, BuyerContact, BuyerDocument
from app.auth.deps import get_current_user, get_current_buyer
from app.audit.service import log_audit_event

router = APIRouter(prefix="/buyers", tags=["Buyers"])

class BuyerKYCSubmitRequest(BaseModel):
    pan: str = Field(..., min_length=10, max_length=10)
    fssai_license_number: str = Field(..., min_length=14, max_length=14)
    gstin: Optional[str] = Field(None, min_length=15, max_length=15)

class BuyerLocationCreateRequest(BaseModel):
    name: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    pincode: str
    operating_hours: Optional[str] = "08:00 - 18:00"
    is_primary: bool = False

@router.get("/profile")
def get_buyer_profile(
    buyer: Buyer = Depends(get_current_buyer),
    db: Session = Depends(get_db)
):
    kyc_data = None
    if buyer.kyc:
        kyc_data = {
            "pan": buyer.kyc.pan,
            "fssai_license_number": buyer.kyc.fssai_license_number,
            "gstin": buyer.kyc.gstin,
            "status": buyer.kyc.status,
            "rejection_reason": buyer.kyc.rejection_reason,
            "verified_at": buyer.kyc.verified_at.isoformat() if buyer.kyc.verified_at else None
        }

    return {
        "id": str(buyer.id),
        "user_id": str(buyer.user_id),
        "business_name": buyer.business_name,
        "buyer_type": buyer.buyer_type,
        "kyc_status": buyer.kyc_status,
        "status": buyer.status,
        "kyc": kyc_data,
        "locations_count": len(buyer.locations),
        "created_at": buyer.created_at.isoformat()
    }

@router.post("/kyc")
def submit_buyer_kyc(
    req: BuyerKYCSubmitRequest,
    request: Request,
    buyer: Buyer = Depends(get_current_buyer),
    db: Session = Depends(get_db)
):
    kyc = buyer.kyc
    if not kyc:
        kyc = BuyerKYC(
            buyer_id=buyer.id,
            pan=req.pan.upper(),
            fssai_license_number=req.fssai_license_number,
            gstin=req.gstin.upper() if req.gstin else None,
            status="PENDING"
        )
        db.add(kyc)
    else:
        kyc.pan = req.pan.upper()
        kyc.fssai_license_number = req.fssai_license_number
        kyc.gstin = req.gstin.upper() if req.gstin else None
        kyc.status = "PENDING"
        kyc.rejection_reason = None

    buyer.kyc_status = "PENDING"

    log_audit_event(
        db=db,
        action="BUYER_KYC_SUBMIT",
        entity_type="BUYER_KYC",
        entity_id=str(buyer.id),
        actor_id=buyer.user_id,
        new_values={
            "pan": req.pan.upper(),
            "fssai": req.fssai_license_number,
            "gstin": req.gstin.upper() if req.gstin else None,
            "status": "PENDING"
        },
        ip_address=request.client.host if request.client else None
    )

    db.commit()
    db.refresh(buyer)

    return {
        "message": "Buyer KYC submitted successfully and is pending Admin review",
        "kyc_status": buyer.kyc_status
    }

@router.get("/locations")
def list_buyer_locations(
    buyer: Buyer = Depends(get_current_buyer),
    db: Session = Depends(get_db)
):
    locs = db.query(BuyerLocation).filter(BuyerLocation.buyer_id == buyer.id).all()
    return [
        {
            "id": str(l.id),
            "name": l.name,
            "address_line1": l.address_line1,
            "address_line2": l.address_line2,
            "city": l.city,
            "state": l.state,
            "pincode": l.pincode,
            "operating_hours": l.operating_hours,
            "is_primary": l.is_primary,
            "is_verified": l.is_verified
        }
        for l in locs
    ]

@router.post("/locations", status_code=status.HTTP_201_CREATED)
def add_buyer_location(
    req: BuyerLocationCreateRequest,
    buyer: Buyer = Depends(get_current_buyer),
    db: Session = Depends(get_db)
):
    loc = BuyerLocation(
        buyer_id=buyer.id,
        name=req.name,
        address_line1=req.address_line1,
        address_line2=req.address_line2,
        city=req.city,
        state=req.state,
        pincode=req.pincode,
        operating_hours=req.operating_hours,
        is_primary=req.is_primary,
        is_verified=True
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return {
        "id": str(loc.id),
        "name": loc.name,
        "city": loc.city,
        "pincode": loc.pincode
    }
