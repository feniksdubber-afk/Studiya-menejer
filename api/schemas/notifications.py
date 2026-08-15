import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: str
    payload: dict
    is_read: bool
    created_at: datetime


class UnreadCountOut(BaseModel):
    unread_count: int
