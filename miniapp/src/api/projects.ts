import { apiClient } from "./client";
import type { Episode, Project, ProjectMember, Season } from "@/types";

export async function listProjects(includeArchived = false): Promise<Project[]> {
  const { data } = await apiClient.get<Project[]>("/projects", {
    params: { include_archived: includeArchived },
  });
  return data;
}

export async function getProject(projectId: string): Promise<Project> {
  const { data } = await apiClient.get<Project>(`/projects/${projectId}`);
  return data;
}

export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const { data } = await apiClient.get<ProjectMember[]>(`/projects/${projectId}/members`);
  return data;
}

export async function listSeasons(projectId: string): Promise<Season[]> {
  const { data } = await apiClient.get<Season[]>(`/projects/${projectId}/seasons`);
  return data;
}

export async function listEpisodes(seasonId: string): Promise<Episode[]> {
  const { data } = await apiClient.get<Episode[]>(`/seasons/${seasonId}/episodes`);
  return data;
}

export async function getEpisode(episodeId: string): Promise<Episode> {
  const { data } = await apiClient.get<Episode>(`/episodes/${episodeId}`);
  return data;
}
