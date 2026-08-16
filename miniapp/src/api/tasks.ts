import { apiClient } from "./client";
import type { DeadlineHistory, Task, TaskStatus, TaskType } from "@/types";

export interface TaskCreatePayload {
  task_type: TaskType;
  character_id?: string | null;
  assigned_to: string;
  deadline?: string | null;
}

export async function createTask(episodeId: string, payload: TaskCreatePayload): Promise<Task> {
  const { data } = await apiClient.post<Task>(`/episodes/${episodeId}/tasks`, payload);
  return data;
}

export async function listMyTasks(): Promise<Task[]> {
  const { data } = await apiClient.get<Task[]>("/tasks/mine");
  return data;
}

export async function listEpisodeTasks(episodeId: string): Promise<Task[]> {
  const { data } = await apiClient.get<Task[]>(`/episodes/${episodeId}/tasks`);
  return data;
}

export async function getTask(taskId: string): Promise<Task> {
  const { data } = await apiClient.get<Task>(`/tasks/${taskId}`);
  return data;
}

export interface TaskUpdatePayload {
  assigned_to?: string;
  character_id?: string | null;
  deadline?: string | null;
}

export async function updateTask(taskId: string, payload: TaskUpdatePayload): Promise<Task> {
  const { data } = await apiClient.patch<Task>(`/tasks/${taskId}`, payload);
  return data;
}

export async function setTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
  const { data } = await apiClient.post<Task>(`/tasks/${taskId}/status`, { status });
  return data;
}

export async function requestRevision(
  taskId: string,
  reason: string,
  newDeadline?: string
): Promise<Task> {
  const { data } = await apiClient.post<Task>(`/tasks/${taskId}/request-revision`, {
    reason,
    new_deadline: newDeadline ?? null,
  });
  return data;
}

export async function getDeadlineHistory(taskId: string): Promise<DeadlineHistory[]> {
  const { data } = await apiClient.get<DeadlineHistory[]>(`/tasks/${taskId}/deadline-history`);
  return data;
}
