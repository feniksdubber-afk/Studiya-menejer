// Backend api/schemas/*.py bilan bir xil shaklda ushlab turiladi.
// Enum qiymatlari backend models/*.py dagi ENUM'lar bilan so'zma-so'z mos bo'lishi shart.

export type UserRole = "director" | "translator" | "voice_actor" | "sound_editor";
export type DirectorStatus = "none" | "pending" | "approved" | "rejected";

export interface User {
  id: string;
  telegram_id: number;
  first_name: string;
  last_name: string | null;
  telegram_username: string | null;
  phone_number: string | null;
  role: UserRole | null;
  director_status: DirectorStatus;
  is_admin: boolean;
  is_super_admin: boolean;
}

// `/users/search` javobi — backend shaxsiy/imtiyozli maydonlarni
// (phone_number, telegram_id, is_admin va h.k.) qaytarmaydi, chunki bu
// endpoint istalgan ro'yxatdan o'tgan foydalanuvchiga ochiq (jamoaga
// a'zo qo'shishda ishlatiladi — qarang: api/schemas/auth.py:UserSearchResult).
export interface UserSearchResult {
  id: string;
  first_name: string;
  last_name: string | null;
  telegram_username: string | null;
  role: UserRole | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  is_new_user: boolean;
  user: User;
}

export type ProjectType = "anime" | "series" | "movie" | "cartoon" | "other";

export interface Project {
  id: string;
  title: string;
  type: ProjectType;
  poster_url: string | null;
  anilist_id: number | null;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  // Joriy foydalanuvchi AYNAN shu loyihada boshqarish huquqiga egami
  // (admin/super_admin yoki shu loyihaning director_main/director_extra
  // a'zosi). Global user.role emas — backend har bir loyiha uchun
  // alohida hisoblab qaytaradi.
  can_manage: boolean;
}

export type ProjectRole =
  | "director_main"
  | "director_extra"
  | "translator_main"
  | "translator_extra"
  | "voice_actor_main"
  | "voice_actor_extra"
  | "sound_main"
  | "sound_extra";

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role_in_project: ProjectRole;
  added_at: string;
  user: CastMemberUser;
}

export interface Season {
  id: string;
  project_id: string;
  title: string;
  order_index: number;
  anilist_season_id: number | null;
}

export type EpisodeStatus = "not_started" | "in_progress" | "revision" | "ready" | "delayed";

export interface Episode {
  id: string;
  season_id: string;
  project_id: string;
  title: string;
  order_index: number;
  status: EpisodeStatus;
  created_at: string;
}

export type ImageSource = "anilist" | "custom";
export type CastType = "main" | "alternate";
export type AniListCharacterRole = "main" | "supporting" | "background";

export interface Character {
  id: string;
  project_id: string;
  name: string;
  anilist_original_name: string | null;
  anilist_image_url: string | null;
  anilist_role: AniListCharacterRole | null;
  custom_image_key: string | null;
  image_source: ImageSource;
  is_active: boolean;
  created_by: string;
  created_at: string;
  display_image_url: string | null;
  can_manage: boolean;
}

export interface CastMemberUser {
  id: string;
  first_name: string;
  last_name: string | null;
  telegram_username: string | null;
}

export interface CharacterCast {
  id: string;
  character_id: string;
  user_id: string;
  cast_type: CastType;
  user: CastMemberUser;
}

export type TaskType = "translation" | "voice" | "sound_video" | "sound_audio";
export type TaskStatus = "pending" | "submitted" | "revision_requested" | "accepted" | "delayed";

export interface Task {
  id: string;
  episode_id: string;
  task_type: TaskType;
  character_id: string | null;
  assigned_to: string;
  assigned_by: string | null;
  assigned_at: string;
  status: TaskStatus;
  current_version: number;
  deadline: string | null;
  revision_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joriy foydalanuvchi shu vazifani qabul qilishi/qayta ishlashga
  // qaytarishi mumkinmi (admin yoki shu loyihaning rejissyori).
  can_manage: boolean;
}

export interface DeadlineHistory {
  id: string;
  task_id: string;
  old_deadline: string | null;
  new_deadline: string | null;
  reason: string | null;
  changed_at: string;
}

export type NotificationType =
  | "task_assigned"
  | "task_submitted"
  | "task_revision_requested"
  | "task_delayed"
  | "deadline_soon"
  | string;

export interface Notification {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

// ==================== VOICE CUES ("Rollar" / Video Studio) ====================

export type VoiceCueStatus = "pending" | "assigned" | "recorded";

export interface VoiceCueCharacterBrief {
  id: string;
  name: string;
}

export interface VoiceCueActorBrief {
  id: string;
  first_name: string;
  last_name: string | null;
  telegram_username: string | null;
}

export interface VoiceCue {
  id: string;
  episode_id: string;
  timestamp_seconds: number;
  screenshot_url: string | null;
  character: VoiceCueCharacterBrief | null;
  temp_label: string | null;
  actor: VoiceCueActorBrief | null;
  director_note: string | null;
  status: VoiceCueStatus;
  order_index: number;
  created_by: string;
  created_at: string;
}

// ==================== ORIGINAL VIDEO (Video Studio pleeri) ====================

export interface OriginalVideo {
  id: string;
  episode_id: string | null;
  current_name: string;
  mime_type: string | null;
  file_size: number | null;
  owner_id: string;
  created_at: string;
}

export interface OriginalVideoPlayback {
  video_url: string;
  expires_in: number;
}
