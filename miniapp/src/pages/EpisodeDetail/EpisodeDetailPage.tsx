import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { getEpisode } from "@/api/projects";
import { listEpisodeTasks } from "@/api/tasks";
import { TaskStatusBadge } from "@/components/TaskStatusBadge";

const TASK_TYPE_LABEL: Record<string, string> = {
  translation: "Tarjima",
  voice: "Ovoz",
  sound_video: "Video montaj",
  sound_audio: "Audio montaj",
};

export default function EpisodeDetailPage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const navigate = useNavigate();

  const { data: episode } = useQuery({
    queryKey: ["episode", episodeId],
    queryFn: () => getEpisode(episodeId!),
    enabled: !!episodeId,
  });

  const { data: tasks } = useQuery({
    queryKey: ["episode-tasks", episodeId],
    queryFn: () => listEpisodeTasks(episodeId!),
    enabled: !!episodeId,
  });

  return (
    <div className="flex flex-col gap-4 p-5 pt-6 pb-20">
      <div>
        <h1 className="text-lg font-semibold text-tg-text">🎞 {episode?.title ?? "..."}</h1>
        {episode && <p className="text-xs text-tg-hint">{episode.status}</p>}
      </div>

      <div className="flex flex-col gap-2">
        {tasks?.length ? (
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
