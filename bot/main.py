import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

from config import BOT_TOKEN
from handlers import admin_approval, admin_management, file_submit, registration

logging.basicConfig(level=logging.INFO)


async def main():
    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    # Prod'da MemoryStorage o'rniga RedisStorage tavsiya etiladi (bot qayta
    # ishga tushganda FSM holati saqlanishi uchun), lekin registratsiya FSM
    # qisqa umrli bo'lgani uchun boshlang'ich bosqichda Memory yetarli.
    dp = Dispatcher(storage=MemoryStorage())

    dp.include_router(registration.router)
    dp.include_router(admin_approval.router)
    dp.include_router(admin_management.router)
    dp.include_router(file_submit.router)

    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
