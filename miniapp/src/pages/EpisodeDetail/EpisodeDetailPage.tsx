import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { getEpisode } from "@/api/projects";
import { listEpisodeTasks } from "@/api/tasks";
import { TaskStatusBadge } from "@/components/TaskStatusBadge";
import { QueryError } from "@/components/StatusScreens";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";
import { Film } from "lucide-react";

const TASK_TYPE_LABEL: Record<string, string> = {
  translation: "Tarjima",
  voice: "Ovoz",
  sound_video: "Video montaj",
  sound_audio: "Audio montaj",
};

export default function EpisodeDetailPage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const navigate = useNavigate();
  useTelegramBackButton("/projects");

  const {
    data: episode,
    isLoading: isEpisodeLoading,
    isError: isEpisodeError,
    refetch: refetchEpisode,
  } = useQuery({
    queryKey: ["episode", episodeId],
    queryFn: () => getEpisode(episodeId!),
    enabled: !!episodeId,
  });

  const {
    data: tasks,
    isError: isTasksError,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ["episode-tasks", episodeId],
    queryFn: () => listEpisodeTasks(episodeId!),
    enabled: !!episodeId,
  });

  if (isEpisodeLoading) {
    return <p className="p-5 text-sm text-tg-hint">Yuklanmoqda...</p>;
  }

  if (isEpisodeError) {
    return (
      <div className="p-5">
        <QueryError message="Qismni yuklab bo'lmadi." onRetry={() => refetchEpisode()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5 pt-6 pb-20">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-tg-text">
          <Film size={18} aria-hidden="true" /> {episode?.title ?? "..."}
        </h1>
        {episode && <p className="font-mono text-xs text-tg-hint">{episode.status}</p>}
      </div>

      <div className="flex flex-col gap-2">
        {isTasksError ? (
          <QueryError message="Vazifalarni yuklab bo'lmadi." onRetry={() => refetchTasks()} />
        ) : tasks?.length ? (
          tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => navigate(`/tasks/${task.id}`)}
              className="flex items-center justify-between rounded-2xl bg-tg-secondaryBg p-4 text-left"
            >
              <span className="text-sm font-medium text-tg-text">
                {TASK_TYPE_LABEL[task.task_type] ?? task.task_type}
              </span>
              <TaskStatusBadge status={task.status} />
            </button>
          ))
        ) : (
          <p className="text-sm text-tg-hint">Vazifalar hali qo'shilmagan.</p>
        )}
      </div>
    </div>
  );
}
