"""Cloudflare R2 — FAQAT personaj rasmlari uchun (arxitektura hujjati §0, §6.1).
Video/audio/boshqa fayllar hech qachon bu yerga tushmaydi — ular uchun
Telegram file_id ishlatiladi (services/file_service.py).
"""
import uuid

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import ClientError

from core.config import settings

_CONTENT_TYPE = "image/webp"


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        config=BotoConfig(signature_version="s3v4"),
        region_name="auto",
    )


def build_object_key() -> str:
    """Har doim yangi tasodifiy nom — eski/yangi rasm kaliti hech qachon
    ustma-ust tushmaydi (keshlash muammolarining oldini oladi).

    Prefix "dub-characters/": bu R2 bucket AfsonaMovieBot bilan bo'lishilgan
    (afsona-videos), shu sababli AFSONA DUB o'z obyektlarini alohida prefix
    ostida saqlaydi — ikkala loyiha fayllari bir-biriga aralashmasligi uchun.
    """
    return f"dub-characters/{uuid.uuid4()}.webp"


def upload_webp(key: str, data: bytes) -> None:
    _client().put_object(
        Bucket=settings.r2_bucket_name,
        Key=key,
        Body=data,
        ContentType=_CONTENT_TYPE,
        CacheControl="public, max-age=31536000, immutable",
    )


def delete_object(key: str) -> None:
    if not key:
        return
    try:
        _client().delete_object(Bucket=settings.r2_bucket_name, Key=key)
    except ClientError:
        # O'chirilayotgan obyekt allaqachon yo'q bo'lsa ham DB tozalanishi
        # kerak — bu yerda xatoni yutib, chaqiruvchini bloklamaymiz.
        pass


def object_exists(key: str) -> bool:
    try:
        _client().head_object(Bucket=settings.r2_bucket_name, Key=key)
        return True
    except ClientError:
        return False


def public_url(key: str) -> str | None:
    if not key:
        return None
    base = settings.r2_public_base_url.rstrip("/")
    if not base:
        return None
    return f"{base}/{key}"
