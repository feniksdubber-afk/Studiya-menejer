"""Admin boshqaruvi:
- /admin_pending — pending rejissyorlik so'rovlari ro'yxati (har qanday admin)
- /admin_list    — barcha adminlar ro'yxati (har qanday admin)
- /admin_add <telegram_id>    — faqat Super Admin
- /admin_remove <telegram_id> — faqat Super Admin

Super Admin himoyasi:
- o'zini o'chira olmaydi
- o'z huquqini pasaytira olmaydi (is_super_admin har doim true qoladi)
- boshqa oddiy adminlar tomonidan o'chirilmaydi (is_admin=False qilinmaydi)

Eslatma: Super Admin maqomi bot orqali BERILMAYDI — spec §5 bo'yicha
"almashtirilmaydi, boshqa odamga topshirilmaydi", shuning uchun u faqat
bir marta to'g'ridan-to'g'ri database'da (deploy paytida seed sifatida)
belgilanadi.
"""
from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message
from sqlalchemy import select

from db import get_session
from keyboards.registration import director_approval_keyboard
from models.users import DirectorStatus, User

router = Router(name="admin_management")


async def _get_user(telegram_id: int) -> User | None:
    async with get_session() as db:
        result = await db.execute(select(User).where(User.telegram_id == telegram_id))
        return result.scalar_one_or_none()


@router.message(Command("admin_pending"))
async def list_pending(message: Message):
    caller = await _get_user(message.from_user.id)
    if not caller or not (caller.is_admin or caller.is_super_admin):
        await message.answer("Bu buyruq faqat adminlar uchun.")
        return

    async with get_session() as db:
        result = await db.execute(
            select(User).where(User.director_status == DirectorStatus.pending)
        )
        pending_users = result.scalars().all()

    if not pending_users:
        await message.answer("📭 Hozircha pending rejissyorlik so'rovlari yo'q.")
        return

    for user in pending_users:
        full_name = f"{user.first_name} {user.last_name or ''}".strip()
        username_line = f"@{user.telegram_username}" if user.telegram_username else "(username yo'q)"
        created = user.created_at.strftime("%d-%B %H:%M") if user.created_at else "—"
        text = (
            "🎬 Rejissyorlik so'rovi\n\n"
            f"👤 {full_name}\n"
            f"🔗 {username_line}\n"
            f"📅 {created}"
        )
        await message.answer(text, reply_markup=director_approval_keyboard(str(user.id)))


@router.message(Command("admin_list"))
async def list_admins(message: Message):
    caller = await _get_user(message.from_user.id)
    if not caller or not (caller.is_admin or caller.is_super_admin):
        await message.answer("Bu buyruq faqat adminlar uchun.")
        return

    async with get_session() as db:
        result = await db.execute(
            select(User).where((User.is_admin.is_(True)) | (User.is_super_admin.is_(True)))
        )
        admins = result.scalars().all()

    lines = ["👑 Adminlar ro'yxati:\n"]
    for a in admins:
        badge = "⭐ Super Admin" if a.is_super_admin else "Admin"
        full_name = f"{a.first_name} {a.last_name or ''}".strip()
        lines.append(f"{badge} — {full_name} (ID: {a.telegram_id})")
    await message.answer("\n".join(lines))


@router.message(Command("admin_add"))
async def add_admin(message: Message):
    caller = await _get_user(message.from_user.id)
    if not caller or not caller.is_super_admin:
        await message.answer("❌ Bu buyruq faqat Super Admin uchun.")
        return

    parts = (message.text or "").split(maxsplit=1)
    if len(parts) < 2 or not parts[1].strip().lstrip("-").isdigit():
        await message.answer("Foydalanish: /admin_add <telegram_id>")
        return
    target_telegram_id = int(parts[1].strip())

    async with get_session() as db:
        result = await db.execute(select(User).where(User.telegram_id == target_telegram_id))
        target = result.scalar_one_or_none()
        if target is None:
            await message.answer("❌ Bu telegram_id bilan foydalanuvchi topilmadi (avval botga /start yozishi kerak).")
            return
        if target.is_admin or target.is_super_admin:
            await message.answer("Bu foydalanuvchi allaqachon admin.")
            return

        target.is_admin = True
        await db.commit()

    await message.answer(f"✅ {target.first_name} endi admin.")


@router.message(Command("admin_remove"))
async def remove_admin(message: Message):
    caller = await _get_user(message.from_user.id)
    if not caller or not caller.is_super_admin:
        await message.answer("❌ Bu buyruq faqat Super Admin uchun.")
        return

    parts = (message.text or "").split(maxsplit=1)
    if len(parts) < 2 or not parts[1].strip().lstrip("-").isdigit():
        await message.answer("Foydalanish: /admin_remove <telegram_id>")
        return
    target_telegram_id = int(parts[1].strip())

    if target_telegram_id == caller.telegram_id:
        await message.answer("❌ O'zingizni admin ro'yxatidan olib tashlay olmaysiz.")
        return

    async with get_session() as db:
        result = await db.execute(select(User).where(User.telegram_id == target_telegram_id))
        target = result.scalar_one_or_none()
        if target is None:
            await message.answer("❌ Foydalanuvchi topilmadi.")
            return
        if target.is_super_admin:
            await message.answer("❌ Super Admin olib tashlanishi mumkin emas.")
            return
        if not target.is_admin:
            await message.answer("Bu foydalanuvchi admin emas.")
            return

        target.is_admin = False
        await db.commit()

    await message.answer(f"✅ {target.first_name} admin ro'yxatidan olib tashlandi.")
