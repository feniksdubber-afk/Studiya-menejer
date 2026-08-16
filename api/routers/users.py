from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from models.users import DirectorStatus, User, UserRole
from routers.auth import require_registered_user
from schemas.auth import RoleUpdateRequest, UserOut
from services.notification_dispatcher import notify

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/search", response_model=list[UserOut])
async def search_users(
    q: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    """Ism yoki Telegram username bo'yicha ro'yxatdan o'tgan foydalanuvchilarni
    qidiradi. Loyihaga jamoa a'zosi qo'shishda foydalanuvchini tanlash uchun."""
    query = q.strip()
    if len(query) < 2:
        return []

    like = f"%{query}%"
    result = await db.execute(
        select(User)
        .where(User.is_registered.is_(True))
        .where(or_(User.first_name.ilike(like), User.telegram_username.ilike(like)))
        .limit(20)
    )
    return result.scalars().all()


@router.patch("/me/role", response_model=UserOut)
async def update_my_role(
    payload: RoleUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    """Foydalanuvchi ro'yxatdan o'tgandan keyin ham o'z umumiy rolini
    (Profil sahifasidan) o'zi almashtirishi mumkin.

    Rejissyorlikka o'tish — bot orqali dastlabki registratsiyadagi bilan bir
    xil qoida: darhol berilmaydi, `director_status=pending`ga o'tadi va
    adminlarga bildirishnoma yuboriladi (mavjud `/admin_pending` +
    tasdiqlash tugmalari orqali ko'rib chiqiladi — qarang:
    bot/handlers/admin_management.py, admin_approval.py). Rejissyorlikdan
    boshqa rolga o'tilsa, avvalgi tasdiq bekor qilinadi (director_approved
    qayta rejissyor bo'lishni so'raganda yangidan tasdiqlanishi kerak).
    """
    if payload.role == user.role:
        return user

    user.role = payload.role

    if payload.role == UserRole.director:
        user.director_status = DirectorStatus.pending
        user.director_approved = False
        await db.commit()
        await db.refresh(user)
        await _notify_admins_director_request(db, user)
    else:
        user.director_status = DirectorStatus.none
        user.director_approved = False
        await db.commit()
        await db.refresh(user)

    return user


async def _notify_admins_director_request(db: AsyncSession, applicant: User) -> None:
    result = await db.execute(
        select(User).where(or_(User.is_admin.is_(True), User.is_super_admin.is_(True)))
    )
    admins = result.scalars().all()
    for admin in admins:
        await notify(
            db,
            user_id=admin.id,
            type_="director_role_requested",
            payload={
                "applicant_id": str(applicant.id),
                "applicant_name": f"{applicant.first_name} {applicant.last_name or ''}".strip(),
                "applicant_username": applicant.telegram_username,
            },
        )
