import { useMemo, useState } from "react";
import { Theater } from "lucide-react";
import type { Character, ProjectMember, VoiceCue, VoiceCueStatus } from "@/types";
import { VoiceCueCard } from "@/components/VoiceCueCard";
import { EmptyState } from "@/components/EmptyState";

type FilterTab = "all" | "mine" | VoiceCueStatus;

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "Barchasi" },
  { key: "mine", label: "Mening rollarim" },
  { key: "pending", label: "Kutilmoqda" },
  { key: "assigned", label: "Biriktirildi" },
  { key: "recorded", label: "Yozildi" },
];

export function CueList({
  cues,
  activeCueId,
  currentUserId,
  characters,
  members,
  onSelect,
}: {
  cues: VoiceCue[];
  activeCueId: string | null;
  currentUserId?: string;
  characters: Character[];
  members: ProjectMember[];
  onSelect: (cue: VoiceCue) => void;
}) {
  const [tab, setTab] = useState<FilterTab>("all");
  const [characterFilter, setCharacterFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");

  const filtered = useMemo(() => {
    let result = cues;
    if (tab === "mine") result = result.filter((c) => c.created_by === currentUserId);
    else if (tab !== "all") result = result.filter((c) => c.status === tab);
    if (characterFilter) result = result.filter((c) => c.character?.id === characterFilter);
    if (actorFilter) result = result.filter((c) => c.actor?.id === actorFilter);
    return result;
  }, [cues, tab, currentUserId, characterFilter, actorFilter]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Theater size={15} className="text-tg-text" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-tg-text">Rollar ({cues.length})</h2>
      </div>

      <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-0.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
              tab === t.key
                ? "bg-role-director-600 text-white"
                : "bg-tg-secondaryBg text-tg-hint"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(characters.length > 0 || members.length > 0) && (
        <div className="flex gap-2">
          <select
            value={characterFilter}
            onChange={(e) => setCharacterFilter(e.target.value)}
            className="flex-1 rounded-xl bg-tg-secondaryBg px-2.5 py-2 text-xs text-tg-text outline-none"
          >
            <option value="">Barcha personajlar</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="flex-1 rounded-xl bg-tg-secondaryBg px-2.5 py-2 text-xs text-tg-text outline-none"
          >
            <option value="">Barcha aktyorlar</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {[m.user.first_name, m.user.last_name].filter(Boolean).join(" ")}
              </option>
            ))}
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={Theater} message="Bu filterda rol topilmadi." />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((cue) => (
            <VoiceCueCard
              key={cue.id}
              cue={cue}
              active={cue.id === activeCueId}
              onClick={() => onSelect(cue)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
