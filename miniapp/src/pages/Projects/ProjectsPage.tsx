import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listProjects } from "@/api/projects";

const TYPE_ICON: Record<string, string> = {
  anime: "🎌",
  series: "📺",
  movie: "🎬",
  cartoon: "🧸",
  other: "🎞",
};

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { data: projects, isLoading, isError } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(false),
  });

  if (isLoading) return <p className="p-5 text-sm text-tg-hint">Yuklanmoqda...</p>;
  if (isError) return <p className="p-5 text-sm text-red-600">Loyihalarni yuklab bo'lmadi.</p>;

  return (
    <div className="flex flex-col gap-4 p-5 pt-6 pb-20">
      <h1 className="text-lg font-semibold text-tg-text">Loyihalar</h1>

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
