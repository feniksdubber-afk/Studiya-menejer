import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listMyTasks } from "@/api/tasks";
import { TaskStatusBadge, isDeadlineSoon } from "@/components/TaskStatusBadge";
import { DeadlineRing } from "@/components/DeadlineRing";
import { RotateCcw, AlertCircle, Clock3, ClipboardList } from "lucide-react";
import type { Task } from "@/types";

type Group = "revision" | "delayed" | "soon" | "rest";

const GROUP_META: Record<Group, { title: string; icon: typeof RotateCcw }> = {
  revision: { title: "Qayta topshirish", icon: RotateCcw },
  delayed: { title: "Kechikkan", icon: AlertCircle },
  soon: { title: "Deadline yaqin", icon: Clock3 },
  rest: { title: "Qolganlar", icon: ClipboardList },
};

function groupOf(task: Task): Group {
  if (task.status === "revision_requested") return "revision";
  if (task.status === "delayed") return "delayed";
  if (isDeadlineSoon(task.deadline)) return "soon";
  return "rest";
}

const TASK_TYPE_LABEL: Record<Task["task_type"], string> = {
  translation: "Tarjima",
  voice: "Ovoz",
  sound_video: "Video montaj",
  sound_audio: "Audio montaj",
};

export default function MyTasksPage() {
  const navigate = useNavigate();
  const { data: tasks, isLoading, isError } = useQuery({
    queryKey: ["tasks", "mine"],
    queryFn: listMyTasks,
  });

  if (isLoading) {
    return <p className="p-5 text-sm text-tg-hint">Yuklanmoqda...</p>;
  }
  if (isError) {
    return <p className="p-5 text-sm text-red-600">Vazifalarni yuklab bo'lmadi.</p>;
  }
  if (!tasks || tasks.length === 0) {
    return <p className="p-5 text-sm text-tg-hint">Sizga biriktirilgan vazifalar yo'q.</p>;
  }

  const groups: Group[] = ["revision", "delayed", "soon", "rest"];
  const byGroup = new Map<Group, Task[]>(groups.map((g) => [g, []]));
  for (const task of tasks) {
    byGroup.get(groupOf(task))!.push(task);
  }

  return (
    <div className="flex flex-col gap-5 p-5 pt-6 pb-20">
      <h1 className="text-lg font-semibold text-tg-text">Mening vazifalarim</h1>

      {groups.map((g) => {
        const groupTasks = byGroup.get(g)!;
        if (groupTasks.length === 0) return null;
        const meta = GROUP_META[g];
        return (
          <section key={g} className="flex flex-col gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-medium text-tg-hint">
              <meta.icon size={14} aria-hidden="true" /> {meta.title}
            </h2>
            <div className="flex flex-col gap-2">
              {groupTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className="flex items-center gap-3 rounded-2xl bg-tg-secondaryBg p-4 text-left"
                >
                  {task.deadline && (g === "soon" || g === "delayed") ? (
                    <DeadlineRing deadline={task.deadline} size={40} />
                  ) : null}
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-tg-text">
                        {TASK_TYPE_LABEL[task.task_type]}
                      </span>
                      <TaskStatusBadge status={task.status} />
                    </div>
                    {task.deadline && (
                      <span className="font-mono text-xs text-tg-hint">
                        {new Date(task.deadline).toLocaleString("uz-UZ")}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
