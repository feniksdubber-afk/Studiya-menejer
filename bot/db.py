"""Bot API bilan bir xil PostgreSQL bazasiga ulanadi va bir xil
SQLAlchemy modellardan (api/models) qayta foydalanadi — ikkita alohida
model ta'rifini saqlab yurish xato ehtimolini oshiradi.
"""
import os
import sys

# Monorepo ildiziga yo'l qo'shamiz, shunda `api.models` import qilinadi
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402

from config import DATABASE_URL  # noqa: E402

engine = create_async_engine(DATABASE_URL, pool_pre_ping=True, future=True)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)


def get_session() -> AsyncSession:
    return AsyncSessionLocal()
