"""Prescription upload (customer) endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Prescription, User
from app.schemas import PrescriptionOut
from app.services.storage import save_prescription_file

router = APIRouter()


def _out(rx: Prescription) -> PrescriptionOut:
    return PrescriptionOut(
        id=rx.id,
        status=rx.status,
        file_url=rx.file_url,
        file_name=rx.file_name,
        extracted_medicines=rx.extracted_medicines,
        notes=rx.notes,
        created_at=rx.created_at,
        user_id=rx.user_id,
    )


@router.post("/upload", response_model=PrescriptionOut)
async def upload_prescription(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file_url, file_name = await save_prescription_file(user.id, file)
    rx = Prescription(
        user_id=user.id,
        file_url=file_url,
        file_name=file_name,
        status="pending_review",
        ocr_text=None,
        extracted_medicines=None,
        notes="Queued for pharmacist review",
    )
    db.add(rx)
    db.commit()
    db.refresh(rx)
    return _out(rx)


@router.get("", response_model=list[PrescriptionOut])
def list_my_prescriptions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(Prescription)
        .filter(Prescription.user_id == user.id)
        .order_by(Prescription.id.desc())
        .all()
    )
    return [_out(r) for r in rows]
