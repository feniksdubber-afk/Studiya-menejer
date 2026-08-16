"""Telegram Bot API orqali fayl havolasini olish.

Loyihada binary fayllar (tarjima matni, ovoz yozuvi, video/audio montaj)
odatda serverimizga tushmaydi — faqat `telegram_file_id` saqlanadi (bot
orqali topshirilgan). Foydalanuvchi bu faylni Mini App ichida ko'rish/
eshitish/yuklab olish uchun `getFile` chaqirilib, Telegram CDN'idagi
vaqtinchalik havola olinadi.

MUHIM: bu havola `https://api.telegram.org/file/bot<token>/<file_path>`
ko'rinishida bo'ladi va bot tokenini o'z ichiga oladi. Shuning uchun bu
funksiya faqat backend ichida chaqiriladi (frontendga hech qachon token
berilmaydi) va qaytarilgan URL faqat autentifikatsiyadan o'tgan, shu
vazifaga/loyihaga kirish huquqi bor foydalanuvchiga (ruxsat tekshiruvidan
so'ng) beriladi.
"""

import httpx
from fastapi import HTTPException, status

from core.config import settings

_TELEGRAM_API_BASE = "https://api.telegram.org"

# Telegram file_path odatda o'zgarmaydi, lekin havolaning o'zi vaqt bilan
# eskirmaydi — bu qiymat faqat frontendga "necha soniyagacha ishonch bilan
# ishlating" degan signal sifatida beriladi (haqiqiy amal qilish muddati
# Telegram tomonida cheklanmagan, lekin ehtiyot uchun qisqa muddat beramiz).
FILE_URL_TTL_SECONDS = 60 * 60  # 1 soat


async def get_telegram_file_url(telegram_file_id: str) -> str:
    """`telegram_file_id` uchun to'liq yuklab olish/ko'rish havolasini qaytaradi."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(
                f"{_TELEGRAM_API_BASE}/bot{settings.bot_token}/getFile",
                params={"file_id": telegram_file_id},
            )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Telegram bilan bog'lanib bo'lmadi — birozdan so'ng qayta urinib ko'ring",
            ) from exc

    data = resp.json()
    if not data.get("ok"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fayl Telegram serverida topilmadi (eskirgan yoki o'chirilgan bo'lishi mumkin)",
        )

    file_path = data["result"]["file_path"]
    return f"{_TELEGRAM_API_BASE}/file/bot{settings.bot_token}/{file_path}"
