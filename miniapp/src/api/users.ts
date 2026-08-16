import { apiClient } from "./client";
import type { User, UserRole, UserSearchResult } from "@/types";

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const { data } = await apiClient.get<UserSearchResult[]>("/users/search", { params: { q: query } });
  return data;
}

export async function updateMyRole(role: UserRole): Promise<User> {
  const { data } = await apiClient.patch<User>("/users/me/role", { role });
  return data;
}
