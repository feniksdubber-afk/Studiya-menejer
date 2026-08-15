import { apiClient } from "./client";
import type { Character, CharacterCast } from "@/types";

export async function listCharacters(projectId: string): Promise<Character[]> {
  const { data } = await apiClient.get<Character[]>(`/projects/${projectId}/characters`);
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
