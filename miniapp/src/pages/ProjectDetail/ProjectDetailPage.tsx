import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  getProject,
  listProjectMembers,
  listSeasons,
  listEpisodes,
  createSeason,
  createEpisode,
  addProjectMember,
} from "@/api/projects";
import { listCharacters, createCharacter } from "@/api/characters";
import { getAniListCharacters, type AniListCharacter } from "@/api/anilist";
import { searchUsers } from "@/api/users";
import { useAuth } from "@/auth/useAuth";
import type { ProjectRole, Season, User } from "@/types";

type Tab = "seasons" | "characters" | "team";

const ROLE_OPTIONS: { value: ProjectRole; label: string }[] = [
  { value: "director_main", label: "Bosh rejissyor" },
  { value: "director_extra", label: "Yordamchi rejissyor" },
  { value: "translator_main", label: "Bosh tarjimon" },
  { value: "translator_extra", label: "Yordamchi tarjimon" },
  { value: "sound_main", label: "Bosh ovoz muharriri" },
  { value: "sound_extra", label: "Yordamchi ovoz muharriri" },
];

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
      <p className="text-sm font-medium text-tg-text">📁 {season.title}</p>
      <div className="flex flex-col gap-1 pl-4">
        {episodes?.map((ep) => (
          <button
            key={ep.id}
            onClick={() => navigate(`/episodes/${ep.id}`)}
            className="flex items-center justify-between rounded-xl bg-tg-secondaryBg px-3 py-2 text-left text-sm text-tg-text"
          >
            <span>🎞 {ep.title}</span>
            <span className="text-xs text-tg-hint">{ep.status}</span>
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
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [role, setRole] = useState<ProjectRole>("translator_main");

  const { mutate: submit, isPending, error } = useMutation({
    mutationFn: () => addProjectMember(projectId, selectedUser!.id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", projectId] });
      setIsOpen(false);
      setSelectedUser(null);
      setQuery("");
      setResults([]);
    },
  });

  async function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedUser(null);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    try {
      setResults(await searchUsers(value.trim()));
    } catch {
      setResults([]);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="self-start rounded-xl bg-tg-button px-3 py-1.5 text-sm font-medium text-tg-buttonText"
      >
        + A'zo qo'shish
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-tg-secondaryBg p-3">
      <input
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="Ism yoki username bo'yicha qidirish"
        autoFocus
        className="rounded-xl bg-tg-bg px-3 py-2 text-sm text-tg-text outline-none"
      />

      {results.length > 0 && (
        <div className="flex flex-col gap-1">
          {results.map((u) => (
            <button
              key={u.id}
              onClick={() => {
                setSelectedUser(u);
                setQuery(`${u.first_name}${u.telegram_username ? " @" + u.telegram_username : ""}`);
                setResults([]);
              }}
              className="rounded-lg px-2 py-1.5 text-left text-sm text-tg-text hover:bg-tg-bg"
            >
              {u.first_name} {u.telegram_username ? `@${u.telegram_username}` : ""}
            </button>
          ))}
        </div>
      )}

      {selectedUser && (
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRole(opt.value)}
              className={`rounded-lg px-2.5 py-1 text-xs ${
                role === opt.value ? "bg-tg-button text-tg-buttonText" : "bg-tg-bg text-tg-text"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500">A'zo qo'shib bo'lmadi.</p>}

      <button
        onClick={() => submit()}
        disabled={!selectedUser || isPending}
        className="rounded-xl bg-tg-button py-2 text-sm font-medium text-tg-buttonText disabled:opacity-60"
      >
        {isPending ? "Qo'shilmoqda..." : "Jamoaga qo'shish"}
      </button>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("seasons");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const canManage = user?.role === "director" || user?.is_admin || user?.is_super_admin;

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,
  });

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

  return (
    <div className="flex flex-col gap-4 p-5 pt-6 pb-20">
      <h1 className="text-lg font-semibold text-tg-text">{project?.title ?? "..."}</h1>

      <div className="flex gap-2 rounded-xl bg-tg-secondaryBg p-1">
        {(
          [
            ["seasons", "📁 Seasons"],
            ["characters", "🎭 Characters"],
            ["team", "👥 Team"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${
              tab === key ? "bg-tg-bg text-tg-text" : "text-tg-hint"
            }`}
          >
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
              {isImportOpen ? "Yopish" : "🎭 AniList'dan import qilish"}
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
        <div className="flex flex-col gap-3">
          {canManage && projectId && <AddMemberForm projectId={projectId} />}
          {members?.length ? (
            members.map((m) => (
              <div key={m.id} className="rounded-xl bg-tg-secondaryBg px-3 py-2 text-sm text-tg-text">
                {ROLE_OPTIONS.find((r) => r.value === m.role_in_project)?.label ?? m.role_in_project}
              </div>
            ))
          ) : (
            <p className="text-sm text-tg-hint">Jamoa a'zolari hali qo'shilmagan.</p>
          )}
        </div>
      )}
    </div>
  );
}
