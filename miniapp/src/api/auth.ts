import { apiClient } from "./client";
import type { AuthResponse } from "@/types";

export async function authWithTelegram(initData: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/telegram", {
    init_data: initData,
  });
  return data;
}
