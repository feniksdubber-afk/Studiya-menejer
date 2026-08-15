import { apiClient } from "./client";
import type { User } from "@/types";

export async function searchUsers(query: string): Promise<User[]> {
  const { data } = await apiClient.get<User[]>("/users/search", { params: { q: query } });
  return data;
}
