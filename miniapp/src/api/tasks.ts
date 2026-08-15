import { apiClient } from "./client";
import type { DeadlineHistory, Task, TaskStatus } from "@/types";

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
