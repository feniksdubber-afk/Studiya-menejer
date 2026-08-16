import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from models.projects import Project, ProjectMember, ProjectRole
from models.users import User
from routers.auth import require_registered_user

DIRECTOR_ROLES = {ProjectRole.director_main, ProjectRole.director_extra}


async def get_project_or_404(project_id: uuid.UUID, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loyiha topilmadi")
    return project


async def get_membership(db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID) -> ProjectMember | None:
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    return result.scalars().first()


class ProjectAccess:
    """Dependency: loyiha mavjudligini va joriy foydalanuvchi unga a'zoligini
    tekshiradi. `require_director` True bo'lsa, faqat director_main/director_extra
    yoki admin/super_admin ruxsat oladi (yozish/o'zgartirish operatsiyalari uchun).
    """

    def __init__(self, require_director: bool = False):
        self.require_director = require_director

    async def __call__(
        self,
        project_id: uuid.UUID,
        db: AsyncSession = Depends(get_db),
        user: User = Depends(require_registered_user),
    ) -> tuple[Project, User]:
        project = await get_project_or_404(project_id, db)

        if user.is_admin or user.is_super_admin:
            return project, user

        membership = await get_membership(db, project_id, user.id)
        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Siz bu loyiha a'zosi emassiz",
            )

        if self.require_director and membership.role_in_project not in DIRECTOR_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu amal faqat rejissyor uchun",
            )

        return project, user


# Ko'rish uchun: har qanday a'zo (yoki admin)
project_view_access = ProjectAccess(require_director=False)
# O'zgartirish uchun: faqat director_main/director_extra (yoki admin)
project_director_access = ProjectAccess(require_director=True)


async def is_project_director(db: AsyncSession, project_id: uuid.UUID, user: User) -> bool:
    """Joriy user shu KONKRET loyihada boshqarish huquqiga ega-yo'qligini
    qaytaradi (admin/super_admin YOKI shu loyihada director_main/extra).
    Frontendga `can_manage` sifatida qaytariladi — global `user.role`ga
    emas, aynan shu loyihadagi a'zolikka asoslanadi (§ ruxsat arxitekturasi).
    """
    if user.is_admin or user.is_super_admin:
        return True
    membership = await get_membership(db, project_id, user.id)
    return membership is not None and membership.role_in_project in DIRECTOR_ROLES


async def require_project_member(
    project: Project,
    user: User,
    db: AsyncSession,
) -> None:
    """Allaqachon topilgan `project`/`user` obyektlari bilan "shu loyihaning
    istalgan a'zosimi" tekshiruvi (director bo'lishi shart emas). VoiceCue
    ("Rollar") kabi barcha faol a'zolarga (director/translator/voice
    actor/sound) ochiq bo'lgan resurslar uchun ishlatiladi — require_project_director
    bilan bir xil naqsh, faqat rol cheklovisiz.
    """
    if user.is_admin or user.is_super_admin:
        return
    membership = await get_membership(db, project.id, user.id)
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Siz bu loyiha a'zosi emassiz",
        )


async def require_project_director(
    project: Project,
    user: User,
    db: AsyncSession,
) -> None:
    """Allaqachon topilgan `project`/`user` obyektlari bilan director huquqini
    tekshirish uchun yordamchi (Season/Episode/Character kabi ichki
    resurslarning parent_id orqali loyihaga bog'langan holatlarida ishlatiladi).
    """
    if user.is_admin or user.is_super_admin:
        return
    membership = await get_membership(db, project.id, user.id)
    if membership is None or membership.role_in_project not in DIRECTOR_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu amal faqat loyiha rejissyori uchun",
        )
