"""Bir martalik seed skripti: birinchi (asosiy) Super Adminni belgilash.

Ishlatilishi (server ustida, .env sozlangandan keyin):
    python -m scripts.seed_super_admin <telegram_id>

Bu skript:
- foydalanuvchi users jadvalida hali bo'lmasa, minimal yozuv yaratadi
  (u keyinroq /start orqali ismini to'ldiradi);
- is_super_admin=True va is_admin=True qiladi.

MUHIM: bu faqat DEPLOY paytida, birinchi Super Adminni o'rnatish uchun
ishlatiladi. Tizim ichida (bot orqali) Super Admin maqomini berish yoki
o'zgartirish imkoniyati ATAYLAB yo'q — spec §5: "almashtirilmaydi,
boshqa odamga topshirilmaydi".
"""
import asyncio
import sys
import uuid

sys.path.insert(0, "api")

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from core.config import settings  # noqa: E402
from models.users import User  # noqa: E402


async def main(telegram_id: int):
    engine = create_async_engine(settings.database_url)
    Session = async_sessionmaker(bind=engine, expire_on_commit=False)

    async with Session() as db:
        result = await db.execute(select(User).where(User.telegram_id == telegram_id))
        user = result.scalar_one_or_none()

        if user is None:
            user = User(
                id=uuid.uuid4(),
                telegram_id=telegram_id,
                first_name="Super Admin",
                role=None,
                is_registered=False,
            )
            db.add(user)

        existing_super = await db.execute(select(User).where(User.is_super_admin.is_(True)))
        if existing_super.scalar_one_or_none() is not None:
            print("❌ Super Admin allaqachon mavjud. Skript to'xtatildi.")
            return

        user.is_super_admin = True
        user.is_admin = True
        await db.commit()
        print(f"✅ telegram_id={telegram_id} endi Super Admin.")


if __name__ == "__main__":
    if len(sys.argv) != 2 or not sys.argv[1].isdigit():
        print("Foydalanish: python -m scripts.seed_super_admin <telegram_id>")
        sys.exit(1)
    asyncio.run(main(int(sys.argv[1])))
