"""Telegram Bot API orqali fayllarni olish.

Binary fayllar (tarjima matni, ovoz yozuvi, montaj) serverimizga tushmaydi —
faqat `telegram_file_id` saqlanadi. Ko'rish/eshitish uchun backend `getFile`
chaqiradi va faylni o'zi Telegram'dan oqim (stream) qilib foydalanuvchiga
uzatadi.

MUHIM: Telegram'ning to'g'ridan-to'g'ri havolasi
`https://api.telegram.org/file/bot<token>/<path>` bot tokenini o'z ichiga
oladi. U HECH QACHON frontendga, log yoki xato matniga chiqmaydi.
"""

from collections.abc import AsyncIterator
from dataclasses import dataclass

import httpx
from fastapi import HTTPException, status

from core.config import settings

_TELEGRAM_API_BASE = "https://api.telegram.org"

# Stream havolasi (imzolangan belgi) amal qilish muddati. Qisqa: loyihadan
# chiqarilgan foydalanuvchi eski havola bilan uzoq kira olmasligi uchun.
FILE_URL_TTL_SECONDS = 60 * 15  # 15 daqiqa — eskirsa frontend yangi havola so'raydi

# Standart Bot API getFile chegarasi.
TELEGRAM_GETFILE_LIMIT_BYTES = 20 * 1024 * 1024

_PASSTHROUGH_HEADERS = ("content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified")


async def _get_file_path(telegram_file_id: str) -> str:
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

    try:
        data = resp.json()
    except ValueError:
        data = {}
    if not data.get("ok"):
        description = str(data.get("description", "")).lower()
        if "too big" in description:
            raise HTTPException(
                status_code=413,
                detail="Fayl 20 MB dan katta — Mini App ichida ochib bo'lmaydi. Uni botdan o'zingizga yuborish mumkin",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fayl Telegram serverida topilmadi (eskirgan yoki o'chirilgan bo'lishi mumkin)",
        )
    return data["result"]["file_path"]


@dataclass
class TelegramStream:
    status_code: int
    headers: dict[str, str]
    body: AsyncIterator[bytes]


async def open_telegram_file_stream(telegram_file_id: str, range_header: str | None) -> TelegramStream:
    """Faylni Telegram'dan oqim qilib ochadi (Range qo'llab-quvvatlanadi, shuning
    uchun video/audio pleerda surish ishlaydi). Token faqat backend ichida qoladi."""
    file_path = await _get_file_path(telegram_file_id)
    url = f"{_TELEGRAM_API_BASE}/file/bot{settings.bot_token}/{file_path}"
    # identity: siqilgan javob bo'lsa httpx uni ochib yuboradi, Content-Length esa
    # siqilgan hajmda qoladi va brauzerda oqim uziladi.
    req_headers = {"Accept-Encoding": "identity"}
    if range_header:
        req_headers["Range"] = range_header

    client = httpx.AsyncClient(timeout=httpx.Timeout(15.0, read=60.0))
    try:
        upstream = await client.send(client.build_request("GET", url, headers=req_headers), stream=True)
    except httpx.HTTPError as exc:
        await client.aclose()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Telegram bilan bog'lanib bo'lmadi — birozdan so'ng qayta urinib ko'ring",
        ) from exc

    if upstream.status_code not in (200, 206):
        await upstream.aclose()
        await client.aclose()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fayl Telegram serveridan olinmadi")

    async def body() -> AsyncIterator[bytes]:
        try:
            async for chunk in upstream.aiter_bytes(64 * 1024):
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    headers = {k: v for k, v in upstream.headers.items() if k.lower() in _PASSTHROUGH_HEADERS}
    headers.setdefault("Accept-Ranges", "bytes")
    return TelegramStream(upstream.status_code, headers, body())


async def send_file_to_chat(telegram_file_id: str, chat_id: int, caption: str | None = None) -> None:
    """Faylni botdan foydalanuvchining shaxsiy chatiga yuboradi. `file_id` orqali
    yuborishda Telegram'ning 20 MB `getFile` chegarasi amal qilmaydi, shuning
    uchun katta fayllar uchun yagona ishonchli yo'l shu."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                f"{_TELEGRAM_API_BASE}/bot{settings.bot_token}/sendDocument",
                json={"chat_id": chat_id, "document": telegram_file_id, "caption": caption},
            )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Telegram bilan bog'lanib bo'lmadi — birozdan so'ng qayta urinib ko'ring",
            ) from exc

    try:
        data = resp.json()
    except ValueError:
        data = {}
    if not data.get("ok"):
        description = str(data.get("description", "")).lower()
        if "blocked" in description or "chat not found" in description or "forbidden" in description:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bot sizga yozolmaydi — botni oching va /start bosing, so'ng qayta urinib ko'ring",
            )
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Faylni yuborib bo'lmadi")
