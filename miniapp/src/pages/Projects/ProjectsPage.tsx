import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import WebApp from "@twa-dev/sdk";
import axios from "axios";
import { createProject, listProjects } from "@/api/projects";
import { searchAniList, type AniListSearchResult } from "@/api/anilist";
import { useAuth } from "@/auth/useAuth";
import { useToast } from "@/components/Toast";
import { QueryError, LoadingScreen } from "@/components/StatusScreens";
import { EmptyState } from "@/components/EmptyState";
import { Sparkles, Tv, Clapperboard, Ghost, Film, Plus, X } from "lucide-react";
import type { ProjectType } from "@/types";

const TYPE_ICON: Record<string, typeof Sparkles> = {
  anime: Sparkles,
  series: Tv,
  movie: Clapperboard,
  cartoon: Ghost,
  other: Film,
};

const TYPE_OPTIONS: { value: ProjectType; label: string }[] = [
  { value: "anime", label: "Anime" },
  { value: "series", label: "Serial" },
  { value: "movie", label: "Film" },
  { value: "cartoon", label: "Multfilm" },
  { value: "other", label: "Boshqa" },
];

export default function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const canCreate = user?.role === "director" || user?.is_admin || user?.is_super_admin;
  // Komponent instansiyasiga bog'liq debounce vaqtlagichi — modul darajasidagi
  // global o'zgaruvchidan farqli, boshqa instansiyalar bilan holat almashib
  // ketmaydi.
  const searchDebounceTimer = useRef<ReturnType<typeof setTimeout>>();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ProjectType>("anime");
  const [posterUrl, setPosterUrl] = useState("");
  const [anilistId, setAnilistId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AniListSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const {
    data: projects,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(false),
  });

  const { mutate: submitProject, isPending } = useMutation({
    mutationFn: () =>
      createProject({
        title: title.trim(),
        type,
        poster_url: posterUrl.trim() || null,
        anilist_id: anilistId,
      }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      WebApp.HapticFeedback.notificationOccurred("success");
      showSuccess("Loyiha yaratildi.");
      resetForm();
      navigate(`/projects/${project.id}`);
    },
    onError: () => {
      WebApp.HapticFeedback.notificationOccurred("error");
      setError("Loyihani yaratib bo'lmadi. Qaytadan urinib ko'ring.");
      showError("Loyihani yaratib bo'lmadi.");
    },
  });

  function resetForm() {
    setIsFormOpen(false);
    setTitle("");
    setType("anime");
    setPosterUrl("");
    setAnilistId(null);
    setError(null);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setAnilistId(null);
    setSearchError(null);
    clearTimeout(searchDebounceTimer.current);

    if (value.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    searchDebounceTimer.current = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const results = await searchAniList(value.trim());
        setSearchResults(results);
        if (results.length === 0) {
          setSearchError("Hech narsa topilmadi.");
        }
      } catch (err) {
        setSearchResults([]);
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 502) {
            setSearchError("AniList bilan bog'lanib bo'lmadi. Birozdan so'ng qaytadan urinib ko'ring.");
          } else if (err.response?.status === 401) {
            setSearchError("Sessiya muddati tugagan. Ilovani qayta oching.");
          } else if (err.code === "ECONNABORTED" || !err.response) {
            setSearchError("Tarmoq xatosi. Internet aloqasini tekshiring.");
          } else {
            setSearchError("Qidiruvda xatolik yuz berdi.");
          }
        } else {
          setSearchError("Qidiruvda xatolik yuz berdi.");
        }
      } finally {
        setIsSearching(false);
      }
    }, 400);
  }

  function handleSelectAniList(result: AniListSearchResult) {
    setTitle(result.title);
    setPosterUrl(result.poster_url ?? "");
    setAnilistId(result.anilist_id);
    setSearchQuery(result.title);
    setSearchResults([]);
    setSearchError(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Loyiha nomini kiriting.");
      return;
    }
    submitProject();
  }

  if (isLoading) return <LoadingScreen />;
  if (isError) {
    return (
      <div className="p-5">
        <QueryError message="Loyihalarni yuklab bo'lmadi." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5 pt-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-tg-text">Loyihalar</h1>
        {canCreate && (
          <button
            onClick={() => {
              if (isFormOpen) {
                resetForm();
              } else {
                setIsFormOpen(true);
              }
            }}
            className="flex items-center gap-1 rounded-xl bg-tg-button px-3 py-1.5 text-sm font-medium text-tg-buttonText"
          >
            {isFormOpen ? (
              <>
                <X size={14} aria-hidden="true" /> Bekor qilish
              </>
            ) : (
              <>
                <Plus size={14} aria-hidden="true" /> Yangi loyiha
              </>
            )}
          </button>
        )}
      </div>

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-2xl bg-tg-secondaryBg p-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="project-anilist-search" className="text-xs text-tg-hint">AniList'dan qidirish (ixtiyoriy)</label>
            <input
              id="project-anilist-search"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Masalan: Naruto"
              className="rounded-xl bg-tg-bg px-3 py-2 text-sm text-tg-text outline-none"
              autoFocus
            />
            {isSearching && <p className="text-xs text-tg-hint">Qidirilmoqda...</p>}
            {!isSearching && searchError && (
              <p className="text-xs text-role-voice-800 dark:text-role-voice-400">{searchError}</p>
            )}
            {searchResults.length > 0 && (
              <div className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-xl bg-tg-bg p-1.5">
                {searchResults.map((result) => (
                  <button
                    key={result.anilist_id}
                    type="button"
                    onClick={() => handleSelectAniList(result)}
                    className="flex items-center gap-2 rounded-lg p-1.5 text-left hover:bg-tg-secondaryBg"
                  >
                    {result.poster_url ? (
                      <img
                        src={result.poster_url}
                        alt={result.title}
                        className="h-12 w-9 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-9 items-center justify-center rounded-md bg-black/10">
                        <Film size={16} className="text-tg-hint" aria-hidden="true" />
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm text-tg-text">{result.title}</span>
                      <span className="text-xs text-tg-hint">
                        {[result.format, result.year].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {anilistId !== null && (
              <p className="font-mono text-xs text-tg-hint">AniList'dan tanlandi (ID: {anilistId})</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="project-title" className="text-xs text-tg-hint">Loyiha nomi</label>
            <input
              id="project-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: Naruto"
              className="rounded-xl bg-tg-bg px-3 py-2 text-sm text-tg-text outline-none"
              maxLength={256}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-tg-hint">Turi</label>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((option) => {
                const Icon = TYPE_ICON[option.value];
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setType(option.value)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm ${
                      type === option.value
                        ? "bg-tg-button text-tg-buttonText"
                        : "bg-tg-bg text-tg-text"
                    }`}
                  >
                    <Icon size={14} aria-hidden="true" /> {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="project-poster-url" className="text-xs text-tg-hint">Poster URL (ixtiyoriy)</label>
            <input
              id="project-poster-url"
              value={posterUrl}
              onChange={(e) => setPosterUrl(e.target.value)}
              placeholder="https://..."
              className="rounded-xl bg-tg-bg px-3 py-2 text-sm text-tg-text outline-none"
            />
          </div>

          {error && <p className="text-xs text-role-voice-800 dark:text-role-voice-400">{error}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-tg-button py-2 text-sm font-medium text-tg-buttonText disabled:opacity-60"
          >
            {isPending ? "Yaratilmoqda..." : "Loyihani yaratish"}
          </button>
        </form>
      )}

      {(!projects || projects.length === 0) && (
        <EmptyState icon={Clapperboard} message="Hozircha loyihalar yo'q." />
      )}

      <div className="grid grid-cols-2 gap-3">
        {projects?.map((project) => {
          const TypeIcon = TYPE_ICON[project.type] ?? Film;
          return (
            <button
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="flex flex-col gap-2 rounded-2xl bg-tg-secondaryBg p-3 text-left active:opacity-70"
            >
              <div className="flex aspect-[2/3] items-center justify-center rounded-xl bg-black/5">
                {project.poster_url ? (
                  <img
                    src={project.poster_url}
                    alt={project.title}
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  <TypeIcon size={28} className="text-tg-hint" aria-hidden="true" />
                )}
              </div>
              <span className="line-clamp-2 text-sm font-medium text-tg-text">{project.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
