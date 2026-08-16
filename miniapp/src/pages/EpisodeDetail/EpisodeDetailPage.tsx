import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { getEpisode } from "@/api/projects";
import { listEpisodeTasks } from "@/api/tasks";
import { TaskStatusBadge, EpisodeStatusBadge } from "@/components/TaskStatusBadge";
import { QueryError, LoadingScreen } from "@/components/StatusScreens";
import { EmptyState } from "@/components/EmptyState";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";
import { Film, ClipboardList, Theater } from "lucide-react";

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
    isLoading: isTasksLoading,
    isError: isTasksError,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ["episode-tasks", episodeId],
    queryFn: () => listEpisodeTasks(episodeId!),
    enabled: !!episodeId,
  });

  if (isEpisodeLoading) {
    return <LoadingScreen />;
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
        {episode && <EpisodeStatusBadge status={episode.status} />}
      </div>

      {episode && (
        <button
          onClick={() => navigate(`/episodes/${episode.id}/studio`)}
          className="flex items-center justify-between rounded-2xl bg-role-director-50 p-4 text-left active:opacity-70"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-role-director-800">
            <Theater size={17} aria-hidden="true" /> Rollar (Video Studio)
          </span>
          <span className="text-role-director-600">→</span>
        </button>
      )}

      <div className="flex flex-col gap-2">
        {isTasksError ? (
          <QueryError message="Vazifalarni yuklab bo'lmadi." onRetry={() => refetchTasks()} />
        ) : isTasksLoading ? (
          <div className="flex flex-col gap-2">
            <div className="h-14 animate-pulse rounded-2xl bg-tg-secondaryBg" />
            <div className="h-14 animate-pulse rounded-2xl bg-tg-secondaryBg" />
          </div>
        ) : tasks?.length ? (
          tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => navigate(`/tasks/${task.id}`)}
              className="flex items-center justify-between rounded-2xl bg-tg-secondaryBg p-4 text-left active:opacity-70"
            >
              <span className="text-sm font-medium text-tg-text">
                {TASK_TYPE_LABEL[task.task_type] ?? task.task_type}
              </span>
              <TaskStatusBadge status={task.status} />
            </button>
          ))
        ) : (
          <EmptyState icon={ClipboardList} message="Vazifalar hali qo'shilmagan." />
        )}
      </div>
    </div>
  );
}
