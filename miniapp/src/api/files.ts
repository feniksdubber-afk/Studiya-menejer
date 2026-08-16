import { apiClient } from "./client";
import type { TaskFile, TaskType } from "@/types";

// Joriy vazifaning ijrochi tomonidan topshirilgan eng so'nggi faylini
// oladi (mavjud bo'lmasa — null, hali topshirilmagan).
export async function getTaskSubmittedFile(taskId: string): Promise<TaskFile | null> {
  try {
    const { data } = await apiClient.get<TaskFile>(`/tasks/${taskId}/file`);
    return data;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

// Ish zanjiridagi oldingi bosqich natijasini oladi (masalan svedeniyachi
// uchun ovoz aktyorining fayli). `translation`/`voice` uchun oldingi
// bosqich original video hisoblanadi — bu funksiya emas,
// getOriginalVideoPlaybackUrl (api/originalVideo.ts) ishlatiladi.
export async function getUpstreamTaskFile(
  episodeId: string,
  taskType: TaskType,
  characterId?: string | null
): Promise<TaskFile | null> {
  try {
    const { data } = await apiClient.get<TaskFile>(`/episodes/${episodeId}/upstream-file`, {
      params: {
        task_type: taskType,
        character_id: characterId ?? undefined,
      },
    });
    return data;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}
