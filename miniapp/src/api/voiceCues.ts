import { apiClient } from "./client";
import type { VoiceCue, VoiceCueStatus } from "@/types";

export interface VoiceCueListFilters {
  characterId?: string;
  actorId?: string;
  status?: VoiceCueStatus;
  createdByMe?: boolean;
}

export async function listEpisodeCues(
  episodeId: string,
  filters: VoiceCueListFilters = {}
): Promise<VoiceCue[]> {
  const { data } = await apiClient.get<VoiceCue[]>(`/episodes/${episodeId}/voice-cues`, {
    params: {
      character_id: filters.characterId,
      actor_id: filters.actorId,
      status_filter: filters.status,
      created_by_me: filters.createdByMe || undefined,
    },
  });
  return data;
}

export async function listMyCues(episodeId?: string): Promise<VoiceCue[]> {
  const { data } = await apiClient.get<VoiceCue[]>("/voice-cues/mine", {
    params: { episode_id: episodeId },
  });
  return data;
}

export interface VoiceCueCreatePayload {
  screenshot: Blob;
  timestampSeconds: number;
  characterId?: string | null;
  tempLabel?: string | null;
  actorId?: string | null;
  directorNote?: string | null;
}

function buildCueForm(payload: VoiceCueCreatePayload): FormData {
  const form = new FormData();
  form.append("screenshot", payload.screenshot, "cue.webp");
  form.append("timestamp_seconds", String(Math.round(payload.timestampSeconds)));
  if (payload.characterId) form.append("character_id", payload.characterId);
  if (payload.tempLabel) form.append("temp_label", payload.tempLabel);
  if (payload.actorId) form.append("actor_id", payload.actorId);
  if (payload.directorNote) form.append("director_note", payload.directorNote);
  return form;
}

export async function createVoiceCue(
  episodeId: string,
  payload: VoiceCueCreatePayload
): Promise<VoiceCue> {
  const { data } = await apiClient.post<VoiceCue>(
    `/episodes/${episodeId}/voice-cues`,
    buildCueForm(payload),
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

export interface VoiceCueUpdatePayload {
  timestamp_seconds?: number;
  character_id?: string | null;
  temp_label?: string | null;
  actor_id?: string | null;
  director_note?: string | null;
}

export async function updateVoiceCue(
  cueId: string,
  payload: VoiceCueUpdatePayload
): Promise<VoiceCue> {
  const { data } = await apiClient.patch<VoiceCue>(`/voice-cues/${cueId}`, payload);
  return data;
}

export async function markCueRecorded(cueId: string): Promise<VoiceCue> {
  const { data } = await apiClient.patch<VoiceCue>(`/voice-cues/${cueId}/status`, {
    status: "recorded",
  });
  return data;
}

export async function deleteVoiceCue(cueId: string): Promise<void> {
  await apiClient.delete(`/voice-cues/${cueId}`);
}

export async function duplicateVoiceCue(
  cueId: string,
  screenshot: Blob,
  timestampSeconds: number
): Promise<VoiceCue> {
  const form = new FormData();
  form.append("screenshot", screenshot, "cue.webp");
  form.append("timestamp_seconds", String(Math.round(timestampSeconds)));
  const { data } = await apiClient.post<VoiceCue>(`/voice-cues/${cueId}/duplicate`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
