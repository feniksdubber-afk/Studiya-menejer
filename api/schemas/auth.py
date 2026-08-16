import uuid

from pydantic import BaseModel

from models.users import UserRole


class TelegramAuthRequest(BaseModel):
    init_data: str  # Mini App'dan kelgan xom Telegram.WebApp.initData satri


class UserBrief(BaseModel):
    """Boshqa obyektlar (ProjectMember, CharacterCast) ichida ko'rsatish
    uchun foydalanuvchining qisqa profili — frontend faqat user_id borligida
    ism/username ko'rsatish uchun qo'shimcha /users/search so'rovi
    yubormasin deb, tegishli router shu yerda to'ldirib qaytaradi."""

    id: uuid.UUID
    first_name: str
    last_name: str | None
    telegram_username: str | None

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: uuid.UUID
    telegram_id: int
    first_name: str
    last_name: str | None
    telegram_username: str | None
    role: str | None
    director_status: str
    is_admin: bool
    is_super_admin: bool

    model_config = {"from_attributes": True}


class RoleUpdateRequest(BaseModel):
    """Ro'yxatdan o'tgan foydalanuvchi o'z umumiy rolini o'zi almashtirishi
    uchun (Profil sahifasi). Rejissyorlikka o'tish admin tasdig'ini talab
    qiladi — bu bot orqali dastlabki registratsiyadagi bilan bir xil qoida
    (qarang: bot/handlers/registration.py:process_role)."""

    role: UserRole


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_new_user: bool
    user: UserOut
