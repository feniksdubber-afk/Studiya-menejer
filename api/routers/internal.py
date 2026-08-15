from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import require_internal_service
from db.session import get_db
from schemas.files import FileOut, FileSubmitResult, FileVersionOut, InternalFileSubmit
from services.file_service import submit_file

router = APIRouter(prefix="/internal", tags=["internal"])


@router.post(
    "/files",
    response_model=FileSubmitResult,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_internal_service)],
)
async def internal_submit_file(
    payload: InternalFileSubmit,
    db: AsyncSession = Depends(get_db),
):
    """Faqat bot server chaqiradi (§4.1) — `X-Internal-Api-Key` header talab
    qilinadi, oddiy foydalanuvchi JWT'i bu yerda ishlamaydi. Binary fayl
    hech qachon bu yerga kelmaydi, faqat Telegram file_id + metadata.

    Versiyalash: shu task uchun `files` yozuvi topiladi/yaratiladi, eski
    aktiv versiya `superseded` qilinadi, yangisi `active` sifatida qo'shiladi
    (v1 -> v2 -> v3 ...). Eski versiyalar hech qachon o'chirilmaydi.
    """
    file, version = await submit_file(db, payload)
    return FileSubmitResult(
        file=FileOut.model_validate(file),
        version=FileVersionOut.model_validate(version),
        task_status="submitted",
        task_current_version=version.version_number,
    )
