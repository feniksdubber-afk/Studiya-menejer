import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createProject, listProjects } from "@/api/projects";
import { useAuth } from "@/auth/useAuth";
import type { ProjectType } from "@/types";

const TYPE_ICON: Record<string, string> = {
  anime: "🎌",
  series: "📺",
  movie: "🎬",
  cartoon: "🧸",
  other: "🎞",
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
  const canCreate = user?.role === "director" || user?.is_admin || user?.is_super_admin;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ProjectType>("anime");
  const [posterUrl, setPosterUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: projects, isLoading, isError } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(false),
  });

  const { mutate: submitProject, isPending } = useMutation({
    mutationFn: () =>
      createProject({
        title: title.trim(),
        type,
        poster_url: posterUrl.trim() || null,
      }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setIsFormOpen(false);
      setTitle("");
      setType("anime");
      setPosterUrl("");
      setError(null);
      navigate(`/projects/${project.id}`);
    },
    onError: () => {
      setError("Loyihani yaratib bo'lmadi. Qaytadan urinib ko'ring.");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Loyiha nomini kiriting.");
      return;
    }
    submitProject();
  }

  if (isLoading) return <p className="p-5 text-sm text-tg-hint">Yuklanmoqda...</p>;
  if (isError) return <p className="p-5 text-sm text-red-600">Loyihalarni yuklab bo'lmadi.</p>;

  return (
    <div className="flex flex-col gap-4 p-5 pt-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-tg-text">Loyihalar</h1>
        {canCreate && (
          <button
            onClick={() => {
              setIsFormOpen((open) => !open);
              setError(null);
            }}
            className="rounded-xl bg-tg-button px-3 py-1.5 text-sm font-medium text-tg-buttonText"
          >
            {isFormOpen ? "Bekor qilish" : "+ Yangi loyiha"}
          </button>
        )}
      </div>

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-2xl bg-tg-secondaryBg p-4"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-tg-hint">Loyiha nomi</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: Naruto"
              className="rounded-xl bg-tg-bg px-3 py-2 text-sm text-tg-text outline-none"
              maxLength={256}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-tg-hint">Turi</label>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType(option.value)}
                  className={`rounded-xl px-3 py-1.5 text-sm ${
                    type === option.value
                      ? "bg-tg-button text-tg-buttonText"
                      : "bg-tg-bg text-tg-text"
                  }`}
                >
                  {TYPE_ICON[option.value]} {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-tg-hint">Poster URL (ixtiyoriy)</label>
            <input
              value={posterUrl}
              onChange={(e) => setPosterUrl(e.target.value)}
              placeholder="https://..."
              className="rounded-xl bg-tg-bg px-3 py-2 text-sm text-tg-text outline-none"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

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
        <p className="text-sm text-tg-hint">Hozircha loyihalar yo'q.</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {projects?.map((project) => (
          <button
            key={project.id}
            onClick={() => navigate(`/projects/${project.id}`)}
            className="flex flex-col gap-2 rounded-2xl bg-tg-secondaryBg p-3 text-left"
          >
            <div className="flex aspect-[2/3] items-center justify-center rounded-xl bg-black/5 text-3xl">
              {project.poster_url ? (
                <img
                  src={project.poster_url}
                  alt={project.title}
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                TYPE_ICON[project.type] ?? "🎞"
              )}
            </div>
            <span className="line-clamp-2 text-sm font-medium text-tg-text">{project.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
