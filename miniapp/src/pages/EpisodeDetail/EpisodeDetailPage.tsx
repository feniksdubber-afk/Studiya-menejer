import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { getEpisode, getProject, listProjectMembers } from "@/api/projects";
import { listEpisodeTasks, createTask } from "@/api/tasks";
import { listCharacters } from "@/api/characters";
import { TaskStatusBadge, EpisodeStatusBadge } from "@/components/TaskStatusBadge";
import { QueryError, LoadingScreen } from "@/components/StatusScreens";
import { EmptyState } from "@/components/EmptyState";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";
import { useToast } from "@/components/Toast";
import { Film, ClipboardList, Theater, Plus, X } from "lucide-react";
import type { TaskType } from "@/types";

const TASK_TYPE_LABEL: Record<string, string> = {
  translation: "Tarjima",
  voice: "Ovoz",
  sound_video: "Video montaj",
  sound_audio: "Audio montaj",
};

const TASK_TYPE_OPTIONS: TaskType[] = ["translation", "voice", "sound_video", "sound_audio"];

export default function EpisodeDetailPage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  useTelegramBackButton("/projects");

  const [isFormOpen, setFormOpen] = useState(false);
  const [taskType, setTaskType] = useState<TaskType>("translation");
  const [characterId, setCharacterId] = useState<string>("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");

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

  const { data: project } = useQuery({
    queryKey: ["project", episode?.project_id],
    queryFn: () => getProject(episode!.project_id),
    enabled: !!episode?.project_id,
  });

  const { data: members } = useQuery({
    queryKey: ["project-members", episode?.project_id],
    queryFn: () => listProjectMembers(episode!.project_id),
    enabled: !!episode?.project_id && isFormOpen,
  });

  const { data: characters } = useQuery({
    queryKey: ["characters", episode?.project_id],
    queryFn: () => listCharacters(episode!.project_id),
    enabled: !!episode?.project_id && isFormOpen && taskType === "voice",
  });

  const { mutate: submitTask, isPending: isSubmitting } = useMutation({
    mutationFn: () =>
      createTask(episodeId!, {
        task_type: taskType,
        character_id: taskType === "voice" ? characterId || null : null,
        assigned_to: assignedTo,
        deadline: deadline ? new Date(deadline).toISOString() : null,
      }),
    onSuccess: () => {
      showSuccess("Vazifa qo'shildi.");
      queryClient.invalidateQueries({ queryKey: ["episode-tasks", episodeId] });
      queryClient.invalidateQueries({ queryKey: ["episode", episodeId] });
      setFormOpen(false);
      setCharacterId("");
      setAssignedTo("");
      setDeadline("");
    },
    onError: () => {
      showError("Vazifani qo'shib bo'lmadi.");
    },
  });

  function handleSubmit() {
    if (!assignedTo) {
      showError("Tayinlanuvchi tanlanmagan.");
      return;
    }
    if (taskType === "voice" && !characterId) {
      showError("Ovoz vazifasi uchun personaj tanlash shart.");
      return;
    }
    submitTask();
  }

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
        {project?.can_manage && (
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-tg-hint/40 p-3.5 text-sm font-medium text-tg-button active:opacity-70"
          >
            <Plus size={16} aria-hidden="true" /> Vazifa qo'shish
          </button>
        )}

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

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setFormOpen(false)}>
          <div
            className="flex w-full flex-col gap-4 rounded-t-3xl bg-tg-bg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-tg-text">Yangi vazifa</h2>
              <button onClick={() => setFormOpen(false)} aria-label="Yopish">
                <X size={20} className="text-tg-hint" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-tg-hint">Vazifa turi</span>
              <select
                value={taskType}
                onChange={(e) => {
                  setTaskType(e.target.value as TaskType);
                  setCharacterId("");
                }}
                className="rounded-xl bg-tg-secondaryBg p-3 text-sm text-tg-text"
              >
                {TASK_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {TASK_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>

            {taskType === "voice" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-tg-hint">Personaj</span>
                <select
                  value={characterId}
                  onChange={(e) => setCharacterId(e.target.value)}
                  className="rounded-xl bg-tg-secondaryBg p-3 text-sm text-tg-text"
                >
                  <option value="">Tanlang...</option>
                  {characters?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-tg-hint">Tayinlanuvchi</span>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="rounded-xl bg-tg-secondaryBg p-3 text-sm text-tg-text"
              >
                <option value="">Tanlang...</option>
                {members?.map((m) => (
                  <option key={m.id} value={m.user_id}>
                    {m.user.first_name} {m.user.last_name ?? ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-tg-hint">Muddat (ixtiyoriy)</span>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="rounded-xl bg-tg-secondaryBg p-3 text-sm text-tg-text"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-2xl bg-tg-button p-3.5 text-center text-sm font-semibold text-tg-buttonText disabled:opacity-50"
            >
              {isSubmitting ? "Saqlanmoqda..." : "Qo'shish"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
