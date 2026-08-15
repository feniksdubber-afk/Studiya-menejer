import { apiClient } from "./client";

export interface AniListSearchResult {
  anilist_id: number;
  title: string;
  title_romaji: string | null;
  title_native: string | null;
  poster_url: string | null;
  format: string | null;
  year: number | null;
}

export interface AniListCharacter {
  anilist_character_id: number;
  name: string;
  native_name: string | null;
  image_url: string | null;
  role: string | null;
}

export async function searchAniList(query: string): Promise<AniListSearchResult[]> {
  const { data } = await apiClient.get<AniListSearchResult[]>("/anilist/search", {
    params: { q: query },
  });
  return data;
}

export async function getAniListCharacters(anilistId: number): Promise<AniListCharacter[]> {
  // Katta anime (yuzlab personaj) bir necha AniList sahifasini ketma-ket
  // so'rashi mumkin — standart 20s timeout yetmasligi mumkin.
  const { data } = await apiClient.get<AniListCharacter[]>(`/anilist/${anilistId}/characters`, {
    timeout: 45_000,
  });
  return data;
}
