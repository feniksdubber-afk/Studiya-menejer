import { apiClient } from "./client";
import type { Episode, Project, ProjectMember, ProjectRole, ProjectType, Season } from "@/types";

export async function listProjects(includeArchived = false): Promise<Project[]> {
  const { data } = await apiClient.get<Project[]>("/projects", {
    params: { include_archived: includeArchived },
  });
  return data;
}

export interface ProjectCreatePayload {
  title: string;
  type: ProjectType;
  poster_url?: string | null;
  anilist_id?: number | null;
}

export async function createProject(payload: ProjectCreatePayload): Promise<Project> {
  const { data } = await apiClient.post<Project>("/projects", payload);
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

export async function addProjectMember(
  projectId: string,
  userId: string,
  roleInProject: ProjectRole
): Promise<ProjectMember> {
  const { data } = await apiClient.post<ProjectMember>(`/projects/${projectId}/members`, {
    user_id: userId,
    role_in_project: roleInProject,
  });
  return data;
}

export async function listSeasons(projectId: string): Promise<Season[]> {
  const { data } = await apiClient.get<Season[]>(`/projects/${projectId}/seasons`);
  return data;
}

export interface SeasonCreatePayload {
  title: string;
  order_index?: number;
}

export async function createSeason(projectId: string, payload: SeasonCreatePayload): Promise<Season> {
  const { data } = await apiClient.post<Season>(`/projects/${projectId}/seasons`, payload);
  return data;
}

export async function listEpisodes(seasonId: string): Promise<Episode[]> {
  const { data } = await apiClient.get<Episode[]>(`/seasons/${seasonId}/episodes`);
  return data;
}

export interface EpisodeCreatePayload {
  title: string;
  order_index?: number;
}

export async function createEpisode(seasonId: string, payload: EpisodeCreatePayload): Promise<Episode> {
  const { data } = await apiClient.post<Episode>(`/seasons/${seasonId}/episodes`, payload);
  return data;
}

export async function getEpisode(episodeId: string): Promise<Episode> {
  const { data } = await apiClient.get<Episode>(`/episodes/${episodeId}`);
  return data;
}
