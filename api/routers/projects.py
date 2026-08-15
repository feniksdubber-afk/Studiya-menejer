import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from models.projects import Episode, Project, ProjectMember, ProjectRole, Season
from models.users import DirectorStatus, User, UserRole
from routers.auth import require_admin, require_registered_user
from schemas.auth import UserBrief
from schemas.projects import (
    EpisodeCreate,
    EpisodeOut,
    EpisodeUpdate,
    ProjectCreate,
    ProjectMemberAdd,
    ProjectMemberOut,
    ProjectOut,
    ProjectUpdate,
    SeasonCreate,
    SeasonOut,
    SeasonUpdate,
)
from services.permissions import (
    get_membership,
    get_project_or_404,
    is_project_director,
    project_director_access,
    project_view_access,
    require_project_director,
)
router = APIRouter(tags=["projects"])


def _project_out(project: Project, can_manage: bool) -> ProjectOut:
    out = ProjectOut.model_validate(project)
    out.can_manage = can_manage
    return out


# ==================== PROJECTS ====================

@router.post("/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    """Loyiha yaratish — faqat rejissyor (role=director) yoki admin.

    MUHIM: role=director bo'lishning o'zi yetarli emas — bot orqali
    ro'yxatdan o'tayotganda foydalanuvchi shu rolni o'zi tanlaydi va
    is_registered darhol True bo'ladi (admin tasdig'ini kutmasdan,
    qarang: bot/handlers/registration.py). Haqiqiy director huquqi faqat
    admin `director_status`ni "approved" qilgandan keyin (director_approved)
    beriladi. Shu tekshiruvsiz istalgan foydalanuvchi "Rejissyor" rolini
    tanlab, admin tasdig'isiz darhol loyiha yaratishi mumkin bo'lardi.
    """
    is_approved_director = (
        user.role == UserRole.director
        and user.director_status == DirectorStatus.approved
        and user.director_approved
    )
    if not (is_approved_director or user.is_admin or user.is_super_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Faqat admin tomonidan tasdiqlangan rejissyor yoki admin loyiha yarata oladi",
        )

    project = Project(
        id=uuid.uuid4(),
        title=payload.title,
        type=payload.type,
        poster_url=payload.poster_url,
        anilist_id=payload.anilist_id,
        created_by=user.id,
    )
    db.add(project)
    await db.flush()

    # Yaratuvchi avtomatik director_main sifatida a'zo bo'ladi (agar rejissyor bo'lsa)
    if user.role == UserRole.director:
        db.add(
            ProjectMember(
                id=uuid.uuid4(),
                project_id=project.id,
                user_id=user.id,
                role_in_project=ProjectRole.director_main,
            )
        )

    await db.commit()
    await db.refresh(project)
    # Yaratuvchi har doim yaratilgan loyihani boshqara oladi (director_main
    # sifatida a'zo bo'ldi, yoki admin/super_admin sifatida yaratdi).
    return _project_out(project, can_manage=True)


@router.get("/projects", response_model=list[ProjectOut])
async def list_projects(
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    query = select(Project)
    if not include_archived:
        query = query.where(Project.is_archived.is_(False))
    query = query.order_by(Project.created_at.desc())
    result = await db.execute(query)
    projects = list(result.scalars().all())

    if user.is_admin or user.is_super_admin:
        director_project_ids: set[uuid.UUID] = {p.id for p in projects}
    else:
        member_result = await db.execute(
            select(ProjectMember.project_id).where(
                ProjectMember.user_id == user.id,
                ProjectMember.role_in_project.in_([ProjectRole.director_main, ProjectRole.director_extra]),
            )
        )
        director_project_ids = {row[0] for row in member_result.all()}

    return [_project_out(p, can_manage=p.id in director_project_ids) for p in projects]


@router.get("/projects/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    project = await get_project_or_404(project_id, db)
    can_manage = await is_project_director(db, project_id, user)
    return _project_out(project, can_manage=can_manage)


@router.patch("/projects/{project_id}", response_model=ProjectOut)
async def update_project(
    payload: ProjectUpdate,
    project_and_user: tuple[Project, User] = Depends(project_director_access),
    db: AsyncSession = Depends(get_db),
):
    project, _ = project_and_user
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    return _project_out(project, can_manage=True)


@router.post("/projects/{project_id}/archive", response_model=ProjectOut)
async def archive_project(
    project_and_user: tuple[Project, User] = Depends(project_director_access),
    db: AsyncSession = Depends(get_db),
):
    project, _ = project_and_user
    project.is_archived = True
    await db.commit()
    await db.refresh(project)
    return _project_out(project, can_manage=True)


@router.post("/projects/{project_id}/unarchive", response_model=ProjectOut)
async def unarchive_project(
    project_and_user: tuple[Project, User] = Depends(project_director_access),
    db: AsyncSession = Depends(get_db),
):
    project, _ = project_and_user
    project.is_archived = False
    await db.commit()
    await db.refresh(project)
    return _project_out(project, can_manage=True)


# ==================== PROJECT MEMBERS ====================

@router.get("/projects/{project_id}/members", response_model=list[ProjectMemberOut])
async def list_project_members(
    project_and_user: tuple[Project, User] = Depends(project_view_access),
    db: AsyncSession = Depends(get_db),
):
    project, _ = project_and_user
    # User bilan JOIN — Team UI'da ism/username ko'rsatish uchun frontend
    # har bir a'zo uchun alohida so'rov yubormasin (N+1 oldini olish).
    result = await db.execute(
        select(ProjectMember, User)
        .join(User, User.id == ProjectMember.user_id)
        .where(ProjectMember.project_id == project.id)
        .order_by(ProjectMember.role_in_project)
    )
    return [
        ProjectMemberOut(
            id=member.id,
            project_id=member.project_id,
            user_id=member.user_id,
            role_in_project=member.role_in_project,
            added_at=member.added_at,
            user=UserBrief.model_validate(member_user),
        )
        for member, member_user in result.all()
    ]


@router.post("/projects/{project_id}/members", response_model=ProjectMemberOut, status_code=status.HTTP_201_CREATED)
async def add_project_member(
    payload: ProjectMemberAdd,
    project_and_user: tuple[Project, User] = Depends(project_director_access),
    db: AsyncSession = Depends(get_db),
):
    project, _ = project_and_user

    target_user = await db.get(User, payload.user_id)
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foydalanuvchi topilmadi")

    existing = await get_membership(db, project.id, payload.user_id)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Foydalanuvchi allaqachon a'zo")

    member = ProjectMember(
        id=uuid.uuid4(),
        project_id=project.id,
        user_id=payload.user_id,
        role_in_project=payload.role_in_project,
    )
    db.add(member)
    try:
        await db.commit()
    except IntegrityError:
        # `existing = await get_membership(...)` yuqorida race condition'ga
        # ochiq (ikki so'rov bir vaqtda shu tekshiruvdan o'tib ketishi
        # mumkin) -- shuning uchun DB darajasidagi unique constraint
        # (uq_project_members_project_user, 0005 migratsiyasi) yakuniy
        # himoya chizig'i bo'lib xizmat qiladi.
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Foydalanuvchi allaqachon a'zo")
    await db.refresh(member)
    return ProjectMemberOut(
        id=member.id,
        project_id=member.project_id,
        user_id=member.user_id,
        role_in_project=member.role_in_project,
        added_at=member.added_at,
        user=UserBrief.model_validate(target_user),
    )


@router.delete("/projects/{project_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_project_member(
    member_id: uuid.UUID,
    project_and_user: tuple[Project, User] = Depends(project_director_access),
    db: AsyncSession = Depends(get_db),
):
    project, _ = project_and_user
    member = await db.get(ProjectMember, member_id)
    if member is None or member.project_id != project.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="A'zolik topilmadi")
    await db.delete(member)
    await db.commit()


# ==================== SEASONS ====================

@router.get("/projects/{project_id}/seasons", response_model=list[SeasonOut])
async def list_seasons(
    project_and_user: tuple[Project, User] = Depends(project_view_access),
    db: AsyncSession = Depends(get_db),
):
    project, _ = project_and_user
    result = await db.execute(
        select(Season).where(Season.project_id == project.id).order_by(Season.order_index)
    )
    return result.scalars().all()


@router.post("/projects/{project_id}/seasons", response_model=SeasonOut, status_code=status.HTTP_201_CREATED)
async def create_season(
    payload: SeasonCreate,
    project_and_user: tuple[Project, User] = Depends(project_director_access),
    db: AsyncSession = Depends(get_db),
):
    project, _ = project_and_user
    season = Season(
        id=uuid.uuid4(),
        project_id=project.id,
        title=payload.title,
        order_index=payload.order_index,
        anilist_season_id=payload.anilist_season_id,
    )
    db.add(season)
    await db.commit()
    await db.refresh(season)
    return season


async def _get_season_or_404(db: AsyncSession, season_id: uuid.UUID) -> Season:
    season = await db.get(Season, season_id)
    if season is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sezon topilmadi")
    return season


@router.patch("/seasons/{season_id}", response_model=SeasonOut)
async def update_season(
    season_id: uuid.UUID,
    payload: SeasonUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    season = await _get_season_or_404(db, season_id)
    project = await get_project_or_404(season.project_id, db)
    await require_project_director(project, user, db)

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(season, field, value)
    await db.commit()
    await db.refresh(season)
    return season


@router.delete("/seasons/{season_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_season(
    season_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    season = await _get_season_or_404(db, season_id)
    project = await get_project_or_404(season.project_id, db)
    await require_project_director(project, user, db)
    await db.delete(season)  # CASCADE -> episodes
    await db.commit()


# ==================== EPISODES ====================

@router.get("/seasons/{season_id}/episodes", response_model=list[EpisodeOut])
async def list_episodes(
    season_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    season = await _get_season_or_404(db, season_id)
    # Ko'rish uchun loyiha a'zoligini tekshiramiz (admin bo'lmasa)
    project = await get_project_or_404(season.project_id, db)
    if not (user.is_admin or user.is_super_admin):
        membership = await get_membership(db, project.id, user.id)
        if membership is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Siz bu loyiha a'zosi emassiz")

    result = await db.execute(
        select(Episode).where(Episode.season_id == season_id).order_by(Episode.order_index)
    )
    return result.scalars().all()


@router.post("/seasons/{season_id}/episodes", response_model=EpisodeOut, status_code=status.HTTP_201_CREATED)
async def create_episode(
    season_id: uuid.UUID,
    payload: EpisodeCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    season = await _get_season_or_404(db, season_id)
    project = await get_project_or_404(season.project_id, db)
    await require_project_director(project, user, db)

    episode = Episode(
        id=uuid.uuid4(),
        season_id=season_id,
        title=payload.title,
        order_index=payload.order_index,
    )
    db.add(episode)
    await db.commit()
    await db.refresh(episode)
    return episode


async def _get_episode_or_404(db: AsyncSession, episode_id: uuid.UUID) -> Episode:
    episode = await db.get(Episode, episode_id)
    if episode is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Qism topilmadi")
    return episode


@router.get("/episodes/{episode_id}", response_model=EpisodeOut)
async def get_episode(
    episode_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    episode = await _get_episode_or_404(db, episode_id)
    season = await _get_season_or_404(db, episode.season_id)
    if not (user.is_admin or user.is_super_admin):
        membership = await get_membership(db, season.project_id, user.id)
        if membership is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Siz bu loyiha a'zosi emassiz")
    return episode


@router.patch("/episodes/{episode_id}", response_model=EpisodeOut)
async def update_episode(
    episode_id: uuid.UUID,
    payload: EpisodeUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    episode = await _get_episode_or_404(db, episode_id)
    season = await _get_season_or_404(db, episode.season_id)
    project = await get_project_or_404(season.project_id, db)
    await require_project_director(project, user, db)

    data = payload.model_dump(exclude_unset=True)
    manual_status = data.pop("status", None)
    for field, value in data.items():
        setattr(episode, field, value)
    if manual_status is not None:
        # Qo'lda status override — kamdan-kam, favqulodda holatlar uchun.
        episode.status = manual_status
    await db.commit()
    await db.refresh(episode)
    return episode


@router.delete("/episodes/{episode_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_episode(
    episode_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    episode = await _get_episode_or_404(db, episode_id)
    season = await _get_season_or_404(db, episode.season_id)
    project = await get_project_or_404(season.project_id, db)
    await require_project_director(project, user, db)
    await db.delete(episode)
    await db.commit()
