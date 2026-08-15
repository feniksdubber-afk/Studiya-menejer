import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from models.tasks import TaskStatus, TaskType


class TaskCreate(BaseModel):
    task_type: TaskType
    character_id: uuid.UUID | None = None  # voice tasklar uchun majburiy (routerda tekshiriladi)
    assigned_to: uuid.UUID
    deadline: datetime | None = None


class TaskUpdate(BaseModel):
    assigned_to: uuid.UUID | None = None
    character_id: uuid.UUID | None = None
    deadline: datetime | None = None


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


class TaskRevisionRequest(BaseModel):
    reason: str = Field(min_length=1)
    new_deadline: datetime | None = None


class TaskOut(BaseModel):
    id: uuid.UUID
    episode_id: uuid.UUID
    task_type: TaskType
    character_id: uuid.UUID | None
    assigned_to: uuid.UUID
    assigned_by: uuid.UUID | None
    assigned_at: datetime
    status: TaskStatus
    current_version: int
    deadline: datetime | None
    revision_reason: str | None
    created_at: datetime
    updated_at: datetime

    # Joriy foydalanuvchi shu vazifa bo'yicha imtiyozli amallarni
    # (qabul qilish / qayta ishlashga qaytarish) bajara oladimi — admin,
    # super_admin yoki shu loyihaning director_main/director_extra a'zosi.
    can_manage: bool = False

    model_config = {"from_attributes": True}


class DeadlineHistoryOut(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    old_deadline: datetime | None
    new_deadline: datetime | None
    reason: str | None
    changed_at: datetime

    model_config = {"from_attributes": True}


class OverdueMarkResult(BaseModel):
    """`/internal/tasks/mark-overdue` javobi — bot scheduleri natijani
    log qilishi uchun (masalan nechta task 'delayed'ga o'tkazilgani)."""

    marked_count: int
    task_ids: list[uuid.UUID]
