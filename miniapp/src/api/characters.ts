import { apiClient } from "./client";
import type { CastType, Character, CharacterCast } from "@/types";

export async function listCharacters(projectId: string): Promise<Character[]> {
  const { data } = await apiClient.get<Character[]>(`/projects/${projectId}/characters`);
  return data;
}

export interface CharacterCreatePayload {
  name: string;
  anilist_original_name?: string | null;
  anilist_image_url?: string | null;
}

export async function createCharacter(
  projectId: string,
  payload: CharacterCreatePayload
): Promise<Character> {
  const { data } = await apiClient.post<Character>(`/projects/${projectId}/characters`, payload);
  return data;
}

export async function getCharacter(characterId: string): Promise<Character> {
  const { data } = await apiClient.get<Character>(`/characters/${characterId}`);
  return data;
}

export async function listCharacterCast(characterId: string): Promise<CharacterCast[]> {
  const { data } = await apiClient.get<CharacterCast[]>(`/characters/${characterId}/cast`);
  return data;
}

export async function addCharacterCast(
  characterId: string,
  userId: string,
  castType: CastType
): Promise<CharacterCast> {
  const { data } = await apiClient.post<CharacterCast>(`/characters/${characterId}/cast`, {
    user_id: userId,
    cast_type: castType,
  });
  return data;
}

export async function removeCharacterCast(characterId: string, castId: string): Promise<void> {
  await apiClient.delete(`/characters/${characterId}/cast/${castId}`);
}

export async function uploadCharacterImage(characterId: string, file: File): Promise<Character> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<Character>(
    `/characters/${characterId}/image`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

export async function deleteCharacterImage(characterId: string): Promise<Character> {
  const { data } = await apiClient.delete<Character>(`/characters/${characterId}/image`);
  return data;
}
