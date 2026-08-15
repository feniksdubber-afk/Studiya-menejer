import logging

from aiogram import Bot, F, Router
from aiogram.filters import CommandStart
from aiogram.filters.command import CommandObject
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from sqlalchemy import select

from db import get_session
from handlers.file_submit import start_task_submission_flow
from keyboards.registration import ROLE_LABELS, director_approval_keyboard, role_selection_keyboard
from models.users import DirectorStatus, User, UserRole
from states.registration import Registration
from utils.deep_link import parse_task_deep_link_payload

router = Router(name="registration")
logger = logging.getLogger(__name__)


async def _get_or_create_user(telegram_user) -> tuple[User, bool]:
    """DB'dan userni topadi yoki (agar Mini App orqali hali yaratilmagan
    bo'lsa) yangi yozuv ochadi. `/auth/telegram` va bot ikkalasi ham bir xil
    users jadvaliga yozadi, shuning uchun ikkalasi ham shu logikani ishlatadi."""
    async with get_session() as db:
        result = await db.execute(select(User).where(User.telegram_id == telegram_user.id))
        user = result.scalar_one_or_none()
        created = False
        if user is None:
            user = User(
                telegram_id=telegram_user.id,
                first_name=telegram_user.first_name or "—",
                last_name=telegram_user.last_name,
                telegram_username=telegram_user.username,
                role=None,
                is_registered=False,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            created = True
        return user, created


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext, command: CommandObject):
    await state.clear()
    user, _ = await _get_or_create_user(message.from_user)
    task_id = parse_task_deep_link_payload(command.args)

    if user.is_registered:
        if user.role == UserRole.director and user.director_status == DirectorStatus.rejected:
            await message.answer(
                "Sizning avvalgi rejissyorlik so'rovingiz rad etilgan edi.\n"
                "Qayta so'rov yubormoqchimisiz?",
                reply_markup=InlineKeyboardMarkup(
                    inline_keyboard=[[InlineKeyboardButton(text="🔄 Qayta so'rov yuborish", callback_data="reg_retry_director")]]
                ),
            )
            return
        if task_id:
            # Ro'yxatdan o'tgan — deep-linkdagi task uchun to'g'ridan-to'g'ri
            # avtorizatsiya zanjiri (start_task_submission_flow) ishga tushadi.
            await start_task_submission_flow(message, state, message.from_user.id, task_id)
            return
        await message.answer(
            "👋 Xush kelibsiz! Siz allaqachon ro'yxatdan o'tgansiz.\n"
            "Asosiy funksiyalar uchun Mini App'ni oching."
        )
        return

    if task_id:
        # Hali ro'yxatdan o'tmagan — /startni buzmaymiz: avval to'liq
        # registratsiya oqimi boradi, task_id esa state'da saqlanib,
        # process_role tugagach avtomatik davom etadi.
        await state.update_data(pending_task_id=task_id)

    await state.set_state(Registration.name)
    await message.answer("👋 Salom! Ro'yxatdan o'tish uchun ismingizni yozing:")


@router.message(Registration.name)
async def process_name(message: Message, state: FSMContext):
    name = (message.text or "").strip()
    if not name:
        await message.answer("Iltimos, ismingizni matn ko'rinishida yozing.")
        return
    await state.update_data(name=name)
    await state.set_state(Registration.surname)
    await message.answer("Familiyangizni yozing:")


@router.message(Registration.surname)
async def process_surname(message: Message, state: FSMContext):
    surname = (message.text or "").strip()
    if not surname:
        await message.answer("Iltimos, familiyangizni matn ko'rinishida yozing.")
        return
    await state.update_data(surname=surname)
    await state.set_state(Registration.role)
    await message.answer("Rolingizni tanlang:", reply_markup=role_selection_keyboard())


@router.callback_query(Registration.role, F.data.startswith("reg_role:"))
async def process_role(callback: CallbackQuery, state: FSMContext, bot: Bot):
    role_key = callback.data.split(":", 1)[1]
    if role_key not in ROLE_LABELS:
        await callback.answer("Noto'g'ri rol", show_alert=True)
        return

    data = await state.get_data()
    name = data.get("name", callback.from_user.first_name or "—")
    surname = data.get("surname")
    pending_task_id = data.get("pending_task_id")

    async with get_session() as db:
        result = await db.execute(select(User).where(User.telegram_id == callback.from_user.id))
        user = result.scalar_one_or_none()
        if user is None:
            await callback.answer("Foydalanuvchi topilmadi, /start bosing", show_alert=True)
            await state.clear()
            return

        user.first_name = name
        user.last_name = surname
        user.role = UserRole(role_key)
        user.is_registered = True

        if role_key == "director":
            user.director_status = DirectorStatus.pending
            await db.commit()
            await db.refresh(user)
            await _notify_admins_director_request(db, bot, user)
            await callback.message.edit_text(
                "🎬 Rejissyor roli tanlandi.\n⏳ Admin tasdig'i kutilmoqda."
            )
        else:
            user.director_status = DirectorStatus.none
            await db.commit()
            await callback.message.edit_text(
                f"✅ Ro'yxatdan muvaffaqiyatli o'tdingiz!\nRolingiz: {ROLE_LABELS[role_key]}"
            )

    await state.clear()
    await callback.answer()

    if pending_task_id:
        # Registratsiya endigina tugadi — deep-linkdan kelgan task uchun
        # to'liq avtorizatsiya zanjiri shu yerda (registratsiyadan keyin)
        # boshlanadi, xuddi darhol ro'yxatdan o'tgan userdagidek.
        await start_task_submission_flow(
            callback.message, state, callback.from_user.id, pending_task_id
        )


@router.callback_query(F.data == "reg_retry_director")
async def retry_director_request(callback: CallbackQuery, bot: Bot):
    async with get_session() as db:
        result = await db.execute(select(User).where(User.telegram_id == callback.from_user.id))
        user = result.scalar_one_or_none()
        if user is None or user.director_status != DirectorStatus.rejected:
            await callback.answer("Amal bajarilmadi", show_alert=True)
            return
        user.director_status = DirectorStatus.pending
        await db.commit()
        await db.refresh(user)
        await _notify_admins_director_request(db, bot, user)

    await callback.message.edit_text("⏳ Qayta so'rov yuborildi. Admin tasdig'i kutilmoqda.")
    await callback.answer()


async def _notify_admins_director_request(db, bot: Bot, applicant: User) -> None:
    """Barcha adminlarga (oddiy + super) yangi rejissyorlik so'rovi haqida
    xabar yuboradi, tasdiqlash/rad etish tugmalari bilan."""
    result = await db.execute(select(User).where((User.is_admin.is_(True)) | (User.is_super_admin.is_(True))))
    admins = result.scalars().all()

    full_name = f"{applicant.first_name} {applicant.last_name or ''}".strip()
    username_line = f"@{applicant.telegram_username}" if applicant.telegram_username else "(username yo'q)"
    text = (
        "🎬 Yangi rejissyorlik so'rovi\n\n"
        f"👤 {full_name}\n"
        f"🔗 {username_line}"
    )

    for admin in admins:
        try:
            await bot.send_message(
                admin.telegram_id,
                text,
                reply_markup=director_approval_keyboard(str(applicant.id)),
            )
        except Exception:
            logger.exception("Adminga notification yuborilmadi: telegram_id=%s", admin.telegram_id)
