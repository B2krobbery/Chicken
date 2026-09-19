from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.supplier import Supplier, SupplierKYC, SupplierLocation, SupplierContact, SupplierDocument
from app.models.user import User
from app.auth.deps import get_current_user, get_current_supplier, require_roles
from app.audit.service import log_audit_event

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])

class SupplierKYCSubmitRequest(BaseModel):
    gstin: str = Field(..., min_length=15, max_length=15)
    pan: str = Field(..., min_length=10, max_length=10)
    fssai_license_number: str = Field(..., min_length=14, max_length=14)
    bank_account_name: str
    bank_account_number: str
    bank_ifsc: str
    bank_name: str

class LocationCreateRequest(BaseModel):
    name: str
    type: str = "WAREHOUSE"  # PLANT, WAREHOUSE, DISPATCH_POINT
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    pincode: str
    serviceable_pincodes: List[str] = []

class ContactCreateRequest(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    designation: Optional[str] = None
    is_primary: bool = False

class DocumentCreateRequest(BaseModel):
    document_type: str  # GST_CERTIFICATE, FSSAI_LICENSE, PAN_CARD, CANCELLED_CHEQUE, OTHER
    file_path: str
    file_name: str
    mime_type: str = "application/pdf"
    file_size: Optional[int] = 0

@router.get("/profile")
def get_supplier_profile(
    supplier: Supplier = Depends(get_current_supplier),
    db: Session = Depends(get_db)
):
    kyc_data = None
    if supplier.kyc:
        kyc_data = {
            "gstin": supplier.kyc.gstin,
            "pan": supplier.kyc.pan,
            "fssai_license_number": supplier.kyc.fssai_license_number,
            "bank_account_name": supplier.kyc.bank_account_name,
            "bank_account_number": supplier.kyc.bank_account_number,
            "bank_ifsc": supplier.kyc.bank_ifsc,
            "bank_name": supplier.kyc.bank_name,
            "status": supplier.kyc.status,
            "rejection_reason": supplier.kyc.rejection_reason,
            "verified_at": supplier.kyc.verified_at.isoformat() if supplier.kyc.verified_at else None
        }

    return {
        "id": str(supplier.id),
        "user_id": str(supplier.user_id),
        "business_name": supplier.business_name,
        "trade_name": supplier.trade_name,
        "kyc_status": supplier.kyc_status,
        "status": supplier.status,
        "kyc": kyc_data,
        "locations_count": len(supplier.locations),
        "documents_count": len(supplier.documents),
        "created_at": supplier.created_at.isoformat()
    }

@router.post("/kyc")
def submit_kyc(
    req: SupplierKYCSubmitRequest,
    request: Request,
    supplier: Supplier = Depends(get_current_supplier),
    db: Session = Depends(get_db)
):
    kyc = supplier.kyc
    is_new = False
    if not kyc:
        is_new = True
        kyc = SupplierKYC(
            supplier_id=supplier.id,
            gstin=req.gstin.upper(),
            pan=req.pan.upper(),
            fssai_license_number=req.fssai_license_number,
            bank_account_name=req.bank_account_name,
            bank_account_number=req.bank_account_number,
            bank_ifsc=req.bank_ifsc.upper(),
            bank_name=req.bank_name,
            status="PENDING"
        )
        db.add(kyc)
    else:
        kyc.gstin = req.gstin.upper()
        kyc.pan = req.pan.upper()
        kyc.fssai_license_number = req.fssai_license_number
        kyc.bank_account_name = req.bank_account_name
        kyc.bank_account_number = req.bank_account_number
        kyc.bank_ifsc = req.bank_ifsc.upper()
        kyc.bank_name = req.bank_name
        kyc.status = "PENDING"
        kyc.rejection_reason = None

    supplier.kyc_status = "PENDING"
    
    log_audit_event(
        db=db,
        action="SUPPLIER_KYC_SUBMIT",
        entity_type="SUPPLIER_KYC",
        entity_id=str(supplier.id),
        actor_id=supplier.user_id,
        new_values={
            "gstin": req.gstin.upper(),
            "pan": req.pan.upper(),
            "fssai": req.fssai_license_number,
            "status": "PENDING"
        },
        ip_address=request.client.host if request.client else None
    )

    db.commit()
    db.refresh(supplier)

    return {
        "message": "Supplier KYC submitted successfully and is pending Admin review",
        "kyc_status": supplier.kyc_status
    }

@router.get("/locations")
def list_locations(
    supplier: Supplier = Depends(get_current_supplier),
    db: Session = Depends(get_db)
):
    locs = db.query(SupplierLocation).filter(
        SupplierLocation.supplier_id == supplier.id,
        SupplierLocation.is_active == True
    ).all()
    return [
        {
            "id": str(l.id),
            "name": l.name,
            "type": l.type,
            "address_line1": l.address_line1,
            "address_line2": l.address_line2,
            "city": l.city,
            "state": l.state,
            "pincode": l.pincode,
            "serviceable_pincodes": l.serviceable_pincodes
        }
        for l in locs
    ]

@router.post("/locations", status_code=status.HTTP_201_CREATED)
def create_location(
    req: LocationCreateRequest,
    supplier: Supplier = Depends(get_current_supplier),
    db: Session = Depends(get_db)
):
    location = SupplierLocation(
        supplier_id=supplier.id,
        name=req.name,
        type=req.type,
        address_line1=req.address_line1,
        address_line2=req.address_line2,
        city=req.city,
        state=req.state,
        pincode=req.pincode,
        serviceable_pincodes=req.serviceable_pincodes,
        is_active=True
    )
    db.add(location)
    db.commit()
    db.refresh(location)

    return {
        "id": str(location.id),
        "name": location.name,
        "city": location.city,
        "pincode": location.pincode,
        "serviceable_pincodes": location.serviceable_pincodes
    }

@router.post("/documents", status_code=status.HTTP_201_CREATED)
def add_document(
    req: DocumentCreateRequest,
    supplier: Supplier = Depends(get_current_supplier),
    db: Session = Depends(get_db)
):
    doc = SupplierDocument(
        supplier_id=supplier.id,
        document_type=req.document_type,
        file_path=req.file_path,
        file_name=req.file_name,
        mime_type=req.mime_type,
        file_size=req.file_size
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {
        "id": str(doc.id),
        "document_type": doc.document_type,
        "file_name": doc.file_name,
        "uploaded_at": doc.uploaded_at.isoformat()
    }
