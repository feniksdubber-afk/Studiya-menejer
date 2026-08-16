from fastapi import FastAPI

from core.config import settings
from routers import anilist, auth, characters, files, internal, notifications, projects, tasks, users, voice_cues

app = FastAPI(title="AFSONA DUB API")

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(characters.router)
app.include_router(tasks.router)
app.include_router(internal.router)
app.include_router(anilist.router)
app.include_router(users.router)
app.include_router(notifications.router)
app.include_router(voice_cues.router)
app.include_router(files.router)


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
