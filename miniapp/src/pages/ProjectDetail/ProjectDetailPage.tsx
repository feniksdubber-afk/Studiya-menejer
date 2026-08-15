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
  createEpisode,
  addProjectMember,
  removeProjectMember,
} from "@/api/projects";
import { listCharacters, createCharacter } from "@/api/characters";
import { getAniListCharacters, type AniListCharacter } from "@/api/anilist";
import { Avatar } from "@/components/Avatar";
import { QueryError } from "@/components/StatusScreens";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";
import { useDebouncedUserSearch } from "@/hooks/useDebouncedUserSearch";
import { useToast } from "@/components/Toast";
import { Clapperboard, Languages, Mic2, AudioWaveform, Folder, Users, Film } from "lucide-react";
import type { ProjectMember, ProjectRole, Season, User } from "@/types";

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

function SeasonBlock({ season, canManage }: { season: Season; canManage: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAddingEpisode, setIsAddingEpisode] = useState(false);
  const [episodeTitle, setEpisodeTitle] = useState("");

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
  });

  function handleAddEpisode(e: FormEvent) {
    e.preventDefault();
    if (!episodeTitle.trim()) return;
    submitEpisode();
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-tg-text">
        <Folder size={15} className="text-tg-hint" aria-hidden="true" /> {season.title}
      </p>
      <div className="flex flex-col gap-1 pl-4">
        {episodes?.map((ep) => (
          <button
            key={ep.id}
            onClick={() => navigate(`/episodes/${ep.id}`)}
            className="flex items-center justify-between rounded-xl bg-tg-secondaryBg px-3 py-2 text-left text-sm text-tg-text"
          >
            <span className="flex items-center gap-1.5">
              <Film size={14} className="text-tg-hint" aria-hidden="true" /> {ep.title}
            </span>
            <span className="font-mono text-xs text-tg-hint">{ep.status}</span>
          </button>
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
        <p className="text-xs text-red-500">
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
          ✕
        </button>
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

  const { data: seasons } = useQuery({
    queryKey: ["seasons", projectId],
    queryFn: () => listSeasons(projectId!),
    enabled: !!projectId && tab === "seasons",
  });

  const { data: characters } = useQuery({
    queryKey: ["characters", projectId],
    queryFn: () => listCharacters(projectId!),
    enabled: !!projectId && tab === "characters",
  });

  const { data: members } = useQuery({
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
    return <p className="p-5 text-sm text-tg-hint">Yuklanmoqda...</p>;
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
      <h1 className="text-lg font-semibold text-tg-text">{project.title}</h1>

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
          {seasons?.length ? (
            seasons.map((season) => (
              <SeasonBlock key={season.id} season={season} canManage={!!canManage} />
            ))
          ) : (
            <p className="text-sm text-tg-hint">Sezonlar hali qo'shilmagan.</p>
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
              {isLoadingAniList && <p className="text-sm text-tg-hint">Yuklanmoqda...</p>}
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
            {characters?.length ? (
              characters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/characters/${c.id}`)}
                  className="flex flex-col items-center gap-1"
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
              <p className="col-span-3 text-sm text-tg-hint">Personajlar hali qo'shilmagan.</p>
            )}
          </div>
        </div>
      )}

      {tab === "team" && (
        <div className="flex flex-col gap-4">
          {canManage && projectId && <AddMemberForm projectId={projectId} />}

          {members?.length ? (
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
            <p className="text-sm text-tg-hint">Jamoa a'zolari hali qo'shilmagan.</p>
          )}
        </div>
      )}
    </div>
  );
}
