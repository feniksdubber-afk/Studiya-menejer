from fastapi import APIRouter, Depends, HTTPException, status
import httpx

from models.users import User
from routers.auth import require_registered_user
from services import anilist as anilist_service

router = APIRouter(prefix="/anilist", tags=["anilist"])


@router.get("/search")
async def search_anime(
    q: str,
    user: User = Depends(require_registered_user),
):
    """Anime nomi bo'yicha AniList'dan qidiradi. Loyiha yaratishda
    nom/poster/anilist_id avtomatik to'ldirish uchun ishlatiladi."""
    if not q or len(q.strip()) < 2:
        return []
    try:
        return await anilist_service.search_anime(q.strip())
    except httpx.HTTPError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="AniList bilan bog'lanib bo'lmadi"
        )


@router.get("/{anilist_id}/characters")
async def list_anime_characters(
    anilist_id: int,
    user: User = Depends(require_registered_user),
):
    """Berilgan AniList anime ID uchun personajlar ro'yxatini qaytaradi
    (loyihaga import qilishdan oldin ko'rib chiqish uchun)."""
    try:
        return await anilist_service.get_characters(anilist_id)
    except httpx.HTTPError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="AniList bilan bog'lanib bo'lmadi"
        )
