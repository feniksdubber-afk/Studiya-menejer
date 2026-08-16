import { apiClient } from "./client";
import type { User, UserRole } from "@/types";

export async function searchUsers(query: string): Promise<User[]> {
  const { data } = await apiClient.get<User[]>("/users/search", { params: { q: query } });
  return data;
}

export async function updateMyRole(role: UserRole): Promise<User> {
  const { data } = await apiClient.patch<User>("/users/me/role", { role });
  return data;
}
