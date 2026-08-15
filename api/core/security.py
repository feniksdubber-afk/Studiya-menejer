"""
Telegram Mini App `initData` ni backendda kriptografik tekshirish + JWT session.

MUHIM: initData ga frontend hech qachon ishonilmaydi. Har bir himoyalangan
so'rovda ushbu modul orqali qayta tekshiriladi (yoki bir marta tekshirilib,
o'rniga backend JWT beriladi — quyida shu yondashuv ishlatilgan).

Telegram rasmiy algoritmi (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
  1. secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token)
  2. data_check_string = initData'dagi barcha juftliklar (hash'dan tashqari),
     kalit bo'yicha alfavit tartibida saralangan, "key=value" ko'rinishida,
     "\n" bilan qo'shilgan
  3. computed_hash = HMAC_SHA256(key=secret_key, msg=data_check_string).hexdigest()
  4. computed_hash == hash (constant-time compare)
  5. auth_date eskirib qolmaganligi tekshiriladi
"""

import hashlib
import hmac
import json
import time
import uuid
from dataclasses import dataclass
from urllib.parse import parse_qsl

import jwt
from fastapi import Header, HTTPException, status

from core.config import settings


class InitDataValidationError(Exception):
    """initData yaroqsiz, muddati o'tgan yoki soxta bo'lsa ko'tariladi."""


@dataclass
class TelegramUser:
    telegram_id: int
    first_name: str
    last_name: str | None
    username: str | None
    language_code: str | None


def _build_data_check_string(pairs: list[tuple[str, str]]) -> str:
    filtered = [(k, v) for k, v in pairs if k != "hash"]
    filtered.sort(key=lambda kv: kv[0])
    return "\n".join(f"{k}={v}" for k, v in filtered)


def verify_init_data(init_data: str, bot_token: str, max_age_seconds: int) -> TelegramUser:
    """initData satrini tekshiradi va undan Telegram foydalanuvchi ma'lumotini qaytaradi.

    Xato bo'lsa InitDataValidationError ko'taradi — chaqiruvchi buni 401'ga aylantiradi.
    """
    if not init_data:
        raise InitDataValidationError("initData bo'sh")

    pairs = parse_qsl(init_data, keep_blank_values=True, strict_parsing=False)
    pairs_dict = dict(pairs)

    received_hash = pairs_dict.get("hash")
    if not received_hash:
        raise InitDataValidationError("hash maydoni yo'q")

    data_check_string = _build_data_check_string(pairs)

    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        raise InitDataValidationError("HMAC mos kelmadi — initData soxta yoki buzilgan")

    auth_date_raw = pairs_dict.get("auth_date")
    if not auth_date_raw or not auth_date_raw.isdigit():
        raise InitDataValidationError("auth_date noto'g'ri")

    auth_date = int(auth_date_raw)
    age = time.time() - auth_date
    if age > max_age_seconds:
        raise InitDataValidationError("initData muddati o'tgan (auth_date eski)")
    if age < -60:  # kelajakdagi vaqt — soat noto'g'ri sozlangan yoki soxta
        raise InitDataValidationError("auth_date kelajakda — shubhali")

    user_raw = pairs_dict.get("user")
    if not user_raw:
        raise InitDataValidationError("user maydoni yo'q")

    try:
        user_json = json.loads(user_raw)
    except json.JSONDecodeError as exc:
        raise InitDataValidationError("user JSON noto'g'ri") from exc

    if "id" not in user_json:
        raise InitDataValidationError("user.id yo'q")

    return TelegramUser(
        telegram_id=int(user_json["id"]),
        first_name=user_json.get("first_name", ""),
        last_name=user_json.get("last_name"),
        username=user_json.get("username"),
        language_code=user_json.get("language_code"),
    )


# ---------------------------------------------------------------------------
# JWT (initData har bir so'rovda qayta tekshirilmasligi uchun — bir marta
# /auth/telegram orqali tekshiriladi, keyin qisqa umrli JWT beriladi)
# ---------------------------------------------------------------------------

def create_access_token(user_id: uuid.UUID, telegram_id: int) -> str:
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "tg_id": telegram_id,
        "iat": now,
        "exp": now + settings.jwt_expires_minutes * 60,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token yaroqsiz yoki muddati o'tgan",
        ) from exc


def get_bearer_token(authorization: str = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization: Bearer <token> header talab qilinadi",
        )
    return authorization.split(" ", 1)[1]


# ---------------------------------------------------------------------------
# Ichki servis (bot -> API) autentifikatsiyasi. Foydalanuvchi JWT'siga
# tayanmaydi — bot serverning o'zi so'rov yuboradi. `X-Internal-Api-Key`
# header'i `settings.internal_api_key` bilan constant-time solishtiriladi.
# ---------------------------------------------------------------------------

def require_internal_service(x_internal_api_key: str = Header(default=None)) -> None:
    if not x_internal_api_key or not hmac.compare_digest(x_internal_api_key, settings.internal_api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ichki servis autentifikatsiyasi muvaffaqiyatsiz",
        )
