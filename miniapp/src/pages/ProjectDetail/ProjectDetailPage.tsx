import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import WebApp from "@twa-dev/sdk";
import {
  getProject,
  listProjectMembers,
  listSeasons,
  listEpisodes,
  createSeason,
  updateSeason,
  deleteSeason,
  createEpisode,
  updateEpisode,
  deleteEpisode,
  addProjectMember,
  removeProjectMember,
  updateProject,
  archiveProject,
  unarchiveProject,
} from "@/api/projects";
import { listCharacters, createCharacter } from "@/api/characters";
import { getAniListCharacters, type AniListCharacter } from "@/api/anilist";
import { Avatar } from "@/components/Avatar";
import { QueryError, LoadingScreen } from "@/components/StatusScreens";
import { EmptyState } from "@/components/EmptyState";
import { EpisodeStatusBadge } from "@/components/TaskStatusBadge";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";
import { useDebouncedUserSearch } from "@/hooks/useDebouncedUserSearch";
import { useToast } from "@/components/Toast";
import { Clapperboard, Languages, Mic2, AudioWaveform, Folder, Users, Film, Pencil, Trash2, Check, X, Loader2, Archive, ArchiveRestore, Image } from "lucide-react";
import type { Episode, Project, ProjectMember, ProjectRole, Season, User } from "@/types";

type Tab = "seasons" | "characters" | "team";
type RoleCategory = "director" | "translator" | "voice_actor" | "sound";

// Rol -> (yorliq, kategoriya). Kategoriya Team tab'ida bo'limlarga
// guruhlash va rangli badge tanlash uchun ishlatiladi.
const ROLE_META: Record<ProjectRole, { label: string; category: RoleCategory }> = {
  director_main: { label: "Bosh rejissyor", category: "director" },
  director_extra: { label: "Yordamchi rejissyor", category: "director" },
  translator_main: { label: "Bosh tarjimon", category: "translator" },
  translator_extra: { label: "Yordamchi tarjimon", category: "translator" },
  voice_actor_main: { label: "Ovoz aktyori", category: "voice_actor" },
  voice_actor_extra: { label: "Zaxira ovoz aktyori", category: "voice_actor" },
  sound_main: { label: "Bosh ovoz muharriri", category: "sound" },
  sound_extra: { label: "Yordamchi ovoz muharriri", category: "sound" },
};

const CATEGORY_META: Record<
  RoleCategory,
  { title: string; icon: typeof Clapperboard; badgeClass: string }
> = {
  director: { title: "Rejissyorlar", icon: Clapperboard, badgeClass: "bg-role-director-50 text-role-director-800 dark:bg-role-director-900/50 dark:text-role-director-400" },
  translator: { title: "Tarjimonlar", icon: Languages, badgeClass: "bg-role-translator-50 text-role-translator-800 dark:bg-role-translator-900/50 dark:text-role-translator-400" },
  voice_actor: { title: "Ovoz aktyorlari", icon: Mic2, badgeClass: "bg-role-voice-50 text-role-voice-800 dark:bg-role-voice-900/50 dark:text-role-voice-400" },
  sound: { title: "Svedeniyachilar", icon: AudioWaveform, badgeClass: "bg-role-sound-50 text-role-sound-800 dark:bg-role-sound-900/50 dark:text-role-sound-400" },
};

const CATEGORY_ORDER: RoleCategory[] = ["director", "translator", "voice_actor", "sound"];

const ROLE_OPTIONS: { value: ProjectRole; label: string }[] = (
  Object.keys(ROLE_META) as ProjectRole[]
).map((value) => ({ value, label: ROLE_META[value].label }));

