"""Bot -> API ichki chaqiruvlari uchun yupqa client.

Binary fayl hech qachon bu orqali yuborilmaydi — faqat Telegram file_id
va metadata. `INTERNAL_API_KEY` bot va API o'rtasida umumiy sir bo'lib,
tashqi dunyodan kelgan so'rovlarni rad etadi (§4 xavfsizlik talabi).
"""
import uuid

import httpx

from config import API_BASE_URL, INTERNAL_API_KEY


class InternalApiError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"{status_code}: {detail}")


async def submit_file(
    task_id: uuid.UUID,
    uploaded_by: uuid.UUID,
    telegram_file_id: str,
    telegram_message_id: int,
    file_name: str,
    mime_type: str | None,
    file_size: int | None,
) -> dict:
    payload = {
        "task_id": str(task_id),
        "uploaded_by": str(uploaded_by),
        "telegram_file_id": telegram_file_id,
        "telegram_message_id": telegram_message_id,
        "file_name": file_name,
        "mime_type": mime_type,
        "file_size": file_size,
    }
    async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=15.0) as client:
        response = await client.post(
            "/internal/files",
            json=payload,
            headers={"X-Internal-Api-Key": INTERNAL_API_KEY},
        )

    if response.status_code >= 400:
        try:
            detail = response.json().get("detail", response.text)
        except ValueError:
            detail = response.text
        raise InternalApiError(response.status_code, detail)

    return response.json()
