from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from core.config import settings

# psycopg async driver: postgresql+psycopg://... ham async'ni qo'llab-quvvatlaydi (psycopg3)
engine = create_async_engine(settings.database_url, pool_pre_ping=True, future=True)

AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