function EpisodeRow({
  episode,
  canManage,
}: {
  episode: Episode;
  canManage: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(episode.title);

  const { mutate: rename, isPending: isRenaming } = useMutation({
    mutationFn: () => updateEpisode(episode.id, { title: title.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["episodes", episode.season_id] });
      setIsEditing(false);
    },
    onError: () => {
      WebApp.HapticFeedback.notificationOccurred("error");
      showError("Qism nomini o'zgartirib bo'lmadi.");
    },
  });

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteEpisode(episode.id),
    onSuccess: () => {
      WebApp.HapticFeedback.notificationOccurred("success");
      showSuccess("Qism o'chirildi.");
      queryClient.invalidateQueries({ queryKey: ["episodes", episode.season_id] });
    },
    onError: () => {
      WebApp.HapticFeedback.notificationOccurred("error");
      showError("Qismni o'chirib bo'lmadi.");
    },
  });

  function handleDelete() {
    WebApp.showConfirm(`"${episode.title}" qismini o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.`, (ok) => {
      if (ok) remove();
    });
  }

  function handleSaveRename(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || title.trim() === episode.title) {
      setIsEditing(false);
      setTitle(episode.title);
      return;
    }
    rename();
  }

  if (isEditing) {
    return (
      <form onSubmit={handleSaveRename} className="flex items-center gap-1.5 rounded-xl bg-tg-secondaryBg px-2 py-1.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          className="flex-1 rounded-lg bg-tg-bg px-2 py-1 text-sm text-tg-text outline-none"
        />
        <button
          type="submit"
          disabled={isRenaming}
          aria-label="Saqlash"
          className="shrink-0 rounded-full p-1 text-role-sound-800 active:bg-tg-bg disabled:opacity-40"
        >
          <Check size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => {
            setIsEditing(false);
            setTitle(episode.title);
          }}
          aria-label="Bekor qilish"
          className="shrink-0 rounded-full p-1 text-tg-hint active:bg-tg-bg"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-xl bg-tg-secondaryBg px-1 py-1">
      <button
        onClick={() => navigate(`/episodes/${episode.id}`)}
        className="flex flex-1 items-center justify-between gap-2 px-2 py-1 text-left text-sm text-tg-text active:opacity-70"
      >
        <span className="flex items-center gap-1.5 truncate">
          <Film size={14} className="shrink-0 text-tg-hint" aria-hidden="true" /> {episode.title}
        </span>
        <EpisodeStatusBadge status={episode.status} />
      </button>
      {canManage && (
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            aria-label="Qism nomini o'zgartirish"
            className="rounded-full p-1.5 text-tg-hint active:bg-tg-bg"
          >
            <Pencil size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label="Qismni o'chirish"
            className="rounded-full p-1.5 text-tg-hint active:bg-tg-bg disabled:opacity-40"
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

function SeasonBlock({ season, canManage }: { season: Season; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [isAddingEpisode, setIsAddingEpisode] = useState(false);
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [isEditingSeason, setIsEditingSeason] = useState(false);
  const [seasonTitle, setSeasonTitle] = useState(season.title);

  const { data: episodes } = useQuery({
    queryKey: ["episodes", season.id],
    queryFn: () => listEpisodes(season.id),
  });

  const { mutate: submitEpisode, isPending } = useMutation({
    mutationFn: () =>
      createEpisode(season.id, { title: episodeTitle.trim(), order_index: episodes?.length ?? 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["episodes", season.id] });
      setEpisodeTitle("");
      setIsAddingEpisode(false);
    },
    onError: () => {
      WebApp.HapticFeedback.notificationOccurred("error");
      showError("Qismni qo'shib bo'lmadi.");
    },
  });

  const { mutate: renameSeason, isPending: isRenamingSeason } = useMutation({
    mutationFn: () => updateSeason(season.id, { title: seasonTitle.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasons", season.project_id] });
      setIsEditingSeason(false);
    },
    onError: () => {
      WebApp.HapticFeedback.notificationOccurred("error");
      showError("Sezon nomini o'zgartirib bo'lmadi.");
    },
  });

  const { mutate: removeSeason, isPending: isDeletingSeason } = useMutation({
    mutationFn: () => deleteSeason(season.id),
    onSuccess: () => {
      WebApp.HapticFeedback.notificationOccurred("success");
      showSuccess("Sezon o'chirildi.");
      queryClient.invalidateQueries({ queryKey: ["seasons", season.project_id] });
    },
    onError: () => {
      WebApp.HapticFeedback.notificationOccurred("error");
      showError("Sezonni o'chirib bo'lmadi.");
    },
  });

  function handleAddEpisode(e: FormEvent) {
    e.preventDefault();
    if (!episodeTitle.trim()) return;
    submitEpisode();
  }

  function handleSaveSeasonRename(e: FormEvent) {
    e.preventDefault();
    if (!seasonTitle.trim() || seasonTitle.trim() === season.title) {
      setIsEditingSeason(false);
      setSeasonTitle(season.title);
      return;
    }
    renameSeason();
  }

  function handleDeleteSeason() {
    // Sezonni o'chirish barcha qismlarini ham o'chiradi (CASCADE, qarang:
    // api/routers/projects.py:delete_season) — shuning uchun oddiy
    // haptic-only tasdiqlash yetarli emas, ochiq matnli tasdiq talab qilinadi.
    WebApp.showConfirm(
      `"${season.title}" sezonini butun qismlari bilan o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.`,
      (ok) => {
        if (ok) removeSeason();
      }
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {isEditingSeason ? (
        <form onSubmit={handleSaveSeasonRename} className="flex items-center gap-1.5">
          <Folder size={15} className="shrink-0 text-tg-hint" aria-hidden="true" />
          <input
            value={seasonTitle}
            onChange={(e) => setSeasonTitle(e.target.value)}
            autoFocus
            className="flex-1 rounded-lg bg-tg-secondaryBg px-2 py-1 text-sm text-tg-text outline-none"
          />
          <button
            type="submit"
            disabled={isRenamingSeason}
            aria-label="Saqlash"
            className="shrink-0 rounded-full p-1 text-role-sound-800 active:bg-tg-secondaryBg disabled:opacity-40"
          >
            <Check size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsEditingSeason(false);
              setSeasonTitle(season.title);
            }}
            aria-label="Bekor qilish"
            className="shrink-0 rounded-full p-1 text-tg-hint active:bg-tg-secondaryBg"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-1.5">
          <p className="flex flex-1 items-center gap-1.5 truncate text-sm font-medium text-tg-text">
            <Folder size={15} className="shrink-0 text-tg-hint" aria-hidden="true" /> {season.title}
          </p>
          {canManage && (
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => setIsEditingSeason(true)}
                aria-label="Sezon nomini o'zgartirish"
                className="rounded-full p-1.5 text-tg-hint active:bg-tg-secondaryBg"
              >
                <Pencil size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleDeleteSeason}
                disabled={isDeletingSeason}
                aria-label="Sezonni o'chirish"
                className="rounded-full p-1.5 text-tg-hint active:bg-tg-secondaryBg disabled:opacity-40"
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1 pl-4">
        {episodes?.map((ep) => (
          <EpisodeRow key={ep.id} episode={ep} canManage={canManage} />
        ))}

        {canManage && (
          <div className="pl-0">
            {isAddingEpisode ? (
              <form onSubmit={handleAddEpisode} className="flex gap-2 pt-1">
                <input
                  value={episodeTitle}
                  onChange={(e) => setEpisodeTitle(e.target.value)}
                  placeholder="Qism nomi"
                  autoFocus
                  className="flex-1 rounded-lg bg-tg-secondaryBg px-2 py-1.5 text-sm text-tg-text outline-none"
                />
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-tg-button px-2.5 py-1.5 text-xs font-medium text-tg-buttonText disabled:opacity-60"
                >
                  {isPending ? "..." : "Qo'shish"}
                </button>
              </form>
            ) : (
              <button
                onClick={() => setIsAddingEpisode(true)}
                className="pt-1 text-xs text-tg-button"
              >
                + Qism qo'shish
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AddSeasonForm({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");

  const { data: seasons } = useQuery({
    queryKey: ["seasons", projectId],
    queryFn: () => listSeasons(projectId),
  });

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () => createSeason(projectId, { title: title.trim(), order_index: seasons?.length ?? 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasons", projectId] });
      setTitle("");
      setIsOpen(false);
    },
    onError: () => {
      WebApp.HapticFeedback.notificationOccurred("error");
      showError("Sezonni qo'shib bo'lmadi.");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    submit();
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="self-start rounded-xl bg-tg-button px-3 py-1.5 text-sm font-medium text-tg-buttonText"
      >
        + Sezon qo'shish
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 rounded-2xl bg-tg-secondaryBg p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Masalan: 1-fasl"
        autoFocus
        className="flex-1 rounded-xl bg-tg-bg px-3 py-2 text-sm text-tg-text outline-none"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-xl bg-tg-button px-3 py-2 text-sm font-medium text-tg-buttonText disabled:opacity-60"
      >
        {isPending ? "..." : "Saqlash"}
      </button>
    </form>
  );
}

function AddMemberForm({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [role, setRole] = useState<ProjectRole>("translator_main");
  const {
    query,
    setQuery,
    results,
    setResults,
    isSearching,
    handleQueryChange: rawHandleQueryChange,
    reset: resetSearch,
  } = useDebouncedUserSearch();

  const { mutate: submit, isPending, error, reset: resetMutation } = useMutation({
    mutationFn: () => addProjectMember(projectId, selectedUser!.id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", projectId] });
      WebApp.HapticFeedback.notificationOccurred("success");
      showSuccess("Jamoaga qo'shildi.");
      resetForm();
    },
    onError: () => {
      WebApp.HapticFeedback.notificationOccurred("error");
      showError("A'zoni qo'shib bo'lmadi.");
    },
  });

  function resetForm() {
    setIsOpen(false);
    setSelectedUser(null);
    setRole("translator_main");
    resetSearch();
    resetMutation();
  }

  function handleQueryChange(value: string) {
    setSelectedUser(null);
    rawHandleQueryChange(value);
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="self-start rounded-xl bg-tg-button px-3.5 py-2 text-sm font-medium text-tg-buttonText shadow-sm active:opacity-80"
      >
        + A'zo qo'shish
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-tg-secondaryBg p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="project-member-search" className="text-xs font-medium text-tg-hint">Foydalanuvchini qidirish</label>
        <input
          id="project-member-search"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Ism yoki @username"
          autoFocus
          className="rounded-xl bg-tg-bg px-3 py-2.5 text-sm text-tg-text outline-none ring-1 ring-transparent focus:ring-tg-button/40"
        />
        {isSearching && <p className="text-xs text-tg-hint">Qidirilmoqda...</p>}
      </div>

      {results.length > 0 && (
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-xl bg-tg-bg p-1.5">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                setSelectedUser(u);
                setQuery(`${u.first_name}${u.telegram_username ? " @" + u.telegram_username : ""}`);
                setResults([]);
              }}
              className="flex items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-tg-secondaryBg"
            >
              <Avatar firstName={u.first_name} lastName={u.last_name} size="sm" />
              <div className="flex flex-col">
                <span className="text-sm text-tg-text">
                  {u.first_name} {u.last_name ?? ""}
                </span>
                {u.telegram_username && (
                  <span className="text-xs text-tg-hint">@{u.telegram_username}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedUser && (
        <div className="flex items-center gap-2.5 rounded-xl bg-tg-button/10 p-2.5">
          <Avatar firstName={selectedUser.first_name} lastName={selectedUser.last_name} size="sm" />
          <span className="text-sm font-medium text-tg-text">
            {selectedUser.first_name} {selectedUser.last_name ?? ""}
          </span>
        </div>
      )}

      {selectedUser && (
        <div className="flex flex-col gap-2.5">
          <label className="text-xs font-medium text-tg-hint">Rolni tanlang</label>
          {CATEGORY_ORDER.map((cat) => {
            const meta = CATEGORY_META[cat];
            const options = ROLE_OPTIONS.filter((opt) => ROLE_META[opt.value].category === cat);
            return (
              <div key={cat} className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1 text-[11px] font-medium text-tg-hint">
                  <meta.icon size={12} aria-hidden="true" /> {meta.title}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRole(opt.value)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        role === opt.value
                          ? "bg-tg-button text-tg-buttonText"
                          : "bg-tg-bg text-tg-text"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <p className="text-xs text-role-voice-800 dark:text-role-voice-400">
          A'zo qo'shib bo'lmadi{selectedUser ? " — foydalanuvchi allaqachon jamoada bo'lishi mumkin." : "."}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={resetForm}
          className="flex-1 rounded-xl bg-tg-bg py-2.5 text-sm font-medium text-tg-hint"
        >
          Bekor qilish
        </button>
        <button
          onClick={() => submit()}
          disabled={!selectedUser || isPending}
          className="flex-[2] rounded-xl bg-tg-button py-2.5 text-sm font-medium text-tg-buttonText shadow-sm disabled:opacity-50"
        >
          {isPending ? "Qo'shilmoqda..." : "Jamoaga qo'shish"}
        </button>
      </div>
    </div>
  );
}

function MemberRow({
  member,
  canManage,
  onRemove,
  isRemoving,
}: {
  member: ProjectMember;
  canManage: boolean;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const meta = ROLE_META[member.role_in_project];
  const categoryMeta = CATEGORY_META[meta.category];
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-tg-secondaryBg p-3">
      <Avatar firstName={member.user.first_name} lastName={member.user.last_name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-tg-text">
          {member.user.first_name} {member.user.last_name ?? ""}
        </span>
        {member.user.telegram_username && (
          <span className="truncate text-xs text-tg-hint">@{member.user.telegram_username}</span>
        )}
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${categoryMeta.badgeClass}`}>
        {meta.label}
      </span>
      {canManage && (
        <button
          type="button"
          onClick={onRemove}
          disabled={isRemoving}
          aria-label="A'zoni olib tashlash"
          className="shrink-0 rounded-full p-1.5 text-tg-hint active:bg-tg-bg disabled:opacity-40"
        >
          <X size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function ProjectHeader({
  project,
  canManage,
}: {
  project: Project;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [posterUrl, setPosterUrl] = useState(project.poster_url ?? "");

  function resetFields() {
    setTitle(project.title);
    setPosterUrl(project.poster_url ?? "");
  }

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: () =>
      updateProject(project.id, {
        title: title.trim(),
        poster_url: posterUrl.trim() ? posterUrl.trim() : null,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["project", project.id], updated);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      showSuccess("Loyiha yangilandi.");
      setIsEditing(false);
    },
    onError: () => {
      WebApp.HapticFeedback.notificationOccurred("error");
      showError("Loyihani yangilab bo'lmadi.");
    },
  });

  const { mutate: toggleArchive, isPending: isTogglingArchive } = useMutation({
    mutationFn: () =>
      project.is_archived ? unarchiveProject(project.id) : archiveProject(project.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(["project", project.id], updated);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      WebApp.HapticFeedback.notificationOccurred("success");
      showSuccess(updated.is_archived ? "Loyiha arxivlandi." : "Loyiha arxivdan qaytarildi.");
    },
    onError: () => {
      WebApp.HapticFeedback.notificationOccurred("error");
      showError("Amalni bajarib bo'lmadi.");
    },
  });

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      resetFields();
      setIsEditing(false);
      return;
    }
    if (title.trim() === project.title && posterUrl.trim() === (project.poster_url ?? "")) {
      setIsEditing(false);
      return;
    }
    save();
  }

  function handleToggleArchive() {
    const message = project.is_archived
      ? `"${project.title}" loyihasini arxivdan qaytarmoqchimisiz?`
      : `"${project.title}" loyihasini arxivlamoqchimisiz? Loyiha ro'yxatda ko'rinmay qoladi, lekin ma'lumotlar saqlanib qoladi.`;
    WebApp.showConfirm(message, (ok) => {
      if (ok) toggleArchive();
    });
  }

  if (isEditing) {
    return (
      <form onSubmit={handleSave} className="flex flex-col gap-2 rounded-2xl bg-tg-secondaryBg p-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-tg-hint">Loyiha nomi</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="rounded-lg bg-tg-bg px-2.5 py-1.5 text-sm text-tg-text outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-tg-hint">Poster URL</span>
          <input
            value={posterUrl}
            onChange={(e) => setPosterUrl(e.target.value)}
            placeholder="https://..."
            className="rounded-lg bg-tg-bg px-2.5 py-1.5 text-sm text-tg-text outline-none"
          />
        </label>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-1 rounded-xl bg-tg-button px-3 py-1.5 text-sm font-medium text-tg-buttonText disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
            Saqlash
          </button>
          <button
            type="button"
            onClick={() => {
              resetFields();
              setIsEditing(false);
            }}
            className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm text-tg-hint active:bg-tg-bg"
          >
            <X size={14} aria-hidden="true" />
            Bekor qilish
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-lg font-semibold text-tg-text">{project.title}</h1>
          {project.is_archived && (
            <span className="shrink-0 rounded-full bg-tg-secondaryBg px-2 py-0.5 text-[11px] font-medium text-tg-hint">
              Arxivlangan
            </span>
          )}
        </div>
        {project.poster_url && (
          <span className="flex items-center gap-1 truncate text-xs text-tg-hint">
            <Image size={12} className="shrink-0" aria-hidden="true" />
            {project.poster_url}
          </span>
        )}
      </div>
      {canManage && (
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            aria-label="Loyihani tahrirlash"
            className="rounded-full p-1.5 text-tg-hint active:bg-tg-secondaryBg"
          >
            <Pencil size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleToggleArchive}
            disabled={isTogglingArchive}
            aria-label={project.is_archived ? "Arxivdan qaytarish" : "Arxivlash"}
            className="rounded-full p-1.5 text-tg-hint active:bg-tg-secondaryBg disabled:opacity-40"
          >
            {isTogglingArchive ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : project.is_archived ? (
              <ArchiveRestore size={15} aria-hidden="true" />
            ) : (
              <Archive size={15} aria-hidden="true" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<Tab>("seasons");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  useTelegramBackButton("/projects");

  const {
    data: project,
    isLoading: isProjectLoading,
    isError: isProjectError,
    refetch: refetchProject,
  } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,
  });

  // MUHIM: bu global user.role emas — backend har bir loyiha uchun
  // alohida hisoblaydi (shu loyihaning director_main/extra a'zosimi
  // yoki admin/super_admin). Shu tufayli boshqa loyihada rejissyor
  // bo'lgan, lekin bu yerda oddiy a'zo bo'lgan foydalanuvchiga
  // boshqaruv tugmalari ko'rsatilmaydi.
  const canManage = project?.can_manage ?? false;

  const { data: seasons, isLoading: isSeasonsLoading } = useQuery({
    queryKey: ["seasons", projectId],
    queryFn: () => listSeasons(projectId!),
    enabled: !!projectId && tab === "seasons",
  });

  const { data: characters, isLoading: isCharactersLoading } = useQuery({
    queryKey: ["characters", projectId],
    queryFn: () => listCharacters(projectId!),
    enabled: !!projectId && tab === "characters",
  });

  const { data: members, isLoading: isMembersLoading } = useQuery({
    queryKey: ["members", projectId],
    queryFn: () => listProjectMembers(projectId!),
    enabled: !!projectId && tab === "team",
  });

  const {
    mutate: removeMember,
    variables: removingMemberVars,
    isPending: isRemovingMember,
  } = useMutation({
    mutationFn: ({ projectId: pid, memberId }: { projectId: string; memberId: string }) =>
      removeProjectMember(pid, memberId),
    // Optimistik yangilanish: a'zoni ro'yxatdan darhol olib tashlaymiz,
    // server javobini kutib turmasdan — xato bo'lsa oldingi holatga qaytaramiz.
    onMutate: async ({ memberId }) => {
      await queryClient.cancelQueries({ queryKey: ["members", projectId] });
      const previous = queryClient.getQueryData<ProjectMember[]>(["members", projectId]);
      queryClient.setQueryData<ProjectMember[]>(["members", projectId], (old) =>
        old?.filter((m) => m.id !== memberId)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["members", projectId], context.previous);
      }
      showError("A'zoni olib tashlab bo'lmadi.");
    },
    onSuccess: () => {
      showSuccess("A'zo jamoadan olib tashlandi.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["members", projectId] });
    },
  });
  // MUHIM: `isPending` bilan birga tekshirilmasa, mutatsiya xato bilan
  // tugaganda (masalan tarmoq uzilishi) tugma abadiy disabled bo'lib qoladi —
  // qarang: CharacterDetailPage.tsx'dagi xuddi shu naqsh.
  const removingMemberId = isRemovingMember ? removingMemberVars?.memberId ?? null : null;

  const { data: aniListCharacters, isLoading: isLoadingAniList } = useQuery({
    queryKey: ["anilist-characters", project?.anilist_id],
    queryFn: () => getAniListCharacters(project!.anilist_id!),
    enabled: isImportOpen && !!project?.anilist_id,
  });

  const { mutate: importSelected, isPending: isImporting } = useMutation({
    mutationFn: async () => {
      const toImport = (aniListCharacters ?? []).filter((c) =>
        selectedIds.has(c.anilist_character_id)
      );
      for (const c of toImport) {
        await createCharacter(projectId!, {
          name: c.name,
          anilist_original_name: c.native_name,
          anilist_image_url: c.image_url,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters", projectId] });
      setIsImportOpen(false);
      setSelectedIds(new Set());
    },
    onError: () => {
      // Ba'zi personajlar allaqachon yaratilgan bo'lishi mumkin (sikl
      // o'rtasida to'xtagan) — shuning uchun ro'yxatni yangilaymiz, lekin
      // tanlovni tozalamaymiz, foydalanuvchi qaysi biri o'tmaganini ko'rib
      // qayta urinishi mumkin bo'lsin.
      queryClient.invalidateQueries({ queryKey: ["characters", projectId] });
      WebApp.HapticFeedback.notificationOccurred("error");
      showError("Ba'zi personajlarni import qilib bo'lmadi. Qaytadan urinib ko'ring.");
    },
  });

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const existingNames = new Set((characters ?? []).map((c) => c.anilist_original_name ?? c.name));

  if (isProjectLoading) {
    return <LoadingScreen />;
  }

  if (isProjectError || !project) {
    return (
      <div className="p-5">
        <QueryError message="Loyihani yuklab bo'lmadi." onRetry={() => refetchProject()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5 pt-6 pb-20">
      <ProjectHeader project={project} canManage={!!canManage} />

      <div className="flex gap-2 rounded-xl bg-tg-secondaryBg p-1">
        {(
          [
            ["seasons", "Sezonlar", Folder],
            ["characters", "Personajlar", Film],
            ["team", "Jamoa", Users],
          ] as [Tab, string, typeof Folder][]
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium ${
              tab === key ? "bg-tg-bg text-tg-text" : "text-tg-hint"
            }`}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {tab === "seasons" && (
        <div className="flex flex-col gap-4">
          {canManage && projectId && <AddSeasonForm projectId={projectId} />}
          {isSeasonsLoading ? (
            <div className="flex flex-col gap-2">
              <div className="h-20 animate-pulse rounded-2xl bg-tg-secondaryBg" />
              <div className="h-20 animate-pulse rounded-2xl bg-tg-secondaryBg" />
            </div>
          ) : seasons?.length ? (
            seasons.map((season) => (
              <SeasonBlock key={season.id} season={season} canManage={!!canManage} />
            ))
          ) : (
            <EmptyState icon={Folder} message="Sezonlar hali qo'shilmagan." />
          )}
        </div>
      )}

      {tab === "characters" && (
        <div className="flex flex-col gap-3">
          {canManage && project?.anilist_id && (
            <button
              onClick={() => setIsImportOpen((open) => !open)}
              className="self-start rounded-xl bg-tg-button px-3 py-1.5 text-sm font-medium text-tg-buttonText"
            >
              {isImportOpen ? "Yopish" : "AniList'dan import qilish"}
            </button>
          )}

          {isImportOpen && (
            <div className="flex flex-col gap-2 rounded-2xl bg-tg-secondaryBg p-3">
              {isLoadingAniList && (
                <p className="flex items-center gap-1.5 text-sm text-tg-hint">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Yuklanmoqda...
                </p>
              )}
              {!isLoadingAniList && aniListCharacters?.length === 0 && (
                <p className="text-sm text-tg-hint">AniList'da personajlar topilmadi.</p>
              )}
              <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto">
                {aniListCharacters?.map((c: AniListCharacter) => {
                  const alreadyAdded = existingNames.has(c.native_name ?? c.name);
                  const selected = selectedIds.has(c.anilist_character_id);
                  return (
                    <button
                      key={c.anilist_character_id}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => toggleSelected(c.anilist_character_id)}
                      className={`flex flex-col items-center gap-1 rounded-xl p-1.5 ${
                        selected ? "bg-tg-button/20" : ""
                      } ${alreadyAdded ? "opacity-40" : ""}`}
                    >
                      <div
                        className={`h-14 w-14 overflow-hidden rounded-full bg-tg-bg ${
                          selected ? "ring-2 ring-tg-button" : ""
                        }`}
                      >
                        {c.image_url && (
                          <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <span className="line-clamp-1 text-xs text-tg-text">{c.name}</span>
                      {alreadyAdded && <span className="text-[10px] text-tg-hint">qo'shilgan</span>}
                    </button>
                  );
                })}
              </div>
              {(aniListCharacters?.length ?? 0) > 0 && (
                <button
                  onClick={() => importSelected()}
                  disabled={selectedIds.size === 0 || isImporting}
                  className="rounded-xl bg-tg-button py-2 text-sm font-medium text-tg-buttonText disabled:opacity-60"
                >
                  {isImporting
                    ? "Import qilinmoqda..."
                    : `Tanlanganlarni qo'shish (${selectedIds.size})`}
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {isCharactersLoading ? (
              <>
                <div className="h-16 w-16 animate-pulse rounded-full bg-tg-secondaryBg" />
                <div className="h-16 w-16 animate-pulse rounded-full bg-tg-secondaryBg" />
                <div className="h-16 w-16 animate-pulse rounded-full bg-tg-secondaryBg" />
              </>
            ) : characters?.length ? (
              characters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/characters/${c.id}`)}
                  className="flex flex-col items-center gap-1 active:opacity-70"
                >
                  <div className="h-16 w-16 overflow-hidden rounded-full bg-tg-secondaryBg">
                    {c.display_image_url && (
                      <img src={c.display_image_url} alt={c.name} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <span className="line-clamp-1 text-xs text-tg-text">{c.name}</span>
                </button>
              ))
            ) : (
              <div className="col-span-3">
                <EmptyState icon={Film} message="Personajlar hali qo'shilmagan." />
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "team" && (
        <div className="flex flex-col gap-4">
          {canManage && projectId && <AddMemberForm projectId={projectId} />}

          {isMembersLoading ? (
            <div className="flex flex-col gap-2">
              <div className="h-16 animate-pulse rounded-2xl bg-tg-secondaryBg" />
              <div className="h-16 animate-pulse rounded-2xl bg-tg-secondaryBg" />
            </div>
          ) : members?.length ? (
            CATEGORY_ORDER.map((cat) => {
              const meta = CATEGORY_META[cat];
              const group = members.filter((m) => ROLE_META[m.role_in_project].category === cat);
              if (group.length === 0) return null;
              return (
                <section key={cat} className="flex flex-col gap-2">
                  <h2 className="flex items-center gap-1.5 text-sm font-medium text-tg-hint">
                    <meta.icon size={14} aria-hidden="true" /> {meta.title} · {group.length}
                  </h2>
                  <div className="flex flex-col gap-2">
                    {group.map((m) => (
                      <MemberRow
                        key={m.id}
                        member={m}
                        canManage={!!canManage}
                        isRemoving={removingMemberId === m.id}
                        onRemove={() => {
                          if (projectId) removeMember({ projectId, memberId: m.id });
                        }}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          ) : (
            <EmptyState icon={Users} message="Jamoa a'zolari hali qo'shilmagan." />
          )}
        </div>
      )}
    </div>
  );
}
