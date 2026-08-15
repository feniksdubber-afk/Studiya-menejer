from fastapi import FastAPI

from core.config import settings
from routers import auth, characters, internal, projects, tasks

app = FastAPI(title="AFSONA DUB API")

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(characters.router)
app.include_router(tasks.router)
app.include_router(internal.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/config")
async def public_config():
    """Ochiq (auth talab qilmaydigan) konfiguratsiya — hozircha faqat
    bot_username. Frontend bot username'ni qattiq yozib qo'ymasdan,
    shu endpointdan olib t.me/<username>?start=task_<id> deep-link quradi.
    """
    return {"bot_username": settings.bot_username}
