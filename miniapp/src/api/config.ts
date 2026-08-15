import { apiClient } from "./client";

export interface PublicConfig {
  bot_username: string;
}

export async function getPublicConfig(): Promise<PublicConfig> {
  const { data } = await apiClient.get<PublicConfig>("/config");
  return data;
}
