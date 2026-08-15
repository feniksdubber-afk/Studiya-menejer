import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { getProject, listProjectMembers, listSeasons, listEpisodes } from "@/api/projects";
import { listCharacters } from "@/api/characters";
import type { Season } from "@/types";

type Tab = "seasons" | "characters" | "team";

function SeasonBlock({ season }: { season: Season }) {
  const navigate = useNavigate();
  const { data: episodes } = useQuery({
    queryKey: ["episodes", season.id],
    queryFn: () => listEpisodes(season.id),
  });

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
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("seasons");

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
          {seasons?.length ? (
            seasons.map((season) => <SeasonBlock key={season.id} season={season} />)
          ) : (
            <p className="text-sm text-tg-hint">Sezonlar hali qo'shilmagan.</p>
          )}
        </div>
      )}

      {tab === "characters" && (
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
      )}

      {tab === "team" && (
        <div className="flex flex-col gap-2">
          {members?.length ? (
            members.map((m) => (
              <div key={m.id} className="rounded-xl bg-tg-secondaryBg px-3 py-2 text-sm text-tg-text">
                {m.role_in_project}
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
