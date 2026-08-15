"""Bot API bilan bir xil PostgreSQL bazasiga ulanadi va bir xil
SQLAlchemy modellardan (api/models) qayta foydalanadi — ikkita alohida
model ta'rifini saqlab yurish xato ehtimolini oshiradi.

Model fayllari Docker build paytida shu image ichiga ham nusxalanadi
(bot/Dockerfile: COPY api/models/ /app/models/), shuning uchun import
qo'shimcha sys.path sozlashisiz to'g'ridan-to'g'ri ishlaydi.
"""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from config import DATABASE_URL

engine = create_async_engine(DATABASE_URL, pool_pre_ping=True, future=True)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)


def get_session() -> AsyncSession:
    return AsyncSessionLocal()
