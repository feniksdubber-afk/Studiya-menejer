import { apiClient } from "./client";
import type { OriginalVideo, OriginalVideoPlayback } from "@/types";

export async function getOriginalVideoPlaybackUrl(
  episodeId: string
): Promise<OriginalVideoPlayback | null> {
  try {
    const { data } = await apiClient.get<OriginalVideoPlayback>(
      `/episodes/${episodeId}/original-video`
    );
    return data;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

export async function requestOriginalVideoUploadUrl(
  episodeId: string,
  fileName: string,
  mimeType: string
): Promise<{ upload_url: string; r2_key: string; expires_in: number }> {
  const { data } = await apiClient.post(`/episodes/${episodeId}/original-video/upload-url`, {
    file_name: fileName,
    mime_type: mimeType,
  });
  return data;
}

export async function confirmOriginalVideoUpload(
  episodeId: string,
  r2Key: string,
  fileName: string,
  mimeType: string
): Promise<OriginalVideo> {
  const { data } = await apiClient.post<OriginalVideo>(
    `/episodes/${episodeId}/original-video/confirm`,
    { r2_key: r2Key, file_name: fileName, mime_type: mimeType }
  );
  return data;
}

export async function deleteOriginalVideo(episodeId: string): Promise<void> {
  await apiClient.delete(`/episodes/${episodeId}/original-video`);
}

// Presigned R2 URL'ga to'g'ridan-to'g'ri, apiClient orqali emas (backend
// proxy qilmasligi kerak — V1 rejasiga qarang). Progress uchun XHR ishlatamiz,
// fetch progress eventini bermaydi.
export function uploadVideoToR2(
  uploadUrl: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`R2 yuklash xatosi: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Tarmoq xatosi — video yuklab bo'lmadi"));
    xhr.send(file);
  });
}

export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024;
